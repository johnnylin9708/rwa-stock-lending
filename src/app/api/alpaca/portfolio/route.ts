/**
 * API: Alpaca Broker Portfolio Management
 * Get user's portfolio and positions
 */
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";
import { getSessionFromHeaders } from "@/lib/auth-helpers";
import { getAccountInfo, getPositions } from "@/lib/alpaca-client";

export async function GET(request: NextRequest) {
    try {
        const session = getSessionFromHeaders(request.headers);
        
        if (!session) {
            return NextResponse.json(
                { error: "未授权：需要登录" },
                { status: 401 }
            );
        }
        
        const db = await getDatabase();
        const usersCollection = db.collection<UserSchema>('users');
        
        const user = await usersCollection.findOne({ 
            walletAddress: session.walletAddress 
        });
        
        if (!user || !user.alpacaAccount) {
            return NextResponse.json(
                { error: "用户没有 Alpaca 账户" },
                { status: 404 }
            );
        }
        
        // Fetch account details and positions in parallel from Alpaca Broker API
        const [account, positions] = await Promise.all([
            getAccountInfo(user.alpacaAccount.accountId),
            getPositions(user.alpacaAccount.accountId)
        ]);
        
        // Update local database with latest account status
        await usersCollection.updateOne(
            { walletAddress: session.walletAddress },
            { 
                $set: { 
                    'alpacaAccount.status': account.status,
                    'alpacaAccount.lastSync': new Date(),
                    updatedAt: new Date()
                } 
            }
        );

        return NextResponse.json({
            success: true,
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
        });

    } catch (error: any) {
        console.error("获取投资组合失败:", error);
        return NextResponse.json(
            { error: error.response?.data?.message || error.message || "获取投资组合失败" },
            { status: 500 }
        );
    }
}
