"use client";

import { useEffect, useState, useCallback } from "react";
import { useWeb3 } from "@/context/web3-provider";
import { ethers } from "ethers";
import { tokenizedAssetABI } from "@/contracts/index";

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

interface TokenizedPosition {
    id: string;
    originalSymbol: string;
    tokenSymbol: string;
    tokenContractAddress: string;
    alpacaPositionQty: number;
    tokenizedQty: number;
    frozenQty: number;
    availableQty: number;
    tokenizations: {
        amount: number;
        txHash: string;
        blockNumber?: number;
        timestamp: Date;
        status: 'pending' | 'confirmed' | 'failed';
    }[];
    createdAt: Date;
    updatedAt: Date;
}

export default function HomePage() {
    const { address, signer, sessionToken, isAuthenticated, isInitialized: web3Initialized } = useWeb3();
    const [portfolio, setPortfolio] = useState<Position[]>([]);
    const [accountDetails, setAccountDetails] = useState<any>(null);
    const [tokenizedPositions, setTokenizedPositions] = useState<TokenizedPosition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
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
            if (!sessionToken || !isAuthenticated) {
                setError("Please sign in to view your portfolio");
                setIsLoading(false);
                return;
            }
            
            // Reset error when starting fresh fetch
            setError(null);
            setIsLoading(true);

            try {
                // Prepare headers with authorization
                const headers = {
                    'Authorization': `Bearer ${sessionToken}`,
                    'Content-Type': 'application/json',
                };

                // Fetch portfolio (includes account details and positions)
                const portfolioResponse = await fetch("/api/alpaca/portfolio", { headers });

                if (!portfolioResponse.ok) {
                    const errorData = await portfolioResponse.json();
                    throw new Error(errorData.error || "Failed to fetch portfolio data");
                }

                const portfolioData = await portfolioResponse.json();

                // Set account details and positions from portfolio API
                setAccountDetails(portfolioData.account);
                setPortfolio(portfolioData.positions || []);
            } catch (err: any) {
                setError(err.message);
                console.error('Error fetching portfolio:', err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchPortfolio();
    }, [sessionToken, isAuthenticated, web3Initialized]);

    const fetchTokenizedPositions = useCallback(async () => {
        if (!sessionToken || !address) return;
        
        try {
            const response = await fetch(`/api/tokenize/positions?address=${address}`, {
                headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();
            if (data.success) {
                setTokenizedPositions(data.positions);
            }
        } catch (err) {
            console.error("Error fetching tokenized positions:", err);
        }
    }, [address, sessionToken]);

    // Fetch tokenized positions
    useEffect(() => {
        if (address && sessionToken) {
            fetchTokenizedPositions();
        }
    }, [address, sessionToken, fetchTokenizedPositions]);

    const handleTokenizeClick = (position: Position) => {
        setSelectedPosition(position);
        setTokenizeAmount("");
        setShowTokenizeModal(true);
    };

    const handleTokenize = async () => {
        if (!selectedPosition || !tokenizeAmount || !address || !signer) {
            alert("Please fill in all fields and connect wallet");
            return;
        }

        const amount = parseFloat(tokenizeAmount);
        if (amount <= 0 || amount > parseFloat(selectedPosition.qty)) {
            alert("Invalid amount");
            return;
        }

        setIsTokenizing(true);

        try {
            // Get token contract address
            const tokenSymbol = `T${selectedPosition.symbol}`;
            const tokenContractAddress = process.env[`NEXT_PUBLIC_${tokenSymbol}_ADDRESS`] || process.env.NEXT_PUBLIC_TAAPL_ADDRESS;

            if (!tokenContractAddress || tokenContractAddress === "0x0000000000000000000000000000000000000000") {
                alert(`Token contract for ${tokenSymbol} not deployed yet`);
                setIsTokenizing(false);
                return;
            }

            // Connect to token contract
            const tokenContract = new ethers.Contract(
                tokenContractAddress,
                tokenizedAssetABI,
                signer
            );

            // Convert amount to wei (assuming 18 decimals)
            const amountInWei = ethers.parseUnits(amount.toString(), 18);

            // Call mint function
            const tx = await tokenContract.mint(address, amountInWei);
            
            // Record in database
            const dbResponse = await fetch("/api/tokenize/create", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({
                    walletAddress: address,
                    symbol: selectedPosition.symbol,
                    amount,
                    txHash: tx.hash,
                }),
            });

            const dbData = await dbResponse.json();

            if (!dbData.success) {
                throw new Error(dbData.error || "Failed to record tokenization");
            }

            alert(`Tokenization initiated! TX Hash: ${tx.hash}`);

            // Wait for transaction confirmation
            const receipt = await tx.wait();

            // Update status in database
            await fetch("/api/tokenize/update-status", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({
                    positionId: dbData.positionId,
                    txHash: tx.hash,
                    status: "confirmed",
                    blockNumber: receipt.blockNumber,
                }),
            });

            alert("Tokenization confirmed!");
            
            // Refresh data
            fetchTokenizedPositions();
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

    if (error && !sessionToken) {
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
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Retry
                    </button>
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
                
                {accountDetails && (
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
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTokenizeClick(pos)}
                                                        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
                                                        disabled={!address}
                                                    >
                                                        Tokenize
                                                    </button>
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

                {/* Tokenized Positions */}
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
                                        Original Symbol
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Token Symbol
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Position
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tokenized
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Available
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {tokenizedPositions.length > 0 ? (
                                    tokenizedPositions.map((pos) => (
                                        <tr key={pos.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-gray-900">{pos.originalSymbol}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-700">{pos.tokenSymbol}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                                                {pos.alpacaPositionQty}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                                {pos.tokenizedQty}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">
                                                {pos.availableQty}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">
                                                    {pos.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <p className="text-sm text-gray-500">No tokenized positions</p>
                                            <p className="text-xs text-gray-400 mt-1">Click "Tokenize" on any position above to get started</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tokenization Modal */}
                {showTokenizeModal && selectedPosition && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                Tokenize {selectedPosition.symbol}
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Available Quantity
                                    </label>
                                    <p className="text-2xl font-semibold text-gray-900">{selectedPosition.qty}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Amount to Tokenize
                                    </label>
                                    <input
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

                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-xs text-blue-700">
                                        ℹ️ This will freeze {tokenizeAmount || '0'} shares of {selectedPosition.symbol} and mint equivalent ERC20 tokens to your wallet.
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => {
                                            setShowTokenizeModal(false);
                                            setSelectedPosition(null);
                                            setTokenizeAmount("");
                                        }}
                                        className="flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                        disabled={isTokenizing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleTokenize}
                                        disabled={isTokenizing || !tokenizeAmount || parseFloat(tokenizeAmount) <= 0}
                                        className="flex-1 px-4 py-2.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isTokenizing ? "Tokenizing..." : "Confirm"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
