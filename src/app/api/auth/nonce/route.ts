/**
 * API Route: Generate nonce for wallet authentication
 * Stores nonce in MongoDB for secure authentication flow
 */
import { NextRequest, NextResponse } from "next/server";
import { generateNonce, generateNonceMessage, isValidAddress } from "@/lib/auth-helpers";
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";

export async function POST(request: NextRequest) {
    try {
        const { address } = await request.json();
        
        if (!address || !isValidAddress(address)) {
            return NextResponse.json(
                { error: "Invalid wallet address" },
                { status: 400 }
            );
        }
        
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        
        // Generate new nonce
        const nonce = generateNonce();
        const normalizedAddress = address.toLowerCase();
        
        // Check if user exists, if not create a basic record
        const existingUser = await usersCollection.findOne({ 
            walletAddress: normalizedAddress 
        });
        
        if (existingUser) {
            // Update nonce for existing user
            await usersCollection.updateOne(
                { walletAddress: normalizedAddress },
                { 
                    $set: { 
                        nonce,
                        updatedAt: new Date()
                    } 
                }
            );
        } else {
            // Create new user with nonce
            await usersCollection.insertOne({
                walletAddress: normalizedAddress,
                email: '', // Will be filled during registration
                nonce,
                kycStatus: 'not_started',
                createdAt: new Date(),
                updatedAt: new Date()
            } as UserSchema);
        }
        
        // Generate the message to sign
        const message = generateNonceMessage(address, nonce);
        
        return NextResponse.json({
            nonce,
            message,
            address: normalizedAddress
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
        
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        
        const user = await usersCollection.findOne({ 
            walletAddress: address.toLowerCase() 
        });
        
        if (!user || !user.nonce) {
            return NextResponse.json(
                { error: "No nonce found for this address. Please request a new nonce." },
                { status: 404 }
            );
        }
        
        // Generate the message to sign with the stored nonce
        const message = generateNonceMessage(address, user.nonce);
        
        return NextResponse.json({ 
            nonce: user.nonce,
            message
        });
        
    } catch (error: any) {
        console.error("Error retrieving nonce:", error);
        return NextResponse.json(
            { error: error.message || "Failed to retrieve nonce" },
            { status: 500 }
        );
    }
}

