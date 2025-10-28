/**
 * Authentication Helpers for Simple Wallet Authentication
 * Simplified authentication system using wallet address only
 */

import { ethers } from "ethers";

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


