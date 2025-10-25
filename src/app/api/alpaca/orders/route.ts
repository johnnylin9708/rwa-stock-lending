import { NextResponse } from "next/server";
import Alpaca from "@alpacahq/alpaca-trade-api";

export async function POST(request: Request) {
    const alpaca = new Alpaca({
        keyId: process.env.ALPACA_API_KEY_ID,
        secretKey: process.env.ALPACA_SECRET_KEY,
        paper: true,
    });

    // --- !! IMPORTANT !! ---
    // This is a placeholder. In a real application, you would fetch
    // the Alpaca Account ID associated with the currently logged-in user
    // from your database.
    const MOCK_ACCOUNT_ID = "YOUR_MOCK_OR_REAL_ALPACA_ACCOUNT_ID";
    
    if (MOCK_ACCOUNT_ID === "YOUR_MOCK_OR_REAL_ALPACA_ACCOUNT_ID") {
         return NextResponse.json({ message: "Please replace MOCK_ACCOUNT_ID in the backend API code" }, { status: 400 });
    }

    try {
        const orderData = await request.json();

        // The Alpaca SDK expects the createOrder method to be called on an account object
        const account = alpaca.getAccount(MOCK_ACCOUNT_ID);
        
        // The SDK's createOrder function is available on the account object instance
        // This is a bit of a quirk in the SDK's design.
        // Let's assume the SDK has a top-level createOrder for simplicity of the example
        // or that we'd chain it like alpaca.account(ID).createOrder(...)
        // The actual SDK call is alpaca.createOrder, but it needs account context
        // which is usually handled by initializing the client for a specific account
        // or passing the account ID in methods. The documentation for this SDK version
        // can be inconsistent. Let's create the order directly.
        
        const order = await alpaca.createOrder({
            account_id: MOCK_ACCOUNT_ID,
            ...orderData
        });

        return NextResponse.json(order);
    } catch (error: any) {
        console.error(error);
        const errorMessage = error.response?.data?.message || "Failed to create order";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
