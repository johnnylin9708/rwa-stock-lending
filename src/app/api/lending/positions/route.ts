/**
 * API Route: Get lending positions for a user
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
        
        // Connect to contract (read-only)
        const provider = new ethers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY"
        );
        
        const lendingContract = new ethers.Contract(
            lendingContractAddress,
            lendingContractABI,
            provider
        );
        
        // Get user's positions
        const [
            totalCollateralValue,
            totalBorrowValue,
            borrowingPower,
            healthFactor
        ] = await Promise.all([
            lendingContract.getTotalCollateralValue(walletAddress),
            lendingContract.getTotalBorrowValue(walletAddress),
            lendingContract.getBorrowingPower(walletAddress),
            lendingContract.getAccountHealth(walletAddress)
        ]);
        
        // Get positions for each asset
        const assets = ["TAAPL", "TGOOGL", "TTSLA"]; // TODO: Get from config
        const positions = await Promise.all(
            assets.map(async (assetSymbol) => {
                try {
                    const account = await lendingContract.accounts(walletAddress, assetSymbol);
                    const market = await lendingContract.markets(assetSymbol);
                    
                    return {
                        assetSymbol,
                        collateral: ethers.formatUnits(account.collateral, 18),
                        borrowed: ethers.formatUnits(account.borrowed, 18),
                        borrowIndex: ethers.formatUnits(account.borrowIndex, 18),
                        isListed: market.isListed
                    };
                } catch (error) {
                    console.error(`Error fetching position for ${assetSymbol}:`, error);
                    return null;
                }
            })
        );
        
        return NextResponse.json({
            walletAddress,
            totalCollateralValue: ethers.formatUnits(totalCollateralValue, 18),
            totalBorrowValue: ethers.formatUnits(totalBorrowValue, 18),
            borrowingPower: ethers.formatUnits(borrowingPower, 18),
            healthFactor: healthFactor.toString() === ethers.MaxUint256.toString() 
                ? "∞" 
                : ethers.formatUnits(healthFactor, 18),
            positions: positions.filter(p => p !== null && p.isListed)
        });
        
    } catch (error: any) {
        console.error("Error fetching lending positions:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch lending positions" },
            { status: 500 }
        );
    }
}

