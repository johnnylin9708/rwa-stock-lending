/**
 * API Route: Get current prices for all supported assets
 */
import { NextResponse } from "next/server";
import { getLatestPrices } from "@/lib/alpaca-client";
import { SUPPORTED_ASSETS } from "@/lib/constants";

export async function GET() {
    try {
        // Get all original symbols (non-tokenized)
        const symbols = SUPPORTED_ASSETS
            .filter(asset => asset.type === "STOCK")
            .map(asset => asset.originalSymbol);
        
        // Fetch prices from Alpaca
        const prices = await getLatestPrices(symbols);
        
        // Map to tokenized symbols
        const priceData = SUPPORTED_ASSETS.map(asset => {
            if (asset.type === "STOCK") {
                return {
                    symbol: asset.symbol,
                    originalSymbol: asset.originalSymbol,
                    name: asset.name,
                    type: asset.type,
                    price: prices[asset.originalSymbol] || 0,
                    timestamp: new Date().toISOString()
                };
            } else {
                // For bonds, use mock data or another API
                return {
                    symbol: asset.symbol,
                    originalSymbol: asset.originalSymbol,
                    name: asset.name,
                    type: asset.type,
                    price: 100, // Mock bond price
                    timestamp: new Date().toISOString()
                };
            }
        });
        
        return NextResponse.json({
            prices: priceData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error: any) {
        console.error("Error fetching prices:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch prices" },
            { status: 500 }
        );
    }
}

/**
 * Get price for a specific symbol
 */
export async function POST(request: Request) {
    try {
        const { symbol } = await request.json();
        
        if (!symbol) {
            return NextResponse.json(
                { error: "Symbol is required" },
                { status: 400 }
            );
        }
        
        // Find the asset
        const asset = SUPPORTED_ASSETS.find(
            a => a.symbol === symbol || a.originalSymbol === symbol
        );
        
        if (!asset) {
            return NextResponse.json(
                { error: "Asset not found" },
                { status: 404 }
            );
        }
        
        if (asset.type === "STOCK") {
            const prices = await getLatestPrices([asset.originalSymbol]);
            return NextResponse.json({
                symbol: asset.symbol,
                originalSymbol: asset.originalSymbol,
                price: prices[asset.originalSymbol] || 0,
                timestamp: new Date().toISOString()
            });
        } else {
            // Mock bond price
            return NextResponse.json({
                symbol: asset.symbol,
                originalSymbol: asset.originalSymbol,
                price: 100,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error: any) {
        console.error("Error fetching price:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch price" },
            { status: 500 }
        );
    }
}

