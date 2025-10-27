/**
 * API Route: Mint ERC-3643 tokens to user
 * POST /api/erc3643/token/mint (Verified users can mint to themselves)
 */

import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import type { UserSchema } from "@/lib/db/schemas";
import { getSessionFromHeaders } from "@/lib/auth-helpers";
import { mintTokensToUser, checkConfiguration, getTokenBalance } from "@/lib/erc3643-client";

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = getSessionFromHeaders(request.headers);
        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized: Login required" },
                { status: 401 }
            );
        }

        // Check ERC-3643 configuration
        const config = await checkConfiguration();
        if (!config.isConfigured) {
            return NextResponse.json(
                {
                    error: "ERC-3643 not configured",
                    missingVariables: config.missingVariables
                },
                { status: 503 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { amount, symbol, stockSymbol } = body;

        if (!amount) {
            return NextResponse.json(
                { error: "amount is required" },
                { status: 400 }
            );
        }

        // Validate amount
        if (amount <= 0) {
            return NextResponse.json(
                { error: "amount must be greater than 0" },
                { status: 400 }
            );
        }

        // Get user from database
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        
        // User can only mint to themselves
        const user = await usersCollection.findOne({
            walletAddress: session.walletAddress
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found in database" },
                { status: 404 }
            );
        }

        // Check if user is verified (has Identity and is registered)
        if (!user.erc3643?.identityAddress) {
            return NextResponse.json(
                { error: "You don't have an on-chain identity. Please create one first." },
                { status: 400 }
            );
        }

        if (!user.erc3643?.isRegistered) {
            return NextResponse.json(
                { error: "Your identity is not verified. Cannot mint tokens." },
                { status: 400 }
            );
        }

        // Mint tokens to the authenticated user
        const result = await mintTokensToUser(session.walletAddress, amount);

        // Record tokenization in database
        const tokenizationCollection = db.collection("tokenizationHistory");
        const tokenizationRecord = {
            walletAddress: session.walletAddress,
            stockSymbol: stockSymbol || 'Unknown',
            tokenAddress: process.env.TOKEN_ADDRESS,
            amount,
            txHash: result.transactionHash,
            status: 'completed' as const,
            createdAt: new Date(),
        };

        const insertResult = await tokenizationCollection.insertOne(tokenizationRecord);
        console.log('Tokenization recorded:', insertResult.insertedId);

        return NextResponse.json({
            success: true,
            recipient: session.walletAddress,
            amount,
            symbol: symbol || 'RWAST',
            stockSymbol: stockSymbol || 'Unknown',
            transactionHash: result.transactionHash,
            tokenizationId: insertResult.insertedId,
            message: `Successfully minted ${amount} tokens to ${session.walletAddress}`
        });

    } catch (error: any) {
        console.error("Failed to mint tokens:", error);
        return NextResponse.json(
            { error: error.message || "Failed to mint tokens" },
            { status: 500 }
        );
    }
}

// Get user's token balance
export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const session = getSessionFromHeaders(request.headers);
        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized: Login required" },
                { status: 401 }
            );
        }

        // Check ERC-3643 configuration
        const config = await checkConfiguration();
        if (!config.isConfigured) {
            return NextResponse.json({
                success: true,
                balance: "0",
                message: "ERC-3643 not configured"
            });
        }

        // Import here to avoid circular dependency
        const balance = await getTokenBalance(session.walletAddress);
        console.log(balance)
        return NextResponse.json({
            success: true,
            ...balance
        });

    } catch (error: any) {
        console.error("Failed to get token balance:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get token balance" },
            { status: 500 }
        );
    }
}

