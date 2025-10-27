/**
 * Database Models
 * For MongoDB or PostgreSQL
 */

export interface User {
    id: string;
    walletAddress: string;
    email?: string;
    nonce?: string;
    lastLogin?: Date;
    sessionToken?: string;
    createdAt: Date;
    updatedAt: Date;
    // Alpaca Broker account info
    alpacaAccountId?: string;
    alpacaAccountStatus?: 'SUBMITTED' | 'ACTION_REQUIRED' | 'EDITED' | 'APPROVAL_PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'ACCOUNT_CLOSED';
    kycStatus?: 'pending' | 'approved' | 'rejected' | 'not_started';
}

export interface TokenizedAsset {
    symbol: string;           // e.g., "TAAPL"
    originalSymbol: string;   // e.g., "AAPL"
    name: string;             // e.g., "Apple Inc."
    type: "STOCK" | "BOND";
    contractAddress: string;
    collateralFactor: number; // e.g., 0.75 for 75%
    liquidationThreshold: number; // e.g., 0.85 for 85%
    currentPrice: number;     // USD price
    lastPriceUpdate: Date;
    isActive: boolean;
}

export interface LendingPosition {
    id: string;
    userId: string;
    walletAddress: string;
    assetSymbol: string;
    collateralAmount: number;  // Amount deposited as collateral
    borrowedAmount: number;    // Amount borrowed in stablecoin
    borrowIndex: number;       // For interest calculation
    healthFactor: number;      // Current health factor
    status: "ACTIVE" | "LIQUIDATED" | "CLOSED";
    createdAt: Date;
    updatedAt: Date;
}

export interface Transaction {
    id: string;
    userId: string;
    walletAddress: string;
    type: "DEPOSIT" | "WITHDRAW" | "BORROW" | "REPAY" | "LIQUIDATION" | "TRADE";
    assetSymbol: string;
    amount: number;
    txHash: string;           // Blockchain transaction hash
    status: "PENDING" | "CONFIRMED" | "FAILED";
    timestamp: Date;
    metadata?: {
        healthFactorBefore?: number;
        healthFactorAfter?: number;
        interestPaid?: number;
        liquidationPenalty?: number;
        [key: string]: any;
    };
}

export interface AlpacaTrade {
    id: string;
    userId: string;
    alpacaOrderId: string;
    symbol: string;
    side: "buy" | "sell";
    qty: number;
    orderType: string;
    price?: number;
    status: string;
    filledAt?: Date;
    createdAt: Date;
}

export interface PriceOracle {
    assetSymbol: string;
    price: number;
    source: "ALPACA" | "CHAINLINK" | "COMPOUND";
    timestamp: Date;
    confidence: number;       // 0-1 confidence score
}

export interface RiskMetrics {
    id: string;
    userId: string;
    totalCollateralValue: number;
    totalBorrowValue: number;
    healthFactor: number;
    utilizationRate: number;
    liquidationRisk: "LOW" | "MEDIUM" | "HIGH";
    timestamp: Date;
}

// Interest rate snapshot for historical tracking
export interface InterestRateSnapshot {
    assetSymbol: string;
    borrowAPY: number;
    supplyAPY: number;
    utilizationRate: number;
    totalBorrows: number;
    totalSupply: number;
    timestamp: Date;
}

// Tokenized Position - tracks frozen stock positions and their tokenization
export interface TokenizedPosition {
    id?: string;
    userId: string;
    walletAddress: string;
    
    // Original stock information
    originalSymbol: string;      // AAPL, GOOGL, etc
    alpacaPositionQty: number;   // Total position quantity on Alpaca
    
    // Tokenization details
    tokenizedQty: number;        // Total tokenized quantity
    frozenQty: number;           // Frozen quantity (same as tokenized)
    availableQty: number;        // Available quantity (alpacaPositionQty - frozenQty)
    
    // Token contract information
    tokenSymbol: string;         // TAAPL, TGOOGL
    tokenContractAddress: string;
    
    // Tokenization history
    tokenizations: {
        amount: number;
        txHash: string;
        blockNumber?: number;
        timestamp: Date;
        status: 'pending' | 'confirmed' | 'failed';
    }[];
    
    status: 'active' | 'closed';
    createdAt: Date;
    updatedAt: Date;
}

