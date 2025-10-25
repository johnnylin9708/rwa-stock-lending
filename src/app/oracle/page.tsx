"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PriceData {
    price: number;
    updatedAt: string;
}

export default function OraclePage() {
    const [priceData, setPriceData] = useState<PriceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPrice() {
            try {
                const response = await fetch("/api/chainlink/price-feed");
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || "Failed to fetch price");
                }
                const data = await response.json();
                setPriceData(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }

        fetchPrice();
        // Optional: Poll for new prices every 30 seconds
        const intervalId = setInterval(fetchPrice, 30000);

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="p-8 flex justify-center">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Chainlink Price Oracle</CardTitle>
                    <CardDescription>Live ETH/USD price feed from Chainlink on Sepolia.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p>Loading price...</p>
                    ) : error ? (
                        <p className="text-red-500">Error: {error}</p>
                    ) : priceData ? (
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">ETH / USD</p>
                            <p className="text-5xl font-bold my-2">${priceData.price.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">
                                Last Updated: {new Date(priceData.updatedAt).toLocaleString()}
                            </p>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
