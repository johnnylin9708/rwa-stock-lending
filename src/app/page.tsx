"use client";

import { useEffect, useState, useCallback } from "react";
import { useWeb3 } from "@/context/web3-provider";
import { ethers } from "ethers";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAlpacaAccountDetails } from "./actions/alpaca";
import { getTokenizationHistory } from "./actions/tokenization";
import { createIdentity, getTokenizedStockBalance, mintTStockToUser } from "./actions/erc3643";
import { useRouter } from "next/navigation";

// Define a type for the portfolio position (from Alpaca)
interface Position {
    symbol: string;
    qty: string;
    avg_entry_price: string;
    market_value: string;
    cost_basis: string;
    unrealized_pl: string;
    unrealized_plpc: string;
    current_price: string;
    side: string;
    asset_id: string;
    asset_class?: string;
    exchange: string;
    qty_available?: string;
}

// Tokenization transaction history
interface TokenizedPosition {
    _id: string;
    walletAddress: string;
    stockSymbol: string;
    tokenAddress: string;
    amount: number;
    txHash: string;
    tokenBalance?: string;
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
}

// Tokenized Assets Configuration
// 注意：合約地址是公開資訊，暴露在客戶端是完全安全的
const tokenizedAssets = [
    {
        symbol: "TSPY",
        originalSymbol: "SPY",  // Original stock symbol
        tokenAddress: process.env.NEXT_PUBLIC_TSPY_ADDRESS || "0xBEae6Fa62362aB593B498692FD09002a9eEd52dc",
        tokenStandard: "ERC-3643",
    }
];

export default function HomePage() {
    const { address, signer, isAuthenticated, isInitialized: web3Initialized, user } = useWeb3();
    const router = useRouter();
    const [portfolio, setPortfolio] = useState<Position[]>([]);
    const [accountDetails, setAccountDetails] = useState<any>(null);
    const [tokenizedPositions, setTokenizedPositions] = useState<TokenizedPosition[]>([]);
    const [tokenBalance, setTokenBalance] = useState<string>("0");  // ERC-3643 token balance from chain
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreatingIdentity, setIsCreatingIdentity] = useState(false);
    
    // Tokenization modal state
    const [showTokenizeModal, setShowTokenizeModal] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
    const [tokenizeAmount, setTokenizeAmount] = useState("");
    const [isTokenizing, setIsTokenizing] = useState(false);

    useEffect(() => {
        async function fetchPortfolio() {
            // Don't fetch if Web3 context not initialized yet
            if (!web3Initialized) {
                return;
            }

            // Check if user is authenticated
            if (!isAuthenticated) {
                setError("Please sign in to view your portfolio");
                setIsLoading(false);
                return;
            }
            
            // Reset error when starting fresh fetch
            setError(null);
            setIsLoading(true);

            try {
                // Prepare headers

                // Fetch portfolio (includes account details and positions)
                const alpacaAccountDetails = await getAlpacaAccountDetails(address as string);
                if (!alpacaAccountDetails) {
                    throw new Error("Failed to fetch portfolio data");
                }

                // Set account details and positions from portfolio API
                setAccountDetails(alpacaAccountDetails.account);
                setPortfolio(alpacaAccountDetails.positions || []);
            } catch (err: any) {
                setError(err.message);
                console.error('Error fetching portfolio:', err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchPortfolio();
    }, [isAuthenticated, web3Initialized]);

    // Fetch ERC-3643 token balance from blockchain
    const fetchTokenBalance = useCallback(async () => {
        if (!address) return;
        
        try {
            const tStockBalance = await getTokenizedStockBalance(address)
            setTokenBalance(tStockBalance.balance || "0");
        } catch (error) {
            console.error("Failed to fetch token balance:", error);
            setTokenBalance("0");
        }
    }, [address]);

    const fetchTokenizedPositions = useCallback(async () => {
        if (!address) return;
        
        try {
            const tokenizationHistory = await getTokenizationHistory(address);
            setTokenizedPositions(tokenizationHistory || []);
        } catch (err) {
            console.error("Error fetching tokenized positions:", err);
        }
    }, [address]);

    // Fetch tokenized positions and balance
    useEffect(() => {
        if (address) {
            fetchTokenBalance();
            fetchTokenizedPositions();
        }
    }, [address, fetchTokenBalance, fetchTokenizedPositions]);
    
    // Manually create and verify Identity
    const handleCreateIdentity = async (recreate = false) => {
        if (!address) return;
        
        if (recreate) {
            if (!confirm(
                'This will delete your old Identity and create a new one.\n\n' +
                '⚠️ WARNING: This action cannot be undone!\n\n' +
                'Continue?'
            )) {
                return;
            }
        }
        
        setIsCreatingIdentity(true);
        try {
            const response = await createIdentity(address, recreate);
            
            
            if (response.success) {
                if (response.isRegistered) {
                    alert(
                        `Identity ${recreate ? 'recreated' : 'created'} and verified successfully!\n\n` +
                        `✓ Identity Address: ${response.identityAddress}\n` +
                        `✓ KYC Claim issued\n` +
                        `✓ Registered to IdentityRegistry\n\n` +
                        `You can now use ERC-3643 tokens!`
                    );
                } else {
                    alert(`Identity ${recreate ? 'recreated' : 'created'}!\nAddress: ${response.identityAddress}\n\n${response.message}`);
                }
                window.location.reload(); // Refresh page to update user info
            } else {
                alert(`Operation failed: ${response.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Error creating identity:', err);
            alert('Failed to create Identity, please try again later');
        } finally {
            setIsCreatingIdentity(false);
        }
    };

    const handleTokenizeClick = (position: Position) => {
        setSelectedPosition(position);
        setTokenizeAmount("");
        setShowTokenizeModal(true);
    };

    const handleTokenize = async () => {
        console.log('selectedPosition', selectedPosition);
        console.log('tokenizeAmount', tokenizeAmount);
        console.log('address', address);
        console.log('signer', signer);
        
        if (!selectedPosition || !tokenizeAmount || !address) {
            alert("Please fill in all fields");
            return;
        }
        
        // Check if signer exists, if not, prompt to reconnect wallet
        if (!signer) {
            if (confirm("Wallet connection lost. Click OK to reconnect your wallet.")) {
                try {
                    if (typeof window.ethereum !== 'undefined') {
                        const web3Provider = new ethers.BrowserProvider(window.ethereum);
                        await web3Provider.send('eth_requestAccounts', []);
                        const signerInstance = await web3Provider.getSigner();
                        
                        // Verify it's the same address
                        const connectedAddress = await signerInstance.getAddress();
                        if (connectedAddress.toLowerCase() !== address.toLowerCase()) {
                            alert("Please connect with the same wallet address you're logged in with");
                            return;
                        }
                        
                        // Use the new signer for this transaction
                        console.log("Wallet reconnected successfully");
                        // Continue with tokenization using signerInstance
                        await performTokenization(signerInstance);
                        return;
                    } else {
                        alert("Please install MetaMask");
                        return;
                    }
                } catch (error) {
                    console.error("Failed to reconnect wallet:", error);
                    alert("Failed to reconnect wallet. Please refresh the page and try again.");
                    return;
                }
            }
            return;
        }
        
        // Wallet is connected, proceed with tokenization
        await performTokenization(signer);
    };
    
    const performTokenization = async (_signerInstance: ethers.JsonRpcSigner) => {
        if (!selectedPosition) return;

        const amount = parseFloat(tokenizeAmount);
        if (amount <= 0 || amount > parseFloat(selectedPosition.qty)) {
            alert("Invalid amount");
            return;
        }

        setIsTokenizing(true);

        try {
            // Check if user has verified identity
            if (!user?.erc3643?.identityAddress) {
                alert("Please create your on-chain identity first before tokenizing assets.");
                setIsTokenizing(false);
                return;
            }

            if (!user?.erc3643?.isRegistered) {
                alert("Your identity is not verified. Please complete verification first.");
                setIsTokenizing(false);
                return;
            }

            console.log('Minting ERC-3643 tokens:', {
                amount,
                stockSymbol: selectedPosition.symbol,
                walletAddress: address
            });

            // Call ERC-3643 mint API
            const mintResponse = await mintTStockToUser(address as string, amount, selectedPosition.symbol, selectedPosition.symbol)

            console.log('Mint result:', mintResponse);

            alert(
                `Tokenization successful!\n\n` +
                `✓ Minted ${amount} ERC-3643 tokens\n` +
                `✓ Stock: ${selectedPosition.symbol}\n` +
                `✓ TX Hash: ${mintResponse.transactionHash?.slice(0, 10)}...\n` +
                `✓ Recorded in database`
            );
            
            // Refresh data
            await fetchTokenBalance();  // Refresh token balance from chain
            await fetchTokenizedPositions();  // Refresh tokenization history from database
            setShowTokenizeModal(false);
            setSelectedPosition(null);
            setTokenizeAmount("");

        } catch (error: any) {
            console.error("Tokenization error:", error);
            alert(`Tokenization failed: ${error.message}`);
        } finally {
            setIsTokenizing(false);
        }
    };

    if (!web3Initialized || isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <p className="text-sm text-gray-500">Loading...</p>
            </div>
        );
    }

    if (error && !isAuthenticated) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-sm text-red-600 mb-2">Not authenticated</p>
                    <p className="text-xs text-gray-500">{error}</p>
                    <a 
                        href="/"
                        className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Go to Home
                    </a>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-sm text-red-600 mb-2">Failed to load portfolio</p>
                    <p className="text-xs text-gray-500">{error}</p>
                    <Button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard</h1>
                    <p className="text-sm text-gray-500">View your portfolio and account information</p>
                </div>
                
                {/* Identity Status Alerts */}
                {user && !user.erc3643?.identityAddress && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-yellow-900">On-Chain Identity Required</h3>
                                <p className="text-xs text-yellow-700 mt-1">
                                    To use ERC-3643 compliant token features, you need to create an on-chain identity. Click the button below to create and verify your identity automatically.
                                </p>
                                <Button
                                    onClick={() => handleCreateIdentity(false)}
                                    disabled={isCreatingIdentity}
                                    className="mt-3 px-4 py-2 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-yellow-300 transition-colors"
                                >
                                    {isCreatingIdentity ? 'Creating & Verifying...' : 'Create & Verify Identity'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Identity Created but Not Verified (Legacy accounts) */}
                {user && user.erc3643?.identityAddress && !user.erc3643?.isRegistered && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-blue-900">Verification Incomplete</h3>
                                <p className="text-xs text-blue-700 mt-1">
                                    Your on-chain identity: <span className="font-mono">{user.erc3643.identityAddress.slice(0, 10)}...{user.erc3643.identityAddress.slice(-8)}</span>
                                </p>
                                <p className="text-xs text-blue-600 mt-2">
                                    Your identity needs to be verified to use ERC-3643 tokens. Click below to complete the verification process automatically.
                                </p>
                                <div className="mt-3 flex gap-2">
                                    <Button
                                        onClick={() => handleCreateIdentity(false)}
                                        disabled={isCreatingIdentity}
                                        className="px-4 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                                    >
                                        {isCreatingIdentity ? 'Verifying...' : 'Complete Verification'}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 If verification fails, try "Recreate Identity" to start fresh with the correct configuration.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-row gap-2">
                    <Button
                        onClick={() => handleCreateIdentity(true)}
                        disabled={isCreatingIdentity}
                        className="px-4 py-2 my-3 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300 transition-colors"
                        title="Delete the old identity and create a new one with correct configuration"
                    >
                        {isCreatingIdentity ? 'Recreating...' : 'Recreate Identity'}
                    </Button>

                    <Button
                        onClick={() => router.push('/self')}
                        className="px-4 py-2 my-3 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-red-300 transition-colors"
                        title="Delete the old identity and create a new one with correct configuration"
                    >
                        {'Verify Identity with Self App'}
                    </Button>
                </div>
                
                {/* Identity Verified */}
                {user && user.erc3643?.identityAddress && user.erc3643?.isRegistered && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-green-900">✓ Identity Verified</h3>
                                <p className="text-xs text-green-700 mt-1">
                                    Your on-chain identity is verified and you can hold and transfer ERC-3643 compliant tokens.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* {accountDetails && (
                    <div className="border border-gray-200 rounded-lg p-6 bg-white mb-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Portfolio Value</p>
                                <p className="text-2xl font-semibold text-gray-900">
                                    ${parseFloat(accountDetails.portfolio_value || '0').toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                )} */}
                
                {/* ERC-3643 Identity & Compliance Display */}
                {user && (
                    <div className="border border-gray-200 rounded-lg bg-white mb-6">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                ERC-3643 Compliance Identity
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">OnchainID & T-REX Token Standard</p>
                        </div>
                        
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Identity Information */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-900 mb-3">Identity Contract</h3>
                                        {user.erc3643?.identityAddress ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-green-900 font-medium">Identity Created</p>
                                                        <p className="text-xs font-mono text-green-700 truncate mt-0.5">
                                                            {user.erc3643.identityAddress}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(user.erc3643!.identityAddress!);
                                                            alert('Address copied!');
                                                        }}
                                                        className="px-2 py-1 text-xs text-green-700 hover:text-green-900"
                                                    >
                                                        Copy
                                                    </Button>
                                                </div>
                                                
                                                {user.erc3643.identityCreatedAt && (
                                                    <div className="text-xs text-gray-500">
                                                        Created: {new Date(user.erc3643.identityCreatedAt).toLocaleString('en-US')}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                                <p className="text-xs text-gray-500">Identity not yet created</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Registry Status */}
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-900 mb-3">Registry Status</h3>
                                        <div className={`p-3 border rounded-lg ${
                                            user.erc3643?.isRegistered 
                                                ? 'bg-green-50 border-green-200' 
                                                : 'bg-yellow-50 border-yellow-200'
                                        }`}>
                                            <div className="flex items-center gap-2">
                                                {user.erc3643?.isRegistered ? (
                                                    <>
                                                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="text-xs font-medium text-green-900">Registered to IdentityRegistry</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="text-xs font-medium text-yellow-900">Not Registered</span>
                                                    </>
                                                )}
                                            </div>
                                            {user.erc3643?.registeredAt && (
                                                <p className="text-xs text-gray-600 mt-1">
                                                    Registered: {new Date(user.erc3643.registeredAt).toLocaleString('en-US')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Claims Information */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-900 mb-3">
                                            Claims ({user.erc3643?.claims?.length || 0})
                                        </h3>
                                        
                                        {user.erc3643?.claims && user.erc3643.claims.length > 0 ? (
                                            <div className="space-y-2">
                                                {user.erc3643.claims.map((claim, index) => (
                                                    <div key={index} className={`p-3 border rounded-lg ${
                                                        claim.isValid 
                                                            ? 'bg-green-50 border-green-200' 
                                                            : 'bg-red-50 border-red-200'
                                                    }`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    {claim.isValid ? (
                                                                        <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg className="w-3.5 h-3.5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                                        </svg>
                                                                    )}
                                                                    <span className="text-xs font-medium text-gray-900">
                                                                        {claim.claimName}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-gray-500 truncate">
                                                                    Issuer: {claim.issuer}
                                                                </p>
                                                                <p className="text-xs text-gray-400 mt-1">
                                                                    Issued: {new Date(claim.issuedAt).toLocaleString('en-US')}
                                                                </p>
                                                            </div>
                                                            <span className={`px-2 py-0.5 text-xs rounded ${
                                                                claim.isValid 
                                                                    ? 'bg-green-100 text-green-700' 
                                                                    : 'bg-red-100 text-red-700'
                                                            }`}>
                                                                {claim.isValid ? 'Valid' : 'Invalid'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                                <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="text-xs text-gray-500">No Claims</p>
                                                <p className="text-xs text-gray-400 mt-1">Will be issued after KYC approval by administrator</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Compliance Status */}
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-900 mb-3">Compliance Status</h3>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                <span className="text-gray-600">Can Mint Tokens</span>
                                                <span className={`font-medium ${
                                                    user.erc3643?.isRegistered ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {user.erc3643?.isRegistered ? '✓ Yes' : '✗ No'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                                <span className="text-gray-600">Can Transfer</span>
                                                <span className={`font-medium ${
                                                    user.erc3643?.isRegistered ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {user.erc3643?.isRegistered ? '✓ Yes' : '✗ No'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Additional Info */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500">
                                            ERC-3643 is a permissioned token standard for tokenized securities
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Powered by T-REX Token & OnchainID
                                        </p>
                                    </div>
                                    {user.erc3643?.isRegistered && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Verified & Compliant
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="border border-gray-200 rounded-lg bg-white">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-medium text-gray-900">My Positions</h2>
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            >
                                Refresh
                            </button>
                        </div>
                        {portfolio.length > 0 && (
                            <>
                            <div>
                                <p className="text-xs text-gray-500">Last Equity</p>
                                <p className="text-lg font-semibold text-gray-900">{accountDetails.last_equity}</p>
                            </div>
                            <br />
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500">Total Positions</p>
                                    <p className="text-lg font-semibold text-gray-900">{portfolio.length}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Total Market Value</p>
                                    <p className="text-lg font-semibold text-gray-900">
                                        ${portfolio.reduce((sum, pos) => sum + parseFloat(pos.market_value), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Total P/L</p>
                                    <p className={`text-lg font-semibold ${
                                        portfolio.reduce((sum, pos) => sum + parseFloat(pos.unrealized_pl), 0) >= 0 
                                            ? 'text-green-600' 
                                            : 'text-red-600'
                                    }`}>
                                        {portfolio.reduce((sum, pos) => sum + parseFloat(pos.unrealized_pl), 0) >= 0 ? '+' : ''}
                                        ${portfolio.reduce((sum, pos) => sum + parseFloat(pos.unrealized_pl), 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            </>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Symbol
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Qty
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Avg Entry
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Current Price
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Market Value
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        P/L
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        P/L %
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {portfolio.length > 0 ? (
                                    portfolio.map((pos) => {
                                        const plPercentage = parseFloat(pos.unrealized_plpc || '0') * 100;
                                        const isProfit = parseFloat(pos.unrealized_pl) >= 0;

                                        console.log(pos);
                                        
                                        return (
                                            <tr key={pos.symbol} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-900">{pos.symbol}</span>
                                                        <span className="text-xs text-gray-500">{pos.exchange || 'N/A'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                                                    {parseFloat(pos.qty).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                                                    ${parseFloat(pos.avg_entry_price).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                                                    ${parseFloat(pos.current_price).toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                                                    ${parseFloat(pos.market_value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                                                    isProfit ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {isProfit ? '+' : ''}
                                                    ${parseFloat(pos.unrealized_pl).toFixed(2)}
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                                                    isProfit ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                    {isProfit ? '+' : ''}
                                                    {plPercentage.toFixed(2)}%
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                    {pos.exchange !== "CRYPTO" && <button
                                                        type="button"
                                                        onClick={() => handleTokenizeClick(pos)}
                                                        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                                                        disabled={!address}
                                                    >
                                                        Tokenize
                                                    </button>}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center">
                                            <p className="text-sm text-gray-500">No positions</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tokenized Positions - Grouped by Stock Symbol */}
                <div className="border border-gray-200 rounded-lg bg-white mt-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-900">Tokenized Positions</h2>
                        <p className="text-sm text-gray-500 mt-1">Frozen stock positions converted to blockchain tokens</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tokenized Symbol
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Current Balance
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Transactions
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Latest TX
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {tokenizedAssets.map((asset) => {
                                    // Find all transactions for this asset's original symbol
                                    const assetTransactions = tokenizedPositions.filter(
                                        tx => tx.stockSymbol === asset.originalSymbol
                                    );
                                    
                                    // Calculate stats
                                    const totalMinted = assetTransactions.reduce((sum, tx) => sum + tx.amount, 0);
                                    const txCount = assetTransactions.length;
                                    const latestTx = assetTransactions.length > 0 
                                        ? assetTransactions.reduce((latest, tx) => 
                                            new Date(tx.createdAt) > new Date(latest.createdAt) ? tx : latest
                                        )
                                        : null;
                                    
                                    return (
                                        <tr key={asset.symbol} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                                        <span className="text-xs font-bold text-blue-600">
                                                            {asset.symbol.slice(0, 2)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <a 
                                                            href={`https://sepolia.etherscan.io/address/${asset.tokenAddress}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline"
                                                        >
                                                            <span className="text-sm font-semibold text-gray-900">{asset.symbol}</span>
                                                        </a>
                                                        <p className="text-xs text-gray-500">← {asset.originalSymbol}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="text-lg font-bold text-blue-600">
                                                    {parseFloat(tokenBalance).toLocaleString(undefined, {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </span>
                                                <p className="text-xs text-gray-500">on-chain</p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {txCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {latestTx?.txHash ? (
                                                    <a 
                                                        href={`https://sepolia.etherscan.io/tx/${latestTx.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs font-mono text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {latestTx.txHash.slice(0, 8)}...{latestTx.txHash.slice(-6)}
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400">No transactions</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {latestTx ? (
                                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                                        latestTx.status === 'completed' 
                                                            ? 'bg-green-100 text-green-800 border border-green-200' 
                                                            : latestTx.status === 'pending'
                                                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                                            : 'bg-red-100 text-red-800 border border-red-200'
                                                    }`}>
                                                        {latestTx.status}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tokenization Modal */}
                <Dialog open={showTokenizeModal} onOpenChange={setShowTokenizeModal}>
                    <DialogContent className="sm:max-w-md bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-medium text-gray-900">
                                Tokenize {selectedPosition?.symbol}
                            </DialogTitle>
                        </DialogHeader>
                        
                        {selectedPosition && (
                            <div className="space-y-4">
                                <div>
                                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                                        Available Quantity
                                    </Label>
                                    <p className="text-2xl font-semibold text-gray-900">{selectedPosition.qty}</p>
                                </div>

                                <div>
                                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                                        Amount to Tokenize
                                    </Label>
                                    <Input
                                        type="number"
                                        value={tokenizeAmount}
                                        onChange={(e) => setTokenizeAmount(e.target.value)}
                                        placeholder="0.00"
                                        step="0.01"
                                        max={selectedPosition.qty}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                                    />
                                    <p className="text-xs text-gray-500 mt-1.5">
                                        Max: {selectedPosition.qty}
                                    </p>
                                </div>

                                {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-xs text-blue-700">
                                        ℹ️ This will freeze {tokenizeAmount || '0'} shares of {selectedPosition.symbol} and mint equivalent ERC20 tokens to your wallet.
                                    </p>
                                </div> */}

                                {!signer && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                        <p className="text-xs text-yellow-700">
                                            ⚠️ Wallet connection required. Click Confirm to reconnect your wallet.
                                    </p>
                                </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        onClick={() => {
                                            setShowTokenizeModal(false);
                                            setSelectedPosition(null);
                                            setTokenizeAmount("");
                                        }}
                                        className="flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                        disabled={isTokenizing}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleTokenize}
                                        disabled={isTokenizing || !tokenizeAmount || parseFloat(tokenizeAmount) <= 0}
                                        className="flex-1 px-4 py-2.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isTokenizing ? "Tokenizing..." : "Confirm"}
                                    </Button>
                        </div>
                    </div>
                )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
