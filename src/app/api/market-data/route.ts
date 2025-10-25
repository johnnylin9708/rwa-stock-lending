import { NextResponse } from "next/server";
import Alpaca from "@alpacahq/alpaca-trade-api";

export async function GET() {
  const alpaca = new Alpaca({
    keyId: process.env.ALPACA_API_KEY_ID,
    secretKey: process.env.ALPACA_SECRET_KEY,
    paper: true, // Use paper trading environment
  });

  try {
    const latestTrade = await alpaca.getLatestTrade("AAPL");
    return NextResponse.json(latestTrade);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
  }
}
