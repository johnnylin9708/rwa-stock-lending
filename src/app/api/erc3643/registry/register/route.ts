/**
 * API Route: Register user to IdentityRegistry
 * POST /api/erc3643/registry/register (Admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";
import { getSessionFromHeaders } from "@/lib/auth-helpers";
import { registerUserToRegistry, checkConfiguration } from "@/lib/erc3643-client";

// Helper function to check if user is admin
async function isAdmin(walletAddress: string): Promise<boolean> {
    // TODO: Implement proper admin check
    // For now, check against environment variable
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(a => a.toLowerCase());
    return adminAddresses.includes(walletAddress.toLowerCase());
}

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

        // Check if user is admin
        const isUserAdmin = await isAdmin(session.walletAddress);
        if (!isUserAdmin) {
            return NextResponse.json(
                { error: "Forbidden: Admin access required" },
                { status: 403 }
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
        const { walletAddress, country } = body;

        if (!walletAddress) {
            return NextResponse.json(
                { error: "walletAddress is required" },
                { status: 400 }
            );
        }

        // Get user from database
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        
        const user = await usersCollection.findOne({
            walletAddress: walletAddress
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Check if user has identity
        if (!user.erc3643?.identityAddress) {
            return NextResponse.json(
                { error: "User does not have an identity. Create identity first." },
                { status: 400 }
            );
        }

        // Check if user has valid claims
        const hasValidClaims = user.erc3643.claims && user.erc3643.claims.length > 0;
        if (!hasValidClaims) {
            return NextResponse.json(
                { error: "User does not have valid claims. Add claims first." },
                { status: 400 }
            );
        }

        // Register to IdentityRegistry
        const countryCode = country || user.erc3643.country || 158; // Default: Taiwan
        const result = await registerUserToRegistry(
            walletAddress,
            user.erc3643.identityAddress,
            countryCode
        );

        // Update database
        await usersCollection.updateOne(
            { walletAddress: walletAddress },
            {
                $set: {
                    'erc3643.isRegistered': true,
                    'erc3643.registeredAt': new Date(),
                    'erc3643.country': countryCode,
                    'kycStatus': 'approved',
                    'kycData.approvedAt': new Date(),
                    updatedAt: new Date()
                }
            }
        );

        return NextResponse.json({
            success: true,
            transactionHash: result.transactionHash,
            alreadyRegistered: result.alreadyRegistered,
            message: result.alreadyRegistered 
                ? "User already registered"
                : "User registered successfully to IdentityRegistry"
        });

    } catch (error: any) {
        console.error("Failed to register user:", error);
        return NextResponse.json(
            { error: error.message || "Failed to register user" },
            { status: 500 }
        );
    }
}

