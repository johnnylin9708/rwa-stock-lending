/**
 * API Route: Create OnchainID Identity for authenticated user
 * POST /api/erc3643/identity/create
 */

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";
import { getSessionFromHeaders } from "@/lib/auth-helpers";
import { 
    createIdentityForUser, 
    addKYCClaimToIdentity, 
    registerUserToRegistry,
    deleteIdentityFromRegistry,
    updateIdentityInRegistry,
    checkConfiguration 
} from "@/lib/erc3643-client";
import { ethers } from "ethers";

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

        // Parse request body for options
        let recreate = false;
        try {
            const body = await request.json();
            recreate = body.recreate === true;
        } catch {
            // No body or invalid JSON, continue with default
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

        // If recreate flag is set, delete old identity
        if (recreate) {
            console.log('Recreate flag set, deleting old identity...');
            
            try {
                // Delete from IdentityRegistry
                await deleteIdentityFromRegistry(session.walletAddress);
                console.log('Old identity deleted from registry');
                
                // Clear from database
                await usersCollection.updateOne(
                    { walletAddress: session.walletAddress },
                    {
                        $unset: {
                            'erc3643.identityAddress': '',
                            'erc3643.identityCreatedAt': '',
                            'erc3643.claims': '',
                            'erc3643.isRegistered': '',
                            'erc3643.registeredAt': ''
                        },
                        $set: { updatedAt: new Date() }
                    }
                );
                console.log('Old identity cleared from database');
            } catch (error: any) {
                console.warn('Failed to delete old identity:', error.message);
                // Continue anyway - will try to create new one
            }
        }

        // Check if user already has an identity
        if (user.erc3643?.identityAddress && !recreate) {
            // If identity exists but not registered, complete the verification
            if (!user.erc3643.isRegistered) {
                console.log('Legacy account with unverified identity, completing verification...');
                
                try {
                    // Add KYC Claim to existing Identity
                    const claimData = await addKYCClaimToIdentity(
                        session.walletAddress,
                        user.erc3643.identityAddress,
                        `KYC_VERIFIED:${new Date().toISOString()}`
                    );
                    console.log('KYC Claim added to existing identity:', claimData);

                    // Register to IdentityRegistry
                    const country = user.kycData?.country || 158;
                    const registryResult = await registerUserToRegistry(
                        session.walletAddress,
                        user.erc3643.identityAddress,
                        country
                    );
                    console.log('Existing identity registered to Registry:', registryResult);

                    // Update database
                    await usersCollection.updateOne(
                        { walletAddress: session.walletAddress },
                        {
                            $set: {
                                'erc3643.claims': [{
                                    claimId: ethers.id('KYC_VERIFIED'),
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
                                'kycStatus': 'approved',
                                'kycData.approvedAt': new Date(),
                                updatedAt: new Date()
                            }
                        }
                    );

                    return NextResponse.json({
                        success: true,
                        identityAddress: user.erc3643.identityAddress,
                        isNew: false,
                        isRegistered: true,
                        kycStatus: 'approved',
                        claim: {
                            topic: claimData.topic,
                            issuer: claimData.issuer
                        },
                        registry: {
                            transactionHash: registryResult.transactionHash,
                            country: country
                        },
                        message: "Existing identity verified successfully"
                    });
                } catch (error: any) {
                    console.error('Failed to verify existing identity:', error);
                    // Return existing identity info even if verification failed
                    return NextResponse.json({
                        success: true,
                        identityAddress: user.erc3643.identityAddress,
                        isRegistered: false,
                        message: "Identity exists but verification failed: " + error.message,
                        isNew: false,
                        error: error.message
                    });
                }
            }
            
            // Identity already verified
            return NextResponse.json({
                success: true,
                identityAddress: user.erc3643.identityAddress,
                isRegistered: true,
                message: "Identity already verified",
                isNew: false
            });
        }

        console.log('Creating identity for user:', session.walletAddress);

        // Step 1: Create identity on blockchain
        const identityResult = await createIdentityForUser(session.walletAddress);
        console.log('✓ Step 1/3: Identity created:', identityResult.identityAddress);

        // Step 2: Register to IdentityRegistry (MUST be before adding claims!)
        // 参考 transfer-test.ts: 先注册，后添加 Claims
        const country = user.kycData?.country || 158; // Default: Taiwan (158)
        const registryResult = await registerUserToRegistry(
            session.walletAddress,
            identityResult.identityAddress,
            country
        );
        console.log('✓ Step 2/3: User registered to Registry:', registryResult);

        // Step 3: Add KYC Claim (MUST be after registry registration!)
        const claimData = await addKYCClaimToIdentity(
            session.walletAddress,
            identityResult.identityAddress,
            `KYC_VERIFIED:${new Date().toISOString()}`
        );
        console.log('✓ Step 3/3: KYC Claim added:', claimData);

        // Step 4: Update database with complete verification
        await usersCollection.updateOne(
            { walletAddress: session.walletAddress },
            {
                $set: {
                    // Identity info
                    'erc3643.identityAddress': identityResult.identityAddress,
                    'erc3643.identityCreatedAt': new Date(),
                    
                    // Claim info
                    'erc3643.claims': [{
                        claimId: ethers.id('KYC_VERIFIED'),
                        topic: claimData.topic,
                        issuer: claimData.issuer,
                        signature: claimData.signature,
                        data: claimData.data,
                        issuedAt: new Date(),
                        isValid: true
                    }],
                    
                    // Registry info
                    'erc3643.isRegistered': true,
                    'erc3643.registeredAt': new Date(),
                    'erc3643.country': country,
                    
                    // KYC status - auto approve
                    'kycStatus': 'approved',
                    'kycData.approvedAt': new Date(),
                    
                    updatedAt: new Date()
                }
            }
        );

        console.log('Database updated with verified status');

        return NextResponse.json({
            success: true,
            identityAddress: identityResult.identityAddress,
            transactionHash: identityResult.transactionHash,
            isNew: identityResult.isNew,
            isRegistered: true,
            kycStatus: 'approved',
            claim: {
                topic: claimData.topic,
                issuer: claimData.issuer
            },
            registry: {
                transactionHash: registryResult.transactionHash,
                country: country
            },
            message: "Identity created and auto-verified successfully"
        });

    } catch (error: any) {
        console.error("Failed to create identity:", error);
        return NextResponse.json(
            {
                error: error.message || "Failed to create identity",
                details: error.toString()
            },
            { status: 500 }
        );
    }
}

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

        return NextResponse.json({
            success: true,
            erc3643: user.erc3643 || {
                identityAddress: null,
                claims: [],
                isRegistered: false
            }
        });

    } catch (error: any) {
        console.error("Failed to get identity:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get identity" },
            { status: 500 }
        );
    }
}

