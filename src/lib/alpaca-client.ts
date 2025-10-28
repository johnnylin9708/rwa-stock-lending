/**
 * Alpaca Broker API Client Utility
 * Used for creating and managing customer brokerage accounts
 */
import axios, { AxiosInstance } from "axios";

// Alpaca Broker API Base URLs
const BROKER_API_BASE_URL = process.env.ALPACA_BROKER_API_URL || "https://broker-api.sandbox.alpaca.markets";
const DATA_API_BASE_URL = "https://data.alpaca.markets";

/**
 * Create Alpaca Broker API client with proper authentication
 */
export function getBrokerApiClient(): AxiosInstance {
    return axios.create({
        baseURL: BROKER_API_BASE_URL,
        headers: {
            "APCA-API-KEY-ID": process.env.ALPACA_BROKER_API_KEY_ID,
            "APCA-API-SECRET-KEY": process.env.ALPACA_BROKER_SECRET_KEY,
        },
    });
}

/**
 * Create Market Data API client (for prices, doesn't need account)
 */
export function getDataApiClient(): AxiosInstance {
    return axios.create({
        baseURL: DATA_API_BASE_URL,
        headers: {
            "APCA-API-KEY-ID": process.env.ALPACA_BROKER_API_KEY_ID,
            "APCA-API-SECRET-KEY": process.env.ALPACA_BROKER_SECRET_KEY,
        },
    });
}

/**
 * Create a new Alpaca brokerage account for a user
 * Reference: https://docs.alpaca.markets/reference/createaccount
 */
export async function createBrokerageAccount(userData: {
    email: string;
    givenName: string;
    familyName: string;
    dateOfBirth: string; // YYYY-MM-DD
    taxId?: string;
    phoneNumber: string;
    streetAddress: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
    citizenship?: string;
    fundingSource?: string[];
    // Financial information
    employmentStatus?: string;
    annualIncome?: string;
    netWorth?: string;
    liquidNetWorth?: string;
    // Investment profile
    investmentExperience?: string;
    investmentObjective?: string;
    riskTolerance?: string;
    // Trusted contact
    trustedContact?: {
        givenName: string;
        familyName: string;
        emailAddress?: string;
        phoneNumber?: string;
        streetAddress?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
    };
}) {
    const client = getBrokerApiClient();
    
    try {
        const accountData: any = {
            contact: {
                email_address: userData.email,
                phone_number: userData.phoneNumber,
                street_address: userData.streetAddress,
                city: userData.city,
                state: userData.state || 'N/A', // 非美国地址可以为 N/A
                postal_code: userData.postalCode,
                country: userData.country,
            },
            identity: {
                given_name: userData.givenName,
                family_name: userData.familyName,
                date_of_birth: userData.dateOfBirth,
                tax_id: userData.taxId,
                // 默认使用 passport，美国用户使用 SSN
                tax_id_type: userData.country === 'USA' ? 'USA_SSN' : 'passport',
                country_of_citizenship: userData.citizenship || userData.country,
                country_of_birth: userData.citizenship || userData.country,
                country_of_tax_residence: userData.country,
                funding_source: userData.fundingSource || ['employment_income'],
                annual_income_min: getIncomeRange(userData.annualIncome)?.min,
                annual_income_max: getIncomeRange(userData.annualIncome)?.max,
                liquid_net_worth_min: getIncomeRange(userData.liquidNetWorth)?.min,
                liquid_net_worth_max: getIncomeRange(userData.liquidNetWorth)?.max,
                total_net_worth_min: getIncomeRange(userData.netWorth)?.min,
                total_net_worth_max: getIncomeRange(userData.netWorth)?.max,
            },
            disclosures: {
                is_control_person: false,
                is_affiliated_exchange_or_finra: false,
                is_politically_exposed: false,
                immediate_family_exposed: false,
                employment_status: userData.employmentStatus || 'employed',
            },
            agreements: [
                {
                    agreement: 'margin_agreement',
                    signed_at: new Date().toISOString(),
                    ip_address: '0.0.0.0',
                },
                {
                    agreement: 'account_agreement',
                    signed_at: new Date().toISOString(),
                    ip_address: '0.0.0.0',
                },
                {
                    agreement: 'customer_agreement',
                    signed_at: new Date().toISOString(),
                    ip_address: '0.0.0.0',
                },
            ],
        };

        // Add investment profile if provided (root level fields)
        if (userData.investmentExperience) {
            accountData.investment_experience = userData.investmentExperience;
        }
        if (userData.investmentObjective) {
            accountData.investment_objective = userData.investmentObjective;
        }
        if (userData.riskTolerance) {
            accountData.risk_tolerance = userData.riskTolerance;
        }

        // Add trusted contact if provided
        if (userData.trustedContact && userData.trustedContact.givenName && userData.trustedContact.familyName) {
            const trustedContactData: any = {
                given_name: userData.trustedContact.givenName,
                family_name: userData.trustedContact.familyName,
            };

            // Add at least one contact method (required)
            if (userData.trustedContact.emailAddress) {
                trustedContactData.email_address = userData.trustedContact.emailAddress;
            }
            if (userData.trustedContact.phoneNumber) {
                trustedContactData.phone_number = userData.trustedContact.phoneNumber;
            }
            
            // Add street address if provided (requires city, state, postal_code, country)
            if (userData.trustedContact.streetAddress && 
                userData.trustedContact.city && 
                userData.trustedContact.state && 
                userData.trustedContact.postalCode && 
                userData.trustedContact.country) {
                trustedContactData.street_address = [userData.trustedContact.streetAddress];
                trustedContactData.city = userData.trustedContact.city;
                trustedContactData.state = userData.trustedContact.state;
                trustedContactData.postal_code = userData.trustedContact.postalCode;
                trustedContactData.country = userData.trustedContact.country;
            }

            accountData.trusted_contact = trustedContactData;
        }

        const response = await client.post("/v1/accounts", accountData);
        return response.data;
    } catch (error: any) {
        console.error("Failed to create brokerage account:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * Helper function to parse income/net worth ranges
 */
function getIncomeRange(range?: string): { min: number; max: number } | undefined {
    if (!range) return undefined;
    
    const ranges: Record<string, { min: number; max: number }> = {
        '0-25000': { min: 0, max: 25000 },
        '25000-50000': { min: 25000, max: 50000 },
        '50000-100000': { min: 50000, max: 100000 },
        '100000-200000': { min: 100000, max: 200000 },
        '100000-250000': { min: 100000, max: 250000 },
        '100000-500000': { min: 100000, max: 500000 },
        '200000+': { min: 200000, max: 999999999 },
        '250000+': { min: 250000, max: 999999999 },
        '500000-1000000': { min: 500000, max: 1000000 },
        '1000000+': { min: 1000000, max: 999999999 },
    };
    
    return ranges[range];
}

/**
 * Get account information for a specific user account
 */
export async function getAccountInfo(alpacaAccountId: string) {
    const client = getBrokerApiClient();
    try {
        const response = await client.get(`/v1/accounts/${alpacaAccountId}`);
        return response.data;
    } catch (error: any) {
        console.error(`Failed to fetch account info for ${alpacaAccountId}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get portfolio positions for a specific account
 * Reference: https://docs.alpaca.markets/reference/getpositionsforaccount
 */
export async function getPositions(alpacaAccountId: string) {
    const client = getBrokerApiClient();
    try {
        const response = await client.get(`/v1/trading/accounts/${alpacaAccountId}/positions`);
        return response.data;
    } catch (error: any) {
        console.error(`Failed to fetch positions for ${alpacaAccountId}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get a specific open position by symbol for an account
 * Reference: https://docs.alpaca.markets/reference/getpositionforaccount
 */
export async function getPositionBySymbol(alpacaAccountId: string, symbol: string) {
    const client = getBrokerApiClient();
    try {
        const response = await client.get(`/v1/trading/accounts/${alpacaAccountId}/positions/${symbol}`);
        return response.data;
    } catch (error: any) {
        console.error(`Failed to fetch position ${symbol} for ${alpacaAccountId}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get latest price for a symbol from Alpaca Market Data API
 */
export async function getLatestPrice(symbol: string): Promise<number> {
    const client = getDataApiClient();
    try {
        const response = await client.get(`/v2/stocks/${symbol}/trades/latest`);
        return response.data.trade?.p || 0;
    } catch (error: any) {
        console.error(`Failed to fetch price for ${symbol}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get latest prices for multiple symbols
 */
export async function getLatestPrices(symbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    
    try {
        await Promise.all(
            symbols.map(async (symbol) => {
                try {
                    prices[symbol] = await getLatestPrice(symbol);
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
