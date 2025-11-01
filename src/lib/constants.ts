/**
 * Application Constants
 * 
 * 注意：合約地址是公開資訊，暴露在客戶端是完全安全的
 * 任何人都可以在區塊鏈瀏覽器（如 Etherscan）上查看這些地址
 */

// Supported tokenized assets
export const SUPPORTED_ASSETS = [
    {
        symbol: "TSPY",
        originalSymbol: "SPY",  // Original stock symbol
        name: "Tokenized S&P 500 ETF",
        type: "ETF",
        collateralFactor: 0.75,
        liquidationThreshold: 0.85,
        // 客戶端可安全暴露，優先使用環境變數以便於配置
        tokenAddress: process.env.NEXT_PUBLIC_TSPY_ADDRESS || "0xBEae6Fa62362aB593B498692FD09002a9eEd52dc",
        tokenStandard: "ERC-3643",
    }
];
