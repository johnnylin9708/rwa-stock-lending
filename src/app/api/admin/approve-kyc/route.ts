/**
 * API Route: Approve user KYC and add ERC-3643 Claim
 * POST /api/admin/approve-kyc (Admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";
import { getSessionFromHeaders } from "@/lib/auth-helpers";
import { addKYCClaimToIdentity, registerUserToRegistry, checkConfiguration } from "@/lib/erc3643-client";
import { ethers } from "ethers";

// Helper function to check if user is admin
async function isAdmin(walletAddress: string): Promise<boolean> {
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

        // Parse request body
        const body = await request.json();
        const { userId, walletAddress } = body;

        if (!userId && !walletAddress) {
            return NextResponse.json(
                { error: "userId or walletAddress is required" },
                { status: 400 }
            );
        }

        // Get user from database
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        
        const query = userId ? { _id: userId } : { walletAddress: walletAddress };
        const user = await usersCollection.findOne(query);

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Check if user has identity
        if (!user.erc3643?.identityAddress) {
            return NextResponse.json(
                { error: "User does not have an identity. Cannot add claim." },
                { status: 400 }
            );
        }

        // Check ERC-3643 configuration
        const config = await checkConfiguration();
        if (!config.isConfigured) {
            // Still update database status even if blockchain is not configured
            await usersCollection.updateOne(
                { walletAddress: user.walletAddress },
                {
                    $set: {
                        'kycStatus': 'approved',
                        'kycData.approvedAt': new Date(),
                        updatedAt: new Date()
                    }
                }
            );
            
            return NextResponse.json({
                success: true,
                message: "KYC approved in database. ERC-3643 not configured for blockchain operations.",
                blockchainEnabled: false
            });
        }

        // Step 1: Create and add KYC Claim
        const claimData = await addKYCClaimToIdentity(
            user.walletAddress,
            user.erc3643.identityAddress,
            `KYC_VERIFIED:${new Date().toISOString()}`
        );

        // Step 2: Register user to IdentityRegistry
        const country = user.erc3643.country || 158; // Default: Taiwan
        const registryResult = await registerUserToRegistry(
            user.walletAddress,
            user.erc3643.identityAddress,
            country
        );

        // Step 3: Update database
        await usersCollection.updateOne(
            { walletAddress: user.walletAddress },
            {
                $set: {
                    'kycStatus': 'approved',
                    'kycData.approvedAt': new Date(),
                    'erc3643.claims': [{
                        claimId: ethers.utils.id('KYC_VERIFIED'),
                        topic: claimData.topic,
                        issuer: claimData.issuer,
                        signature: claimData.signature,
                        data: claimData.data,
                        issuedAt: new Date(),
                        isValid: true
                    }],
                    'erc3643.isRegistered': true,
                    'erc3643.registeredAt': new Date(),
                    'erc3643.country': country,
                    updatedAt: new Date()
                }
            }
        );

        return NextResponse.json({
            success: true,
            message: "KYC approved and user registered to blockchain",
            blockchainEnabled: true,
            claim: {
                topic: claimData.topic,
                issuer: claimData.issuer,
            },
            registry: {
                transactionHash: registryResult.transactionHash,
                alreadyRegistered: registryResult.alreadyRegistered
            }
        });

    } catch (error: any) {
        console.error("Failed to approve KYC:", error);
        return NextResponse.json(
            { error: error.message || "Failed to approve KYC" },
            { status: 500 }
        );
    }
}

// Get list of pending KYC applications
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

        // Check if user is admin
        const isUserAdmin = await isAdmin(session.walletAddress);
        if (!isUserAdmin) {
            return NextResponse.json(
                { error: "Forbidden: Admin access required" },
                { status: 403 }
            );
        }

        // Get pending users
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        
        const pendingUsers = await usersCollection
            .find({
                kycStatus: { $in: ['pending', 'not_started'] },
                'kycData': { $exists: true }
            })
            .sort({ 'kycData.submittedAt': -1 })
            .limit(50)
            .toArray();

        return NextResponse.json({
            success: true,
            count: pendingUsers.length,
            users: pendingUsers.map(user => ({
                _id: user._id,
                walletAddress: user.walletAddress,
                email: user.email,
                kycStatus: user.kycStatus,
                fullName: `${user.kycData?.givenName} ${user.kycData?.familyName}`,
                submittedAt: user.kycData?.submittedAt,
                hasIdentity: !!user.erc3643?.identityAddress,
                identityAddress: user.erc3643?.identityAddress,
                isRegistered: user.erc3643?.isRegistered || false
            }))
        });

    } catch (error: any) {
        console.error("Failed to get pending KYC:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get pending KYC" },
            { status: 500 }
        );
    }
}

