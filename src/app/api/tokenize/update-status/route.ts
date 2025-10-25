import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const { positionId, txHash, status, blockNumber } = await req.json();

    if (!positionId || !txHash || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const collection = db.collection("tokenizedPositions");

    // Update the status of specific tokenization
    const result = await collection.updateOne(
      {
        _id: new ObjectId(positionId),
        "tokenizations.txHash": txHash,
      },
      {
        $set: {
          "tokenizations.$.status": status,
          "tokenizations.$.blockNumber": blockNumber,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Position or transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Status updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating tokenization status:", error);
    return NextResponse.json(
      { error: "Failed to update status", details: error.message },
      { status: 500 }
    );
  }
}

