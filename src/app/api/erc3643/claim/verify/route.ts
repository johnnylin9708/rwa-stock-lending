/**
 * API Route: Verify user's KYC claim
 * GET /api/erc3643/claim/verify
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";
import { getSessionFromHeaders } from "@/lib/auth-helpers";
import { verifyUser, checkConfiguration } from "@/lib/erc3643-client";

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
                hasValidClaim: false,
                isRegistered: false,
                message: "ERC-3643 not configured"
            });
        }

        // Get user from database
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        
        const user = await usersCollection.findOne({
            walletAddress: session.walletAddress
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Check if user has identity
        if (!user.erc3643?.identityAddress) {
            return NextResponse.json({
                success: true,
                hasValidClaim: false,
                isRegistered: false,
                identityAddress: null,
                message: "No identity created yet"
            });
        }

        // Verify on-chain status
        const onChainStatus = await verifyUser(session.walletAddress);

        // Update local database with on-chain status
        await usersCollection.updateOne(
            { walletAddress: session.walletAddress },
            {
                $set: {
                    'erc3643.isRegistered': onChainStatus.isVerified,
                    updatedAt: new Date()
                }
            }
        );

        return NextResponse.json({
            success: true,
            hasValidClaim: onChainStatus.isVerified,
            isRegistered: onChainStatus.isVerified,
            identityAddress: user.erc3643.identityAddress,
            claims: user.erc3643.claims || [],
            message: onChainStatus.isVerified 
                ? "User is verified and can hold tokens"
                : "User is not verified yet"
        });

    } catch (error: any) {
        console.error("Failed to verify claim:", error);
        return NextResponse.json(
            { error: error.message || "Failed to verify claim" },
            { status: 500 }
        );
    }
}

