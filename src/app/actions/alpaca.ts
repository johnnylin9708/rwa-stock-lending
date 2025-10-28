'use server';

import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";
import { getAccountInfo, getPositions } from "@/lib/alpaca-client";

export const getAlpacaAccountDetails = async (walletAddress: string) => {
        
        if (!walletAddress) {
            return null;
        }
        
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        const user = await usersCollection.findOne({ 
            walletAddress: walletAddress.toLowerCase()
        });

        if (!user || !user.alpacaAccount) {
            return null;
        }
        
        // Fetch account details and positions in parallel from Alpaca Broker API
        const [account, positions] = await Promise.all([
            getAccountInfo(user.alpacaAccount.accountId),
            getPositions(user.alpacaAccount.accountId)
        ]);
        
        // Update local database with latest account status
        await usersCollection.updateOne(
            { walletAddress },
            { 
                $set: { 
                    'alpacaAccount.status': account.status,
                    'alpacaAccount.lastSync': new Date(),
                    updatedAt: new Date()
                } 
            }
        );

        return {
            account: {
                accountId: account.id,
                accountNumber: account.account_number,
                status: account.status,
                currency: account.currency,
                cash: account.cash,
                portfolio_value: account.portfolio_value,
                buying_power: account.buying_power,
                equity: account.equity,
                last_equity: account.last_equity,
                long_market_value: account.long_market_value,
                short_market_value: account.short_market_value,
                daytrade_count: account.daytrade_count,
                pattern_day_trader: account.pattern_day_trader,
            },
            positions: positions.map((position: any) => ({
                symbol: position.symbol,
                qty: position.qty,
                avg_entry_price: position.avg_entry_price,
                market_value: position.market_value,
                cost_basis: position.cost_basis,
                unrealized_pl: position.unrealized_pl,
                unrealized_plpc: position.unrealized_plpc,
                current_price: position.current_price,
                side: position.side,
                asset_id: position.asset_id,
                exchange: position.exchange,
            }))
        };
}