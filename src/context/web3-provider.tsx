"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ethers } from 'ethers';

// Extend Window interface for ethereum
declare global {
    interface Window {
        ethereum?: any;
    }
}

// User info from backend
interface UserInfo {
    walletAddress: string;
    email: string;
    kycStatus: 'pending' | 'approved' | 'rejected' | 'not_started';
    hasAlpacaAccount: boolean;
    alpacaAccountStatus?: string;
}

// Define the shape of the context state
interface Web3ContextType {
    provider: ethers.BrowserProvider | null;
    signer: ethers.JsonRpcSigner | null;
    address: string | null;
    isAuthenticated: boolean;
    sessionToken: string | null;
    user: UserInfo | null;
    isLoading: boolean;
    isInitialized: boolean;
    connectWallet: () => Promise<void>;
    authenticateWallet: () => Promise<void>;
    disconnectWallet: () => void;
    refreshUserInfo: () => Promise<void>;
}

// Create the context with a default undefined value
const Web3Context = createContext<Web3ContextType | undefined>(undefined);

// Define the props for the provider component
interface Web3ProviderProps {
    children: ReactNode;
}

// Create the provider component
export const Web3Provider = ({ children }: Web3ProviderProps) => {
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [user, setUser] = useState<UserInfo | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);

    // Fetch user information from backend
    const fetchUserInfo = useCallback(async (token: string) => {
        try {
            const response = await fetch('/api/user/register', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            }
        } catch (error) {
            console.error('Failed to fetch user info:', error);
        }
    }, []);

    // Load session from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('sessionToken');
        const storedAddress = localStorage.getItem('walletAddress');
        
        if (storedToken && storedAddress) {
            setSessionToken(storedToken);
            setAddress(storedAddress);
            setIsAuthenticated(true);
            // Load user info
            fetchUserInfo(storedToken);
        }
        
        // Mark as initialized after checking localStorage
        setIsInitialized(true);
    }, [fetchUserInfo]);

    // Function to refresh user info
    const refreshUserInfo = async () => {
        if (sessionToken) {
            await fetchUserInfo(sessionToken);
        }
    };

    // Function to connect the wallet (without authentication)
    const connectWallet = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                setIsLoading(true);
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(web3Provider);

                const accounts = await web3Provider.send('eth_requestAccounts', []);
                const signerInstance = await web3Provider.getSigner();
                
                setSigner(signerInstance);
                setAddress(accounts[0]);

                setIsLoading(false);
            } catch (error) {
                console.error("Failed to connect wallet:", error);
                setIsLoading(false);
                alert('Failed to connect wallet');
            }
        } else {
            alert('Please install MetaMask or another Web3 wallet!');
        }
    };

    // Function to authenticate wallet via signature
    const authenticateWallet = useCallback(async () => {
        try {
            setIsLoading(true);
            
            // Step 0: If wallet not connected, connect first
            let currentAddress = address;
            let currentSigner = signer;
            
            if (!currentAddress || !currentSigner) {
                if (typeof window.ethereum === 'undefined') {
                    alert('Please install MetaMask or another Web3 wallet!');
                    setIsLoading(false);
                    return;
                }
                
                // Connect wallet
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(web3Provider);

                const accounts = await web3Provider.send('eth_requestAccounts', []);
                const signerInstance = await web3Provider.getSigner();
                
                setSigner(signerInstance);
                setAddress(accounts[0]);
                
                // Use the newly connected wallet
                currentAddress = accounts[0];
                currentSigner = signerInstance;
            }

            // Step 1: Request nonce from backend
            const nonceResponse = await fetch('/api/auth/nonce', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address: currentAddress }),
            });

            if (!nonceResponse.ok) {
                throw new Error('Failed to get nonce');
            }

            const { message } = await nonceResponse.json();

            // Step 2: Sign the message
            const signature = await currentSigner.signMessage(message);

            // Step 3: Verify signature with backend
            const verifyResponse = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: currentAddress,
                    signature,
                }),
            });

            if (!verifyResponse.ok) {
                throw new Error('Failed to verify signature');
            }

            const { sessionToken: token, user: userData } = await verifyResponse.json();

            // Store session
            setSessionToken(token);
            setIsAuthenticated(true);
            setUser(userData);
            
            localStorage.setItem('sessionToken', token);
            if (currentAddress) {
                localStorage.setItem('walletAddress', currentAddress);
            }

            setIsLoading(false);
        } catch (error) {
            console.error("Authentication failed:", error);
            setIsLoading(false);
            // Don't show alert for user-rejected signatures
            if (error instanceof Error && !error.message.includes('user rejected')) {
                alert('Authentication failed. Please try again.');
            }
        }
    }, [address, signer]);

    // Function to disconnect the wallet
    const disconnectWallet = useCallback(() => {
        setProvider(null);
        setSigner(null);
        setAddress(null);
        setIsAuthenticated(false);
        setSessionToken(null);
        setUser(null);
        
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('walletAddress');
    }, []);

    // Effect to handle account and network changes
    useEffect(() => {
        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else if (accounts[0] !== address) {
                // Account changed, need to re-authenticate
                setAddress(accounts[0]);
                setIsAuthenticated(false);
                setSessionToken(null);
                setUser(null);
                localStorage.removeItem('sessionToken');
                
                // Re-fetch signer as the account has changed
                if (provider) {
                    (async () => {
                        const signerInstance = await provider.getSigner();
                        setSigner(signerInstance);
                    })();
                }
            }
        };

        const handleChainChanged = () => {
            // Chain changed, reload to ensure consistency
            window.location.reload();
        };

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, [provider, address, disconnectWallet]);

    return (
        <Web3Context.Provider 
            value={{ 
                provider, 
                signer, 
                address, 
                isAuthenticated,
                sessionToken,
                user,
                isLoading,
                isInitialized,
                connectWallet, 
                authenticateWallet,
                disconnectWallet,
                refreshUserInfo,
            }}
        >
            {children}
        </Web3Context.Provider>
    );
};

// Create a custom hook to use the Web3 context
export const useWeb3 = () => {
    const context = useContext(Web3Context);
    if (context === undefined) {
        throw new Error('useWeb3 must be used within a Web3Provider');
    }
    return context;
};
