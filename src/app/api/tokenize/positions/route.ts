import { type NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { getSessionFromHeaders } from "@/lib/auth-helpers";

/**
 * Get tokenization transaction history for authenticated user
 * GET /api/tokenize/positions
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = getSessionFromHeaders(req.headers);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Login required" },
        { status: 401 }
      );
    }

    const db = await getDatabase();
    const collection = db.collection("tokenizationHistory");

    // Fetch all tokenization transactions for this user
    const transactions = await collection
      .find({
        walletAddress: session.walletAddress,
      })
      .sort({ createdAt: -1 }) // Most recent first
      .toArray();

    return NextResponse.json({
      success: true,
      positions: transactions.map((tx) => ({
        _id: tx._id.toString(),
        walletAddress: tx.walletAddress,
        stockSymbol: tx.stockSymbol,
        tokenAddress: tx.tokenAddress,
        amount: tx.amount,
        txHash: tx.txHash,
        tokenBalance: tx.tokenBalance,
        status: tx.status,
        createdAt: tx.createdAt,
      })),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error fetching tokenization history:", error);
    return NextResponse.json(
      { error: "Failed to fetch tokenization history", details: errorMessage },
      { status: 500 }
    );
  }
}

