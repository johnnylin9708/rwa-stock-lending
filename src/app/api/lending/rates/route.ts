/**
 * API Route: Get current interest rates for all markets
 */
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { lendingContractAddress, lendingContractABI } from "@/contracts";
import { SUPPORTED_ASSETS } from "@/lib/constants";

export async function GET() {
    try {
        const provider = new ethers.JsonRpcProvider(
            process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY"
        );
        
        const lendingContract = new ethers.Contract(
            lendingContractAddress,
            lendingContractABI,
            provider
        );
        
        // Get rates for each supported asset
        const rates = await Promise.all(
            SUPPORTED_ASSETS.map(async (asset) => {
                try {
                    const [borrowAPY, supplyAPY, market] = await Promise.all([
                        lendingContract.getBorrowAPY(asset.symbol),
                        lendingContract.getSupplyAPY(asset.symbol),
                        lendingContract.markets(asset.symbol)
                    ]);
                    
                    return {
                        assetSymbol: asset.symbol,
                        originalSymbol: asset.originalSymbol,
                        name: asset.name,
                        type: asset.type,
                        borrowAPY: parseFloat(ethers.formatUnits(borrowAPY, 18)) * 100, // Convert to percentage
                        supplyAPY: parseFloat(ethers.formatUnits(supplyAPY, 18)) * 100,
                        totalBorrows: ethers.formatUnits(market.totalBorrows, 18),
                        totalSupply: ethers.formatUnits(market.totalSupply, 18),
                        utilizationRate: market.totalSupply > 0n 
                            ? parseFloat(ethers.formatUnits(market.totalBorrows * 10000n / market.totalSupply, 2))
                            : 0,
                        collateralFactor: parseFloat(ethers.formatUnits(market.collateralFactorMantissa, 18)) * 100,
                        isListed: market.isListed
                    };
                } catch (error) {
                    console.error(`Error fetching rates for ${asset.symbol}:`, error);
                    return {
                        assetSymbol: asset.symbol,
                        originalSymbol: asset.originalSymbol,
                        name: asset.name,
                        type: asset.type,
                        borrowAPY: 0,
                        supplyAPY: 0,
                        totalBorrows: "0",
                        totalSupply: "0",
                        utilizationRate: 0,
                        collateralFactor: asset.collateralFactor * 100,
                        isListed: false
                    };
                }
            })
        );
        
        return NextResponse.json({
            rates: rates.filter(r => r !== null),
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        console.error("Error fetching interest rates:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch interest rates" },
            { status: 500 }
        );
    }
}

