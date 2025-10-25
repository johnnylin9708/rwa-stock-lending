"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

// Define the shape of the context state
interface Web3ContextType {
    provider: ethers.BrowserProvider | null;
    signer: ethers.JsonRpcSigner | null;
    address: string | null;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
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

    // Function to connect the wallet
    const connectWallet = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const web3Provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(web3Provider);

                const accounts = await web3Provider.send('eth_requestAccounts', []);
                const signerInstance = await web3Provider.getSigner();
                
                setSigner(signerInstance);
                setAddress(accounts[0]);

            } catch (error) {
                console.error("Failed to connect wallet:", error);
            }
        } else {
            alert('Please install MetaMask!');
        }
    };

    // Function to disconnect the wallet
    const disconnectWallet = () => {
        setProvider(null);
        setSigner(null);
        setAddress(null);
        // Optionally, you might want to clear stored connection status in localStorage
    };

    // Effect to handle account and network changes
    useEffect(() => {
        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else {
                setAddress(accounts[0]);
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
            // For simplicity, we just reload the page.
            // A more robust implementation would handle this more gracefully.
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
    }, [provider]);


    return (
        <Web3Context.Provider value={{ provider, signer, address, connectWallet, disconnectWallet }}>
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
