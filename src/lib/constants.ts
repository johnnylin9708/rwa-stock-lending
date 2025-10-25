/**
 * Application Constants
 */

// Supported tokenized assets
export const SUPPORTED_ASSETS = [
    {
        symbol: "TAAPL",
        originalSymbol: "AAPL",
        name: "Tokenized Apple Inc.",
        type: "STOCK",
        collateralFactor: 0.75,
        liquidationThreshold: 0.85,
        icon: "🍎"
    },
    {
        symbol: "TGOOGL",
        originalSymbol: "GOOGL",
        name: "Tokenized Alphabet Inc.",
        type: "STOCK",
        collateralFactor: 0.75,
        liquidationThreshold: 0.85,
        icon: "📱"
    },
    {
        symbol: "TTSLA",
        originalSymbol: "TSLA",
        name: "Tokenized Tesla Inc.",
        type: "STOCK",
        collateralFactor: 0.65, // Lower due to higher volatility
        liquidationThreshold: 0.80,
        icon: "⚡"
    },
    {
        symbol: "TMSFT",
        originalSymbol: "MSFT",
        name: "Tokenized Microsoft Corp.",
        type: "STOCK",
        collateralFactor: 0.75,
        liquidationThreshold: 0.85,
        icon: "💻"
    },
    {
        symbol: "TUSG",
        originalSymbol: "USG",
        name: "Tokenized US Government Bonds",
        type: "BOND",
        collateralFactor: 0.90, // Higher for stable bonds
        liquidationThreshold: 0.95,
        icon: "📊"
    }
];

// Health factor thresholds
export const HEALTH_FACTOR_THRESHOLDS = {
    HEALTHY: 1.5,      // > 1.5 = healthy
    WARNING: 1.2,      // 1.2-1.5 = warning
    DANGER: 1.0,       // 1.0-1.2 = danger
    LIQUIDATION: 1.0   // < 1.0 = can be liquidated
};

// Interest rate parameters (matching contract)
export const INTEREST_RATE_PARAMS = {
    BASE_RATE: 0.02,           // 2%
    MULTIPLIER: 0.1,           // 10%
    JUMP_MULTIPLIER: 3.0,      // 300%
    OPTIMAL_UTILIZATION: 0.8   // 80%
};

// Platform fees
export const PLATFORM_FEES = {
    RESERVE_FACTOR: 0.1,       // 10% of interest goes to reserves
    LIQUIDATION_PENALTY: 0.1,  // 10% liquidation bonus
    CLOSE_FACTOR: 0.5          // Max 50% can be liquidated at once
};

// API polling intervals (milliseconds)
export const POLLING_INTERVALS = {
    PRICE_UPDATE: 30000,       // 30 seconds
    PORTFOLIO_UPDATE: 60000,   // 1 minute
    HEALTH_CHECK: 15000        // 15 seconds
};

// Transaction types
export const TX_TYPES = {
    DEPOSIT: "DEPOSIT",
    WITHDRAW: "WITHDRAW",
    BORROW: "BORROW",
    REPAY: "REPAY",
    LIQUIDATION: "LIQUIDATION",
    TRADE: "TRADE"
} as const;

// Network configuration
export const NETWORKS = {
    ETHEREUM_MAINNET: {
        chainId: 1,
        name: "Ethereum Mainnet",
        rpc: "https://mainnet.infura.io/v3/YOUR_INFURA_KEY"
    },
    SEPOLIA: {
        chainId: 11155111,
        name: "Sepolia Testnet",
        rpc: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
    },
    BSC: {
        chainId: 56,
        name: "Binance Smart Chain",
        rpc: "https://bsc-dataseed.binance.org/"
    },
    BSC_TESTNET: {
        chainId: 97,
        name: "BSC Testnet",
        rpc: "https://data-seed-prebsc-1-s1.binance.org:8545/"
    }
};

// Default network for development
export const DEFAULT_NETWORK = process.env.NEXT_PUBLIC_NETWORK || "SEPOLIA";

