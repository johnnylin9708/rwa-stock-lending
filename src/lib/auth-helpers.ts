/**
 * Authentication Helpers for Web3 Wallet Authentication
 * Simple MVP approach using wallet address as user identifier
 */

import { ethers } from "ethers";

/**
 * Verify wallet ownership by signing a message
 */
export async function verifyWalletOwnership(
    address: string,
    signature: string,
    message: string
): Promise<boolean> {
    try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
        console.error("Error verifying signature:", error);
        return false;
    }
}

/**
 * Generate a nonce message for signing
 */
export function generateNonceMessage(address: string, nonce: string): string {
    return `Welcome to RWA Lending Platform!\n\nPlease sign this message to verify your wallet ownership.\n\nWallet: ${address}\nNonce: ${nonce}\n\nThis signature will not trigger any blockchain transaction or cost any gas fees.`;
}

/**
 * Generate a random nonce
 */
export function generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Create a session token (for optional server-side session management)
 */
export function createSessionToken(address: string): string {
    // In production, use a more secure method like JWT
    return Buffer.from(`${address}:${Date.now()}`).toString('base64');
}

/**
 * Validate session token
 */
export function validateSessionToken(token: string): { address: string; timestamp: number } | null {
    try {
        const decoded = Buffer.from(token, 'base64').toString();
        const [address, timestamp] = decoded.split(':');
        
        // Check if token is expired (24 hours)
        const tokenAge = Date.now() - parseInt(timestamp);
        if (tokenAge > 24 * 60 * 60 * 1000) {
            return null;
        }
        
        return { address, timestamp: parseInt(timestamp) };
    } catch (error) {
        return null;
    }
}

/**
 * Format wallet address for display
 */
export function formatAddress(address: string, length: number = 4): string {
    if (!address) return '';
    return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
}

/**
 * Check if address is valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
    try {
        return ethers.isAddress(address);
    } catch {
        return false;
    }
}

