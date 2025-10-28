/**
 * Application Constants
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
        tokenAddress: "0xBEae6Fa62362aB593B498692FD09002a9eEd52dc",
        tokenStandard: "ERC-3643",
    }
];
