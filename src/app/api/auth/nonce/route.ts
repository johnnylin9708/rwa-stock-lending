/**
 * API Route: Generate nonce for wallet authentication
 * Optional endpoint for enhanced security
 */
import { NextRequest, NextResponse } from "next/server";
import { generateNonce, isValidAddress } from "@/lib/auth-helpers";

// In-memory storage for nonces (use Redis in production)
const nonceStore = new Map<string, { nonce: string; timestamp: number }>();

// Clean up expired nonces (older than 5 minutes)
function cleanupExpiredNonces() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [address, data] of nonceStore.entries()) {
        if (data.timestamp < fiveMinutesAgo) {
            nonceStore.delete(address);
        }
    }
}

export async function POST(request: NextRequest) {
    try {
        const { address } = await request.json();
        
        if (!address || !isValidAddress(address)) {
            return NextResponse.json(
                { error: "Invalid wallet address" },
                { status: 400 }
            );
        }
        
        // Clean up old nonces
        cleanupExpiredNonces();
        
        // Generate new nonce
        const nonce = generateNonce();
        nonceStore.set(address.toLowerCase(), {
            nonce,
            timestamp: Date.now()
        });
        
        return NextResponse.json({
            nonce,
            message: `Sign this message to authenticate: ${nonce}`
        });
        
    } catch (error: any) {
        console.error("Error generating nonce:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate nonce" },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get("address");
        
        if (!address || !isValidAddress(address)) {
            return NextResponse.json(
                { error: "Invalid wallet address" },
                { status: 400 }
            );
        }
        
        const data = nonceStore.get(address.toLowerCase());
        
        if (!data) {
            return NextResponse.json(
                { error: "No nonce found for this address" },
                { status: 404 }
            );
        }
        
        // Check if nonce is expired
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (data.timestamp < fiveMinutesAgo) {
            nonceStore.delete(address.toLowerCase());
            return NextResponse.json(
                { error: "Nonce expired" },
                { status: 404 }
            );
        }
        
        return NextResponse.json({ nonce: data.nonce });
        
    } catch (error: any) {
        console.error("Error retrieving nonce:", error);
        return NextResponse.json(
            { error: error.message || "Failed to retrieve nonce" },
            { status: 500 }
        );
    }
}

