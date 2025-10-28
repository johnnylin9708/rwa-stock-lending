'use server';
import { getDatabase } from "@/lib/db/mongodb";

export const getTokenizationHistory = async (walletAddress: string) => {
    const db = await getDatabase();
    const collection = db.collection("tokenizationHistory");

    // Fetch all tokenization transactions for this user
    const transactions = await collection
      .find({
        walletAddress: walletAddress,
      })
      .sort({ createdAt: -1 }) // Most recent first
      .toArray();

    return transactions.map((tx) => ({
        _id: tx._id.toString(),
        walletAddress: tx.walletAddress,
        stockSymbol: tx.stockSymbol,
        tokenAddress: tx.tokenAddress,
        amount: tx.amount,
        txHash: tx.txHash,
        tokenBalance: tx.tokenBalance,
        status: tx.status,
        createdAt: tx.createdAt,
      })) 
}