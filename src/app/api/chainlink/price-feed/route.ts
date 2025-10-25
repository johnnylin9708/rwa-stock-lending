import { NextResponse } from "next/server";
import { ethers } from "ethers";

// Chainlink ETH/USD Price Feed on Sepolia Testnet
const CHAINLINK_ETH_USD_ADDRESS = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
const CHAINLINK_PRICE_FEED_ABI = [
  {
    "inputs": [],
    "name": "latestRoundData",
    "outputs": [
      { "internalType": "uint80", "name": "roundId", "type": "uint80" },
      { "internalType": "int256", "name": "answer", "type": "int256" },
      { "internalType": "uint256", "name": "startedAt", "type": "uint256" },
      { "internalType": "uint256", "name": "updatedAt", "type": "uint256" },
      { "internalType": "uint80", "name": "answeredInRound", "type": "uint80" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
];

export async function GET() {
    const rpcUrl = process.env.ETHEREUM_RPC_URL;

    if (!rpcUrl) {
        return NextResponse.json({ message: "ETHEREUM_RPC_URL is not set in environment variables" }, { status: 500 });
    }
    
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const priceFeed = new ethers.Contract(CHAINLINK_ETH_USD_ADDRESS, CHAINLINK_PRICE_FEED_ABI, provider);

        const [roundData, decimals] = await Promise.all([
            priceFeed.latestRoundData(),
            priceFeed.decimals()
        ]);

        const price = Number(roundData.answer) / (10 ** Number(decimals));

        return NextResponse.json({ 
            price: price,
            updatedAt: new Date(Number(roundData.updatedAt) * 1000).toISOString() 
        });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ message: "Failed to fetch price from Chainlink" }, { status: 500 });
    }
}
