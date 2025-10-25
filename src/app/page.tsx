"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const [aaplPrice, setAaplPrice] = useState<number | null>(null);

  useEffect(() => {
    async function fetchPrice() {
      try {
        const response = await fetch("/api/market-data");
        const data = await response.json();
        setAaplPrice(data.trade.p);
      } catch (error) {
        console.error("Failed to fetch AAPL price:", error);
      }
    }
    fetchPrice();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-4">Welcome to RWA Lending Platform</h1>
      <p className="text-xl mb-8">
        The future of finance is here. Lend and borrow tokenized stocks and bonds with ease.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Asset Display</CardTitle>
            <CardDescription>View available stocks and bonds for lending and borrowing.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Apple Inc. (AAPL): ${aaplPrice ? aaplPrice.toFixed(2) : "Loading..."}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lending/Borrowing</CardTitle>
            <CardDescription>Apply for a loan or lend your assets.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Loan application and management interface.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Trading</CardTitle>
            <CardDescription>Execute trades directly on the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Trading interface powered by Alpaca.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
