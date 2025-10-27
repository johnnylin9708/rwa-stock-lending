/**
 * API Route: Verify wallet signature and create session
 * Integrates with MongoDB and checks Alpaca account status
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyWalletOwnership, isValidAddress, createSessionToken, generateNonceMessage } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";

export async function POST(request: NextRequest) {
    try {
        const { address, signature } = await request.json();
        
        
        if (!address || !signature) {
            console.error('❌ [Verify] Missing fields - address:', !!address, 'signature:', !!signature);
            return NextResponse.json(
                { error: "Missing required fields (address, signature)" },
                { status: 400 }
            );
        }
        
        if (!isValidAddress(address)) {
            console.error('❌ [Verify] Invalid address format:', address);
            return NextResponse.json(
                { error: "Invalid wallet address" },
                { status: 400 }
            );
        }
        
        const normalizedAddress = address.toLowerCase();
        // Get user from database
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        
        const user = await usersCollection.findOne({ 
            walletAddress: normalizedAddress 
        });
        
        if (!user || !user.nonce) {
            console.error('❌ [Verify] No user or nonce found for:', normalizedAddress);
            return NextResponse.json(
                { error: "Please request a nonce first. Go to /api/auth/nonce first." },
                { status: 400 }
            );
        }
        
        // Recreate the message that should have been signed
        const message = generateNonceMessage(address, user.nonce);
        
        // Verify signature
        const isValid = await verifyWalletOwnership(address, signature, message);
        
        if (!isValid) {
            console.error('❌ [Verify] Signature verification failed!');
            console.error('Expected message:', message);
            console.error('Received signature:', signature);
            return NextResponse.json(
                { 
                    error: "Invalid signature. The signed message does not match.",
                    debug: {
                        expectedMessage: message,
                        receivedSignature: signature.substring(0, 20) + '...'
                    }
                },
                { status: 401 }
            );
        }
        
        // Create session token
        const sessionToken = createSessionToken(normalizedAddress, user._id?.toString());
        
        // Update user's last login and session token
        await usersCollection.updateOne(
            { walletAddress: normalizedAddress },
            { 
                $set: { 
                    lastLogin: new Date(),
                    sessionToken,
                    updatedAt: new Date()
                },
                $unset: {
                    nonce: "" // Clear the nonce after successful verification
                }
            }
        );
        
        // Log authentication activity
        const logsCollection = db.collection('activity_logs');
        await logsCollection.insertOne({
            userId: user._id?.toString(),
            walletAddress: normalizedAddress,
            action: 'USER_LOGIN',
            description: 'User authenticated via Web3 wallet signature',
            timestamp: new Date()
        });
        
        return NextResponse.json({
            success: true,
            address: normalizedAddress,
            sessionToken,
            user: {
                walletAddress: user.walletAddress,
                email: user.email,
                kycStatus: user.kycStatus,
                hasAlpacaAccount: !!user.alpacaAccount,
                alpacaAccountStatus: user.alpacaAccount?.status,
            },
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

