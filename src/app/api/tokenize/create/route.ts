import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, symbol, amount, txHash } = await req.json();

    if (!walletAddress || !symbol || !amount || !txHash) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const collection = db.collection("tokenizedPositions");

    // Check if position exists for this user and symbol
    const existingPosition = await collection.findOne({
      walletAddress,
      originalSymbol: symbol,
      status: "active",
    });

    const now = new Date();

    if (existingPosition) {
      // Update existing position
      const result = await collection.updateOne(
        { _id: existingPosition._id },
        {
          $inc: {
            tokenizedQty: amount,
            frozenQty: amount,
          },
          $set: {
            availableQty: existingPosition.alpacaPositionQty - (existingPosition.frozenQty + amount),
            updatedAt: now,
          },
          $push: {
            tokenizations: {
              amount,
              txHash,
              timestamp: now,
              status: "pending",
            },
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: "Position updated successfully",
        positionId: existingPosition._id,
      });
    } else {
      // Create new position
      // We need to get the current Alpaca position quantity
      // For now, we'll use the amount as the total position
      const tokenSymbol = `T${symbol}`;
      const tokenContractAddress = process.env[`NEXT_PUBLIC_${tokenSymbol}_ADDRESS`] || "0x0000000000000000000000000000000000000000";

      const newPosition = {
        userId: walletAddress, // Using wallet address as userId for now
        walletAddress,
        originalSymbol: symbol,
        alpacaPositionQty: amount, // This should be fetched from Alpaca in production
        tokenizedQty: amount,
        frozenQty: amount,
        availableQty: 0,
        tokenSymbol,
        tokenContractAddress,
        tokenizations: [
          {
            amount,
            txHash,
            timestamp: now,
            status: "pending",
          },
        ],
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      const result = await collection.insertOne(newPosition);

      return NextResponse.json({
        success: true,
        message: "Position created successfully",
        positionId: result.insertedId,
      });
    }
  } catch (error: any) {
    console.error("Error creating tokenized position:", error);
    return NextResponse.json(
      { error: "Failed to create tokenized position", details: error.message },
      { status: 500 }
    );
  }
}

