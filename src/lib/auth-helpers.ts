/**
 * Authentication Helpers for Web3 Wallet Authentication + Alpaca Broker Integration
 * Comprehensive authentication system with MongoDB session management
 */

import { ethers } from "ethers";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

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
 * NOTE: 不包含时间戳，因为需要前后端生成相同的消息
 */
export function generateNonceMessage(address: string, nonce: string): string {
    return `Welcome to RWA Stock Lending Platform!

Please sign this message to authenticate your wallet.

Wallet: ${address}
Nonce: ${nonce}

This signature will not trigger any blockchain transaction or cost any gas fees.`;
}

/**
 * Generate a cryptographically secure random nonce
 */
export function generateNonce(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a JWT session token with user information
 */
export function createSessionToken(walletAddress: string, userId?: string): string {
    const payload = {
        walletAddress: walletAddress.toLowerCase(),
        userId,
        iat: Date.now(),
        exp: Date.now() + SESSION_EXPIRY,
    };
    
    return jwt.sign(payload, JWT_SECRET);
}

/**
 * Validate and decode JWT session token
 */
export function validateSessionToken(token: string): { 
    walletAddress: string; 
    userId?: string;
    iat: number;
    exp: number;
} | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        // Check if token is expired
        if (decoded.exp < Date.now()) {
            return null;
        }
        
        return {
            walletAddress: decoded.walletAddress,
            userId: decoded.userId,
            iat: decoded.iat,
            exp: decoded.exp,
        };
    } catch (error) {
        console.error("Invalid session token:", error);
        return null;
    }
}

/**
 * Extract and validate session token from request headers
 */
export function getSessionFromHeaders(headers: Headers): { 
    walletAddress: string; 
    userId?: string;
} | null {
    const authHeader = headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    const session = validateSessionToken(token);
    
    if (!session) {
        return null;
    }
    
    return {
        walletAddress: session.walletAddress,
        userId: session.userId,
    };
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

/**
 * Hash sensitive data for storage
 */
export function hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify hashed data
 */
export function verifyHashedData(data: string, hash: string): boolean {
    return hashData(data) === hash;
}

/**
 * Check if session is expired
 */
export function isSessionExpired(lastLogin: Date): boolean {
    const sessionAge = Date.now() - lastLogin.getTime();
    return sessionAge > SESSION_EXPIRY;
}

