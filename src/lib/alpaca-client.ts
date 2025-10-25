/**
 * Alpaca API Client Utility
 */
import Alpaca from "@alpacahq/alpaca-trade-api";

export function getAlpacaClient() {
    return new Alpaca({
        keyId: process.env.ALPACA_API_KEY_ID,
        secretKey: process.env.ALPACA_SECRET_KEY,
        paper: true, // Use paper trading for MVP
    });
}

/**
 * Get latest price for a symbol from Alpaca
 */
export async function getLatestPrice(symbol: string): Promise<number> {
    const alpaca = getAlpacaClient();
    try {
        const latestTrade = await alpaca.getLatestTrade(symbol);
        return latestTrade.p || 0;
    } catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error);
        throw error;
    }
}

/**
 * Get latest prices for multiple symbols
 */
export async function getLatestPrices(symbols: string[]): Promise<Record<string, number>> {
    const alpaca = getAlpacaClient();
    const prices: Record<string, number> = {};
    
    try {
        await Promise.all(
            symbols.map(async (symbol) => {
                try {
                    const latestTrade = await alpaca.getLatestTrade(symbol);
                    prices[symbol] = latestTrade.p || 0;
                } catch (error) {
                    console.error(`Failed to fetch price for ${symbol}:`, error);
                    prices[symbol] = 0;
                }
            })
        );
        
        return prices;
    } catch (error) {
        console.error("Failed to fetch prices:", error);
        throw error;
    }
}

/**
 * Get historical bars for a symbol
 */
export async function getHistoricalBars(
    symbol: string,
    timeframe: string = "1Day",
    start: Date,
    end: Date = new Date()
) {
    const alpaca = getAlpacaClient();
    try {
        const bars = await alpaca.getBarsV2(symbol, {
            start: start.toISOString(),
            end: end.toISOString(),
            timeframe,
        });
        
        return bars;
    } catch (error) {
        console.error(`Failed to fetch bars for ${symbol}:`, error);
        throw error;
    }
}

/**
 * Get account information
 */
export async function getAccountInfo(accountId?: string) {
    const alpaca = getAlpacaClient();
    try {
        if (accountId) {
            return await alpaca.getAccount(accountId);
        }
        return await alpaca.getAccount();
    } catch (error) {
        console.error("Failed to fetch account info:", error);
        throw error;
    }
}

/**
 * Get portfolio positions
 */
export async function getPositions(accountId?: string) {
    const alpaca = getAlpacaClient();
    try {
        if (accountId) {
            return await alpaca.getPositions(accountId);
        }
        return await alpaca.getPositions();
    } catch (error) {
        console.error("Failed to fetch positions:", error);
        throw error;
    }
}

/**
 * Place an order
 */
export async function placeOrder(orderParams: {
    symbol: string;
    qty: number;
    side: "buy" | "sell";
    type: "market" | "limit" | "stop" | "stop_limit";
    time_in_force: "day" | "gtc" | "opg" | "cls";
    limit_price?: number;
    stop_price?: number;
}) {
    const alpaca = getAlpacaClient();
    try {
        return await alpaca.createOrder(orderParams);
    } catch (error) {
        console.error("Failed to place order:", error);
        throw error;
    }
}

