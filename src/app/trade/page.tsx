"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define a type for the order form state
interface OrderFormState {
    symbol: string;
    qty: string;
    side: "buy" | "sell";
    type: "market" | "limit" | "stop" | "stop_limit";
    time_in_force: "day" | "gtc" | "opg" | "cls";
    limit_price?: string;
    stop_price?: string;
}

export default function TradePage() {
    const [formData, setFormData] = useState<OrderFormState>({
        symbol: "",
        qty: "",
        side: "buy",
        type: "market",
        time_in_force: "day",
    });
    const [message, setMessage] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSelectChange = (id: keyof OrderFormState) => (value: string) => {
        setFormData({ ...formData, [id]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("Submitting order...");

        const response = await fetch("/api/alpaca/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (response.ok) {
            setMessage(`Order submitted successfully! Order ID: ${result.id}`);
        } else {
            setMessage(`Error: ${result.message}`);
        }
    };

    return (
        <div className="p-8 flex justify-center">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>Place an Order</CardTitle>
                    <CardDescription>Submit a trade to be executed on Alpaca.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="symbol">Symbol</Label>
                            <Input id="symbol" placeholder="e.g., AAPL, TSLA" onChange={handleChange} value={formData.symbol} required />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="side">Side</Label>
                                <Select onValueChange={handleSelectChange("side")} defaultValue="buy">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="buy">Buy</SelectItem>
                                        <SelectItem value="sell">Sell</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="qty">Quantity</Label>
                                <Input id="qty" type="number" placeholder="e.g., 10" onChange={handleChange} value={formData.qty} required />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="type">Order Type</Label>
                                <Select onValueChange={handleSelectChange("type")} defaultValue="market">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="market">Market</SelectItem>
                                        <SelectItem value="limit">Limit</SelectItem>
                                        <SelectItem value="stop">Stop</SelectItem>
                                        <SelectItem value="stop_limit">Stop Limit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="time_in_force">Time in Force</Label>
                                <Select onValueChange={handleSelectChange("time_in_force")} defaultValue="day">
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="day">Day</SelectItem>
                                        <SelectItem value="gtc">Good 'til Canceled (GTC)</SelectItem>
                                        <SelectItem value="opg">On Open</SelectItem>
                                        <SelectItem value="cls">On Close</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        {(formData.type === 'limit' || formData.type === 'stop_limit') && (
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="limit_price">Limit Price</Label>
                                <Input id="limit_price" type="number" placeholder="e.g., 150.00" onChange={handleChange} value={formData.limit_price} required />
                            </div>
                        )}

                        {(formData.type === 'stop' || formData.type === 'stop_limit') && (
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="stop_price">Stop Price</Label>
                                <Input id="stop_price" type="number" placeholder="e.g., 145.00" onChange={handleChange} value={formData.stop_price} required />
                            </div>
                        )}

                        <Button type="submit" className="w-full">Submit Order</Button>
                    </form>
                    {message && <p className="mt-4 text-center">{message}</p>}
                </CardContent>
            </Card>
        </div>
    );
}
