/**
 * API Route: Get transaction history for lending activities
 */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { lendingContractAddress, lendingContractABI } from "@/contracts";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const walletAddress = searchParams.get("address");
        
        if (!walletAddress) {
            return NextResponse.json(
                { error: "Wallet address is required" },
                { status: 400 }
            );
        }
        
        // Connect to contract
        const provider = new ethers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY"
        );
        
        const lendingContract = new ethers.Contract(
            lendingContractAddress,
            lendingContractABI,
            provider
        );
        
        // Get events for this user
        // Note: In production, you'd want to use a proper indexer or database
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10k blocks
        
        const [
            depositEvents,
            withdrawEvents,
            borrowEvents,
            repayEvents,
            liquidationEvents
        ] = await Promise.all([
            lendingContract.queryFilter(
                lendingContract.filters.CollateralDeposited(walletAddress),
                fromBlock
            ),
            lendingContract.queryFilter(
                lendingContract.filters.CollateralWithdrawn(walletAddress),
                fromBlock
            ),
            lendingContract.queryFilter(
                lendingContract.filters.Borrowed(walletAddress),
                fromBlock
            ),
            lendingContract.queryFilter(
                lendingContract.filters.Repaid(walletAddress),
                fromBlock
            ),
            lendingContract.queryFilter(
                lendingContract.filters.Liquidated(null, walletAddress),
                fromBlock
            )
        ]);
        
        // Format events
        const transactions = [
            ...depositEvents.map(e => ({
                type: "DEPOSIT",
                assetSymbol: e.args?.assetSymbol || "",
                amount: ethers.formatUnits(e.args?.amount || 0, 18),
                txHash: e.transactionHash,
                blockNumber: e.blockNumber,
                timestamp: null // Would need to fetch block timestamp
            })),
            ...withdrawEvents.map(e => ({
                type: "WITHDRAW",
                assetSymbol: e.args?.assetSymbol || "",
                amount: ethers.formatUnits(e.args?.amount || 0, 18),
                txHash: e.transactionHash,
                blockNumber: e.blockNumber,
                timestamp: null
            })),
            ...borrowEvents.map(e => ({
                type: "BORROW",
                assetSymbol: e.args?.assetSymbol || "",
                amount: ethers.formatUnits(e.args?.amount || 0, 18),
                txHash: e.transactionHash,
                blockNumber: e.blockNumber,
                timestamp: null
            })),
            ...repayEvents.map(e => ({
                type: "REPAY",
                assetSymbol: e.args?.assetSymbol || "",
                amount: ethers.formatUnits(e.args?.amount || 0, 18),
                txHash: e.transactionHash,
                blockNumber: e.blockNumber,
                timestamp: null
            })),
            ...liquidationEvents.map(e => ({
                type: "LIQUIDATION",
                assetSymbol: e.args?.assetSymbol || "",
                amount: ethers.formatUnits(e.args?.amount || 0, 18),
                txHash: e.transactionHash,
                blockNumber: e.blockNumber,
                timestamp: null,
                liquidator: e.args?.liquidator
            }))
        ];
        
        // Sort by block number (most recent first)
        transactions.sort((a, b) => b.blockNumber - a.blockNumber);
        
        return NextResponse.json({
            walletAddress,
            transactions,
            count: transactions.length
        });
        
    } catch (error: any) {
        console.error("Error fetching transaction history:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch transaction history" },
            { status: 500 }
        );
    }
}

