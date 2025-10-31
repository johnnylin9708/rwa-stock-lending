"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ethers } from 'ethers';
import { getUser } from '@/app/actions/user';

// Extend Window interface for ethereum
declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            on: (event: string, callback: (...args: unknown[]) => void) => void;
            removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
        };
    }
}

// User info from backend
interface UserInfo {
    walletAddress: string;
    email: string;
    kycStatus: 'pending' | 'approved' | 'rejected' | 'not_started';
    hasAlpacaAccount: boolean;
    alpacaAccountStatus?: string;
    erc3643?: {
        identityAddress?: string;
        identityCreatedAt?: Date;
        claims: Array<{
            claimName: string;
            claimId: string;
            topic: string;
            issuer: string;
            signature: string;
            data: string;
            issuedAt: Date;
            isValid: boolean;
        }>;
        isRegistered: boolean;
        registeredAt?: Date;
        country: number;
    };
}

// Define the shape of the context state
interface Web3ContextType {
    provider: ethers.BrowserProvider | null;
    signer: ethers.JsonRpcSigner | null;
    address: string | null;
    isAuthenticated: boolean;
    user: UserInfo | null;
    isLoading: boolean;
    isInitialized: boolean;
    connectWallet: () => Promise<void>;
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
    const [user, setUser] = useState<UserInfo | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);

    // Fetch user information from backend
    const fetchUserInfo = useCallback(async (walletAddress: string) => {
        try {
            const user = await getUser(walletAddress);
            if (user) {
                setUser(user);
                
                // Automatically create and verify Identity for legacy accounts (if they don't have one)
                // if (user && !user.erc3643?.identityAddress) {
                //     console.log('User does not have Identity, creating and verifying automatically...');
                //     try {
                //         const identityResponse = await fetch('/api/erc3643/identity/create', {
                //             method: 'POST',
                //             headers: {
                //                 'Content-Type': 'application/json',
                //             },
                //             body: JSON.stringify({ walletAddress }),
                //         });
                        
                //         if (identityResponse.ok) {
                //             const identityData = await identityResponse.json();
                //             if (identityData.isRegistered) {
                //                 console.log('Identity created and verified automatically:', identityData.identityAddress);
                //                 console.log('KYC Status:', identityData.kycStatus);
                //             } else {
                //                 console.log('Identity created:', identityData.identityAddress);
                //             }
                            
                //             // Refresh user info to get the newly created and verified Identity
                //             const refreshResponse = await fetch('/api/user/register', {
                //                 headers: {
                //                     'Content-Type': 'application/json',
                //                 },
                //                 body: JSON.stringify({ walletAddress }),
                //             });
                            
                //             if (refreshResponse.ok) {
                //                 const refreshData = await refreshResponse.json();
                //                 setUser(refreshData.user);
                //             }
                //         } else {
                //             console.warn('Failed to create Identity automatically:', await identityResponse.text());
                //         }
                //     } catch (identityError) {
                //         console.error('Error creating Identity automatically:', identityError);
                //         // Does not affect normal login flow
                //     }
                // }
            }
        } catch (error) {
            console.error('Failed to fetch user info:', error);
        }
    }, []);

    // Load session from localStorage on mount and reconnect wallet
    useEffect(() => {
        const initializeSession = async () => {
            // Always mark as initialized ASAP so UI is interactive even if background checks run
            // This avoids blocking the Sign In button on refresh
            setIsInitialized(true);

            const storedAddress = localStorage.getItem('walletAddress');

            // Set stored address for UI, but do NOT mark authenticated until we confirm wallet account matches
            setAddress(storedAddress);

            // Reconnect wallet to get provider and signer (non-blocking best-effort)
            if (typeof window.ethereum !== 'undefined') {
                try {
                    const web3Provider = new ethers.BrowserProvider(window.ethereum);
                    setProvider(web3Provider);
                    // Try to get signer without requesting account access (silent)
                    const accounts = await web3Provider.send('eth_accounts', []);
                    if (accounts.length > 0 && accounts[0].toLowerCase() === storedAddress.toLowerCase()) {
                        const signerInstance = await web3Provider.getSigner();
                        setSigner(signerInstance);
                        setIsAuthenticated(true);
                        console.log('Wallet reconnected successfully');
                    } else {
                        // Different account or not connected; remain unauthenticated so user can click Sign In
                        setIsAuthenticated(false);
                        console.log('Wallet not connected or different address, will need manual reconnection');
                    }
                } catch (error) {
                    console.log('Could not silently reconnect wallet:', error);
                }
            }

            // Load user info (fire-and-forget so it doesn't block initialization)
            fetchUserInfo(storedAddress).catch((err) => {
                console.warn('Background fetchUserInfo failed:', err);
            });
        };
        
        initializeSession();
    }, [fetchUserInfo]);

    // Function to refresh user info
    const refreshUserInfo = async () => {
        if (address) {
            await fetchUserInfo(address);
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
                localStorage.setItem('walletAddress', accounts[0]);
                
                // Automatically authenticate user after connecting wallet
                setIsAuthenticated(true);
                await fetchUserInfo(accounts[0]);
                
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

    // Function to disconnect the wallet
    const disconnectWallet = useCallback(() => {
        setProvider(null);
        setSigner(null);
        setAddress(null);
        setIsAuthenticated(false);
        setUser(null);
        
        localStorage.removeItem('walletAddress');
    }, []);

    // Effect to handle account and network changes
    useEffect(() => {
        const handleAccountsChanged = (...args: unknown[]) => {
            const accounts = args[0] as string[];
            if (accounts.length === 0) {
                disconnectWallet();
            } else if (accounts[0] !== address) {
                // Account changed, need to re-login
                setAddress(accounts[0]);
                setIsAuthenticated(false);
                setUser(null);
                localStorage.removeItem('walletAddress');
                
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
                user,
                isLoading,
                isInitialized,
                connectWallet, 
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
