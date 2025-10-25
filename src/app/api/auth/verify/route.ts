/**
 * API Route: Verify wallet signature
 * Optional endpoint for enhanced authentication
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyWalletOwnership, isValidAddress, createSessionToken } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
    try {
        const { address, signature, message } = await request.json();
        
        if (!address || !signature || !message) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }
        
        if (!isValidAddress(address)) {
            return NextResponse.json(
                { error: "Invalid wallet address" },
                { status: 400 }
            );
        }
        
        // Verify signature
        const isValid = await verifyWalletOwnership(address, signature, message);
        
        if (!isValid) {
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 401 }
            );
        }
        
        // Create session token (optional)
        const sessionToken = createSessionToken(address);
        
        return NextResponse.json({
            success: true,
            address,
            sessionToken,
            message: "Authentication successful"
        });
        
    } catch (error: any) {
        console.error("Error verifying signature:", error);
        return NextResponse.json(
            { error: error.message || "Failed to verify signature" },
            { status: 500 }
        );
    }
}

