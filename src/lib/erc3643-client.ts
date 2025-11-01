/**
 * ERC-3643 Smart Contract Client
 * Handles interactions with T-REX token suite and OnchainID
 */

import { ethers } from 'ethers';
import OnchainID from '@onchain-id/solidity';

// Environment variables - these should be set after deployment
const IDENTITY_FACTORY_ADDRESS = process.env.IDENTITY_FACTORY_ADDRESS!;
const IDENTITY_IMPLEMENTATION_AUTHORITY = process.env.IDENTITY_IMPLEMENTATION_AUTHORITY!;
const CLAIM_ISSUER_CONTRACT = process.env.CLAIM_ISSUER_CONTRACT!;
const CLAIM_ISSUER_SIGNING_KEY = process.env.CLAIM_ISSUER_SIGNING_KEY!;
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS!;
const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY!;
const TOKEN_AGENT_PRIVATE_KEY = process.env.TOKEN_AGENT_PRIVATE_KEY!;
const KYC_CLAIM_TOPIC = process.env.KYC_CLAIM_TOPIC!;
const RPC_URL = process.env.ETHEREUM_RPC_URL!;

// Initialize provider and wallet
function getProvider() {
    return new ethers.JsonRpcProvider(RPC_URL);
}

function getTokenAgentWallet() {
    const provider = getProvider();
    return new ethers.Wallet(TOKEN_AGENT_PRIVATE_KEY, provider);
}

function getClaimIssuerWallet() {
    const provider = getProvider();
    return new ethers.Wallet(CLAIM_ISSUER_SIGNING_KEY, provider);
}

/**
 * Create OnchainID Identity for a user using IdentityProxy
 * This is the correct way to create identities that will pass isVerified checks
 */
export async function createIdentityForUser(userWalletAddress: string) {
    try {
        const wallet = getTokenAgentWallet();
        
        // First, check if identity already exists in IdentityRegistry
        const identityRegistry = new ethers.Contract(
            IDENTITY_REGISTRY,
            [
                'function identity(address _userAddress) external view returns (address)',
                'function isVerified(address _userAddress) external view returns (bool)'
            ],
            wallet
        );
        
        const existingIdentity = await identityRegistry.identity(userWalletAddress);
        
        if (existingIdentity !== ethers.ZeroAddress) {
            console.log('Identity already exists for user:', existingIdentity);
            const isVerified = await identityRegistry.isVerified(userWalletAddress);
            console.log('Is verified:', isVerified);
            return {
                identityAddress: existingIdentity,
                isNew: false,
                isVerified
            };
        }
        
        // Create new identity using IdentityProxy (correct method)
        console.log('Creating IdentityProxy with ImplementationAuthority:', IDENTITY_IMPLEMENTATION_AUTHORITY);
        console.log('User wallet address:', userWalletAddress);
        
        const identityProxyFactory = new ethers.ContractFactory(
            OnchainID.contracts.IdentityProxy.abi,
            OnchainID.contracts.IdentityProxy.bytecode,
            wallet
        );
        
        // ⚠️ SOLUTION: Deploy with TOKENAGENT as initialManagementKey
        // This gives TokenAgent permission to add claims
        // Then we'll add user as another MANAGEMENT_KEY so they have control too
        const identityProxy = await identityProxyFactory.deploy(
            IDENTITY_IMPLEMENTATION_AUTHORITY,
            wallet.address  // ← TOKENAGENT is initial management key (can add claims)
        );
        
        await identityProxy.waitForDeployment();
        const identityAddress = await identityProxy.getAddress();
        
        console.log('✓ Identity created:', identityAddress);
        console.log('  Initial Management Key:', wallet.address, '(TokenAgent)');
        
        // Now add user as MANAGEMENT_KEY so they also have control
        try {
            const identity = new ethers.Contract(
                identityAddress,
                OnchainID.contracts.Identity.abi,
                wallet  // TokenAgent has permission
            );
            
            const MANAGEMENT_KEY = 1;
            const userKeyHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['address'],
                    [userWalletAddress]
                )
            );
            
            console.log('  Adding user as MANAGEMENT_KEY:', userWalletAddress);
            const addKeyTx = await identity.addKey(
                userKeyHash,
                MANAGEMENT_KEY,
                1  // key type: ECDSA
            );
            await addKeyTx.wait();
            console.log('✓ User added as MANAGEMENT_KEY - user can now control their identity');
        } catch (keyError: any) {
            console.warn('⚠️  Warning: Could not add user as MANAGEMENT_KEY:', keyError.message);
        }
        
        console.log('✓ Identity setup complete');
        
        return {
            identityAddress,
            transactionHash: identityProxy.deploymentTransaction()?.hash,
            isNew: true,
            isVerified: false // Not yet verified, needs claims and registry registration
        };
    } catch (error: any) {
        console.error('Failed to create identity:', error);
        throw new Error(`Identity creation failed: ${error.message}`);
    }
}

/**
 * Get user's Identity address
 */
export async function getUserIdentity(userWalletAddress: string) {
    try {
        const provider = getProvider();
        
        const identityFactory = new ethers.Contract(
            IDENTITY_FACTORY_ADDRESS,
            OnchainID.contracts.Factory.abi,
            provider
        );
        
        const identityAddress = await identityFactory.getIdentity(userWalletAddress);
        
        if (identityAddress === ethers.ZeroAddress) {
            return null;
        }
        
        return identityAddress;
    } catch (error: any) {
        console.error('Failed to get identity:', error);
        throw new Error(`Get identity failed: ${error.message}`);
    }
}

/**
 * Add KYC Claim to user's Identity
 * Note: The TokenAgent must have MANAGEMENT_KEY permission on the identity,
 * OR we can add the claim as the identity owner would
 */
export async function addKYCClaimToIdentity(
    userWalletAddress: string,
    identityAddress: string,
    claimData: string = 'KYC_VERIFIED'
) {
    try {
        const claimIssuerWallet = getClaimIssuerWallet();
        const tokenAgentWallet = getTokenAgentWallet();
        
        // Prepare claim data
        const data = ethers.hexlify(ethers.toUtf8Bytes(claimData));
        
        // Sign the claim (must match transfer-test.ts format)
        const toSign = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'uint256', 'bytes'],
                [identityAddress, KYC_CLAIM_TOPIC, data]
            )
        );
        const signature = await claimIssuerWallet.signMessage(ethers.toBeArray(toSign));
        
        console.log('Adding claim with:', {
            topic: KYC_CLAIM_TOPIC,
            issuer: CLAIM_ISSUER_CONTRACT,
            identity: identityAddress,
            data
        });
        
        // Get user's identity contract connected with TokenAgent wallet
        // The TokenAgent will attempt to add the claim
        const userIdentity = new ethers.Contract(
            identityAddress,
            OnchainID.contracts.Identity.abi,
            tokenAgentWallet  // Use TokenAgent to add claim
        );
        
        // Actually add the claim to the identity (this is what was missing!)
        const tx = await userIdentity.addClaim(
            KYC_CLAIM_TOPIC,    // topic
            1,                  // scheme (ECDSA)
            CLAIM_ISSUER_CONTRACT,  // issuer
            signature,          // signature
            data,              // data
            ''                 // uri (empty)
        );
        
        const receipt = await tx.wait();
        console.log('Claim added to identity:', receipt.transactionHash);
        
        return {
            topic: KYC_CLAIM_TOPIC,
            scheme: 1,
            issuer: CLAIM_ISSUER_CONTRACT,
            signature,
            data,
            uri: '',
            transactionHash: receipt.transactionHash
        };
    } catch (error: any) {
        console.error('Failed to add KYC claim:', error);
        
        // If error is about permissions, provide helpful message
        if (error.message && error.message.includes('Permissions')) {
            throw new Error(
                `Permission denied: TokenAgent cannot add claim to this identity. ` +
                `The identity owner (${userWalletAddress}) must add the TokenAgent as a MANAGEMENT_KEY first.`
            );
        }
        
        throw new Error(`KYC claim creation failed: ${error.message}`);
    }
}

/**
 * Delete/Remove user's identity from IdentityRegistry (admin function)
 * Use this when you need to recreate an identity
 */
export async function deleteIdentityFromRegistry(userWalletAddress: string) {
    try {
        const wallet = getTokenAgentWallet();
        
        const identityRegistry = new ethers.Contract(
            IDENTITY_REGISTRY,
            [
                'function deleteIdentity(address _userAddress) external',
                'function identity(address _userAddress) external view returns (address)'
            ],
            wallet
        );
        
        // Check if identity exists
        const existingIdentity = await identityRegistry.identity(userWalletAddress);
        if (existingIdentity === ethers.ZeroAddress) {
            console.log('No identity to delete for user:', userWalletAddress);
            return {
                success: true,
                message: 'No identity found to delete'
            };
        }
        
        console.log('Deleting identity from registry:', existingIdentity);
        
        const tx = await identityRegistry.deleteIdentity(userWalletAddress);
        const receipt = await tx.wait();
        
        console.log('Identity deleted:', receipt.transactionHash);
        
        return {
            success: true,
            transactionHash: receipt.transactionHash,
            deletedIdentity: existingIdentity
        };
    } catch (error: any) {
        console.error('Failed to delete identity:', error);
        throw new Error(`Failed to delete identity: ${error.message}`);
    }
}

/**
 * Update user's identity in IdentityRegistry (admin function)
 * Use this when you need to replace an old identity with a new one
 */
export async function updateIdentityInRegistry(
    userWalletAddress: string,
    newIdentityAddress: string,
    country: number = 158
) {
    try {
        const wallet = getTokenAgentWallet();
        
        const identityRegistry = new ethers.Contract(
            IDENTITY_REGISTRY,
            [
                'function updateIdentity(address _userAddress, address _identity) external',
                'function identity(address _userAddress) external view returns (address)'
            ],
            wallet
        );
        
        // Check if identity exists
        const existingIdentity = await identityRegistry.identity(userWalletAddress);
        if (existingIdentity === ethers.ZeroAddress) {
            console.log('No existing identity, will register instead');
            return await registerUserToRegistry(userWalletAddress, newIdentityAddress, country);
        }
        
        console.log('Updating identity in registry:', {
            user: userWalletAddress,
            oldIdentity: existingIdentity,
            newIdentity: newIdentityAddress
        });
        
        const tx = await identityRegistry.updateIdentity(
            userWalletAddress,
            newIdentityAddress
        );
        
        const receipt = await tx.wait();
        
        console.log('Identity updated:', receipt.transactionHash);
        
        return {
            success: true,
            transactionHash: receipt.transactionHash,
            oldIdentity: existingIdentity,
            newIdentity: newIdentityAddress
        };
    } catch (error: any) {
        console.error('Failed to update identity:', error);
        throw new Error(`Failed to update identity: ${error.message}`);
    }
}

/**
 * Register user to IdentityRegistry (admin function)
 */
export async function registerUserToRegistry(
    userWalletAddress: string,
    identityAddress: string,
    country: number = 158 // Default: Taiwan
) {
    try {
        const wallet = getTokenAgentWallet();
        
        const identityRegistry = new ethers.Contract(
            IDENTITY_REGISTRY,
            [
                'function registerIdentity(address _userAddress, address _identity, uint16 _country) external',
                'function isVerified(address _userAddress) external view returns (bool)',
                'function identity(address _userAddress) external view returns (address)'
            ],
            wallet
        );
        
        // Check if address is already stored in registry
        const existingIdentity = await identityRegistry.identity(userWalletAddress);
        if (existingIdentity !== ethers.ZeroAddress) {
            console.log('User address already registered in Identity Registry:', existingIdentity);
            const isVerified = await identityRegistry.isVerified(userWalletAddress);
            console.log('Is verified:', isVerified);
            return {
                success: true,
                alreadyRegistered: true,
                isVerified,
                existingIdentity
            };
        }
        
        // Register identity
        console.log('Registering identity to registry:', {
            user: userWalletAddress,
            identity: identityAddress,
            country
        });
        
        const tx = await identityRegistry.registerIdentity(
            userWalletAddress,
            identityAddress,
            158
        );
        
        const receipt = await tx.wait();
        
        console.log('User registered to Identity Registry:', receipt.transactionHash);
        
        return {
            success: true,
            transactionHash: receipt.transactionHash,
            alreadyRegistered: false
        };
    } catch (error: any) {
        console.error('Failed to register user:', error);
        
        // If error is "address stored already", it means the address is already registered
        if (error.message && error.message.includes('address stored already')) {
            console.log('User was already registered (caught from error)');
            return {
                success: true,
                alreadyRegistered: true,
                message: 'Address already registered in Identity Registry'
            };
        }
        
        throw new Error(`User registration failed: ${error.message}`);
    }
}

/**
 * Detailed verification diagnosis
 */
export async function diagnoseVerification(userWalletAddress: string) {
    try {
        const provider = getProvider();
        
        console.log('\n========== VERIFICATION DIAGNOSIS ==========');
        console.log('User Address:', userWalletAddress);
        
        // 1. Check IdentityRegistry
        const identityRegistry = new ethers.Contract(
            IDENTITY_REGISTRY,
            [
                'function isVerified(address _userAddress) external view returns (bool)',
                'function identity(address _userAddress) external view returns (address)',
                'function investorCountry(address _userAddress) external view returns (uint16)'
            ],
            provider
        );
        
        const identityAddress = await identityRegistry.identity(userWalletAddress);
        const isVerified = await identityRegistry.isVerified(userWalletAddress);
        
        console.log('\n1. IdentityRegistry Check:');
        console.log('   Identity Address:', identityAddress);
        console.log('   Is Registered:', identityAddress !== ethers.ZeroAddress);
        console.log('   isVerified():', isVerified);
        
        if (identityAddress === ethers.ZeroAddress) {
            console.log('   ❌ ISSUE: User not registered in IdentityRegistry');
            console.log('========== END DIAGNOSIS ==========\n');
            return;
        }
        
        const country = await identityRegistry.investorCountry(userWalletAddress);
        console.log('   Country Code:', country.toString());
        
        // 2. Check Claims on Identity
        const identity = new ethers.Contract(
            identityAddress,
            [
                'function getClaim(bytes32 _claimId) external view returns (uint256 topic, uint256 scheme, address issuer, bytes memory signature, bytes memory data, string memory uri)',
                'function getClaimIdsByTopic(uint256 _topic) external view returns (bytes32[] memory)'
            ],
            provider
        );
        
        console.log('\n2. Claims Check:');
        console.log('   KYC Topic:', KYC_CLAIM_TOPIC);
        
        const claimIds = await identity.getClaimIdsByTopic(KYC_CLAIM_TOPIC);
        console.log('   Number of claims:', claimIds.length);
        
        if (claimIds.length === 0) {
            console.log('   ❌ ISSUE: No KYC claim found on Identity');
        } else {
            const claim = await identity.getClaim(claimIds[0]);
            console.log('   Claim Issuer:', claim.issuer);
            console.log('   Expected Issuer:', CLAIM_ISSUER_CONTRACT);
            console.log('   ✓ Claim exists');
        }
        
        // 3. Check ClaimTopicsRegistry (CRITICAL!)
        const token = new ethers.Contract(
            TOKEN_ADDRESS,
            [
                'function identityRegistry() external view returns (address)',
                'function compliance() external view returns (address)'
            ],
            provider
        );
        
        const tokenIdentityRegistry = await token.identityRegistry();
        console.log('\n3. Token Configuration:');
        console.log('   Token Address:', TOKEN_ADDRESS);
        console.log('   Token\'s IdentityRegistry:', tokenIdentityRegistry);
        console.log('   Expected:', IDENTITY_REGISTRY);
        console.log('   Match:', tokenIdentityRegistry.toLowerCase() === IDENTITY_REGISTRY.toLowerCase());
        
        // 4. Get sub-registries from IdentityRegistry
        const fullIdentityRegistry = new ethers.Contract(
            IDENTITY_REGISTRY,
            [
                'function topicsRegistry() external view returns (address)',
                'function issuersRegistry() external view returns (address)'
            ],
            provider
        );
        
        console.log('\n4. Sub-Registries:');
        try {
            const topicsRegistry = await fullIdentityRegistry.topicsRegistry();
            const issuersRegistry = await fullIdentityRegistry.issuersRegistry();
            console.log('   ClaimTopicsRegistry:', topicsRegistry);
            console.log('   TrustedIssuersRegistry:', issuersRegistry);
            console.log('   Expected ClaimTopicsRegistry:', process.env.CLAIM_TOPICS_REGISTRY || 'Not set');
            console.log('   Expected TrustedIssuersRegistry:', process.env.TRUSTED_ISSUERS_REGISTRY || 'Not set');
            
            // Check topics
            const topicsReg = new ethers.Contract(
                topicsRegistry,
                ['function getClaimTopics() external view returns (uint256[] memory)'],
                provider
            );
            const topics = await topicsReg.getClaimTopics();
            console.log('\n5. Required Claim Topics:');
            console.log('   Topics:', topics.map((t: any) => t.toString()));
            console.log('   Our KYC topic:', KYC_CLAIM_TOPIC);
            
            if (!topics.some((t: any) => t.toString() === KYC_CLAIM_TOPIC)) {
                console.log('   ❌ CRITICAL: KYC topic not registered!');
                console.log('   Fix: Add KYC_CLAIM_TOPIC to ClaimTopicsRegistry');
            }
            
            // Check issuers
            const issuersReg = new ethers.Contract(
                issuersRegistry,
                ['function getTrustedIssuers() external view returns (address[] memory)'],
                provider
            );
            const issuers = await issuersReg.getTrustedIssuers();
            console.log('\n6. Trusted Issuers:');
            console.log('   Issuers:', issuers);
            console.log('   Our issuer:', CLAIM_ISSUER_CONTRACT);
            
            if (!issuers.some((i: string) => i.toLowerCase() === CLAIM_ISSUER_CONTRACT.toLowerCase())) {
                console.log('   ❌ CRITICAL: Claim issuer not trusted!');
                console.log('   Fix: Add CLAIM_ISSUER_CONTRACT to TrustedIssuersRegistry');
            }
        } catch (e: any) {
            console.log('   Error:', e.message);
        }
        
        console.log('\n========== END DIAGNOSIS ==========\n');
    } catch (error: any) {
        console.error('Diagnosis error:', error);
    }
}

/**
 * Check if user is verified (has valid claim and is registered)
 */
export async function verifyUser(userWalletAddress: string) {
    try {
        const provider = getProvider();
        
        const identityRegistry = new ethers.Contract(
            IDENTITY_REGISTRY,
            [
                'function isVerified(address _userAddress) external view returns (bool)',
                'function identity(address _userAddress) external view returns (address)'
            ],
            provider
        );
        
        const isVerified = await identityRegistry.isVerified(userWalletAddress);
        const identityAddress = await identityRegistry.identity(userWalletAddress);
        
        return {
            isVerified,
            identityAddress: identityAddress !== ethers.ZeroAddress ? identityAddress : null
        };
    } catch (error: any) {
        console.error('Failed to verify user:', error);
        throw new Error(`User verification failed: ${error.message}`);
    }
}

/**
 * Mint ERC-3643 tokens to a user (admin function)
 * User must be verified before they can receive tokens
 */
export async function mintTokensToUser(
    userWalletAddress: string,
    amount: number
) {
    try {
        const wallet = getTokenAgentWallet();
        
        // Check if user is verified first
        const { isVerified } = await verifyUser(userWalletAddress);

        console.log('🔍 Verification check:', {
            userWalletAddress,
            isVerified
        });

        if (!isVerified) {
            // Run detailed diagnosis to help debug
            console.log('⚠️ User not verified, running diagnosis...');
            try {
                await diagnoseVerification(userWalletAddress);
            } catch (diagError) {
                console.error('Diagnosis failed:', diagError);
            }
            throw new Error('User is not verified. Cannot mint tokens.');
        }

        console.log('✅ User verified, proceeding with mint...');

        const token = new ethers.Contract(
            TOKEN_ADDRESS,
            [   
                'function mint(address _to, uint256 _amount) external',
                'function balanceOf(address _account) external view returns (uint256)'
            ],
            wallet
        );
        
        const tx = await token.mint(userWalletAddress, amount);
        
        const balance = await token.balanceOf(userWalletAddress);
        
        console.log('Tokens minted:', amount, 'to', userWalletAddress);
        console.log('New balance:', balance.toString());
        
        return {
            success: true,
            amount,
            transactionHash: tx.hash,
            newBalance: balance.toString()
        };
    } catch (error: any) {
        console.error('Failed to mint tokens:', error);
        throw new Error(`Token minting failed: ${error.message}`);
    }
}

/**
 * Get user's token balance
 */
export async function getTokenBalance(userWalletAddress: string) {
    try {
        const provider = getProvider();
        
        const token = new ethers.Contract(
            TOKEN_ADDRESS,
            [
                'function balanceOf(address _account) external view returns (uint256)',
                'function name() external view returns (string)',
                'function symbol() external view returns (string)',
                'function decimals() external view returns (uint8)'
            ],
            provider
        );
        
        const [balance, name, symbol] = await Promise.all([
            token.balanceOf(userWalletAddress),
            token.name(),
            token.symbol(),
        ]);
        return {
            balance: balance.toString(),
            name,
            symbol,
        };
    } catch (error: any) {
        console.error('Failed to get token balance:', error);
        throw new Error(`Get balance failed: ${error.message}`);
    }
}

/**
 * Check contract configuration
 */
export async function checkConfiguration() {
    const missingVars = [];
    
    if (!IDENTITY_FACTORY_ADDRESS) missingVars.push('IDENTITY_FACTORY_ADDRESS');
    if (!IDENTITY_IMPLEMENTATION_AUTHORITY) missingVars.push('IDENTITY_IMPLEMENTATION_AUTHORITY');
    if (!CLAIM_ISSUER_CONTRACT) missingVars.push('CLAIM_ISSUER_CONTRACT');
    if (!CLAIM_ISSUER_SIGNING_KEY) missingVars.push('CLAIM_ISSUER_SIGNING_KEY');
    if (!TOKEN_ADDRESS) missingVars.push('TOKEN_ADDRESS');
    if (!IDENTITY_REGISTRY) missingVars.push('IDENTITY_REGISTRY');
    if (!TOKEN_AGENT_PRIVATE_KEY) missingVars.push('TOKEN_AGENT_PRIVATE_KEY');
    if (!KYC_CLAIM_TOPIC) missingVars.push('KYC_CLAIM_TOPIC');
    if (!RPC_URL) missingVars.push('ETHEREUM_RPC_URL');
    
    return {
        isConfigured: missingVars.length === 0,
        missingVariables: missingVars
    };
}

