import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("address");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const collection = db.collection("tokenizedPositions");

    const positions = await collection
      .find({
        walletAddress,
        status: "active",
      })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      positions: positions.map((pos) => ({
        id: pos._id.toString(),
        originalSymbol: pos.originalSymbol,
        tokenSymbol: pos.tokenSymbol,
        tokenContractAddress: pos.tokenContractAddress,
        alpacaPositionQty: pos.alpacaPositionQty,
        tokenizedQty: pos.tokenizedQty,
        frozenQty: pos.frozenQty,
        availableQty: pos.availableQty,
        tokenizations: pos.tokenizations,
        createdAt: pos.createdAt,
        updatedAt: pos.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching tokenized positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch positions", details: error.message },
      { status: 500 }
    );
  }
}

