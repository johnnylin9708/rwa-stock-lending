import { NextResponse } from "next/server";
import Alpaca from "@alpacahq/alpaca-trade-api";

export async function GET() {
    const alpaca = new Alpaca({
        keyId: process.env.ALPACA_API_KEY,
        secretKey: process.env.ALPACA_API_SECRET,
        paper: true,
    });

    try {
        // Fetch account details and positions in parallel
        const [account, positions] = await Promise.all([
            alpaca.getAccount(),
            alpaca.getPositions()
        ]);
        
        return NextResponse.json({ account, positions });

    } catch (error: any) {
        console.error(error);
        const errorMessage = error.response?.data?.message || "Failed to fetch portfolio data";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
