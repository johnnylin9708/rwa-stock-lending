'use server'
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";
import { addKYCClaimToIdentity, checkConfiguration, createIdentityForUser, deleteIdentityFromRegistry, getTokenBalance, mintTokensToUser, registerUserToRegistry } from "@/lib/erc3643-client";
import { ethers } from "ethers";

export async function getIdentity(walletAddress: string) {
    const db = await getDatabase();
    const usersCollection = db.collection<UserSchema>('users');
    
    const user = await usersCollection.findOne({
        walletAddress
    });

    if (!user) {
        return null;
    }

    return user.erc3643 || {
        identityAddress: '',
        claims: [],
        isRegistered: false
    }
}

export async function getTokenizedStockBalance(walletAddress: string) {
    const config = await checkConfiguration();
    if (!config.isConfigured) {
        throw new Error("ERC-3643 not configured");
    }

    return await getTokenBalance(walletAddress)
}

export async function mintTStockToUser(walletAddress: string, amount: number, symbol: string, stockSymbol: string) {
    // Check ERC-3643 configuration
    const config = await checkConfiguration();
    if (!config.isConfigured) {
        throw new Error("ERC-3643 not configured")
    }

    if (!amount) {
        throw new Error("amount is required")
    }

    // Validate amount
    if (amount <= 0) {
        throw new Error("amount must be greater than 0")
    }

    // Get user from database
    const db = await getDatabase();
    const usersCollection = db.collection<UserSchema>('users');
    
    // User can only mint to themselves
    const user = await usersCollection.findOne({
        walletAddress: walletAddress
    });

    if (!user) {
        throw new Error("User not found in database")
    }

    // Check if user is verified (has Identity and is registered)
    if (!user.erc3643?.identityAddress) {
        throw new Error("You don't have an on-chain identity. Please create one first.")
    }

    if (!user.erc3643?.isRegistered) {
        throw new Error("Your identity is not verified. Cannot mint tokens.")
    }

    // Mint tokens to the authenticated user
    const result = await mintTokensToUser(walletAddress, amount);

    // Record tokenization in database
    const tokenizationCollection = db.collection("tokenizationHistory");
    const tokenizationRecord = {
        walletAddress: walletAddress,
        stockSymbol: stockSymbol || 'Unknown',
        tokenAddress: process.env.TOKEN_ADDRESS,
        amount,
        txHash: result.transactionHash,
        status: 'completed' as const,
        createdAt: new Date(),
    };

    const insertResult = await tokenizationCollection.insertOne(tokenizationRecord);
    console.log('Tokenization recorded:', insertResult.insertedId);

    return {
        success: true,
        recipient: walletAddress,
        amount,
        symbol: symbol || 'RWAST',
        stockSymbol: stockSymbol || 'Unknown',
        transactionHash: result.transactionHash,
        tokenizationId: insertResult.insertedId,
        message: `Successfully minted ${amount} tokens to ${walletAddress}`
    }
}

export async function createIdentity(walletAddress: string, recreate: boolean = false) {

    // Get user from database
    const db = await getDatabase();
    const usersCollection = db.collection<UserSchema>('users');
    
    const user = await usersCollection.findOne({
        walletAddress
    });

    if (!user) {
        throw new Error("User not found");
    }

    // If recreate flag is set, delete old identity
    if (recreate) {
        console.log('Recreate flag set, deleting old identity...');
        
        try {
            // Delete from IdentityRegistry
            await deleteIdentityFromRegistry(walletAddress);
            console.log('Old identity deleted from registry');
            
            // Clear from database
            await usersCollection.updateOne(
                { walletAddress },
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
                    walletAddress,
                    user.erc3643.identityAddress,
                    `KYC_VERIFIED:${new Date().toISOString()}`
                );
                console.log('KYC Claim added to existing identity:', claimData);

                // Register to IdentityRegistry
                const country = user.kycData?.country || 158;
                const registryResult = await registerUserToRegistry(
                    walletAddress,
                    user.erc3643.identityAddress,
                    country
                );
                console.log('Existing identity registered to Registry:', registryResult);

                // Update database
                await usersCollection.updateOne(
                    { walletAddress },
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

                return {
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
                }
            } catch (error: any) {
                console.error('Failed to verify existing identity:', error);
                // Return existing identity info even if verification failed
                return {
                    success: true,
                    identityAddress: user.erc3643.identityAddress,
                    isRegistered: false,
                    message: "Identity exists but verification failed: " + error.message,
                    isNew: false,
                    error: error.message
                }
            }
        }
        
        // Identity already verified
        return {
            success: true,
            identityAddress: user.erc3643.identityAddress,
            isRegistered: true,
            message: "Identity already verified",
            isNew: false
        }
    }

    console.log('Creating identity for user:', walletAddress);

    // Step 1: Create identity on blockchain
    const identityResult = await createIdentityForUser(walletAddress);
    console.log('✓ Step 1/3: Identity created:', identityResult.identityAddress);

    // Step 2: Register to IdentityRegistry (MUST be before adding claims!)
    // 参考 transfer-test.ts: 先注册，后添加 Claims
    const country = user.kycData?.country || 158; // Default: Taiwan (158)
    const registryResult = await registerUserToRegistry(
        walletAddress,
        identityResult.identityAddress,
        country
    );
    console.log('✓ Step 2/3: User registered to Registry:', registryResult);

    // Step 3: Add KYC Claim (MUST be after registry registration!)
    const claimData = await addKYCClaimToIdentity(
        walletAddress,
        identityResult.identityAddress,
        `KYC_VERIFIED:${new Date().toISOString()}`
    );
    console.log('✓ Step 3/3: KYC Claim added:', claimData);

    // Step 4: Update database with complete verification
    await usersCollection.updateOne(
        { walletAddress },
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

    return {
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
    }
}