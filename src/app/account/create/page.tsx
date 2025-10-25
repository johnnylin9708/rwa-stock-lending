"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateAccountPage() {
    const [formData, setFormData] = useState({
        given_name: "",
        family_name: "",
        email_address: "",
        street_address: "",
        city: "",
        state: "",
        postal_code: "",
        country: "USA",
    });
    const [message, setMessage] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("Submitting account application...");

        const response = await fetch("/api/alpaca/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (response.ok) {
            setMessage(`Account created successfully! Account ID: ${result.id}`);
        } else {
            setMessage(`Error: ${result.message}`);
        }
    };

    return (
        <div className="p-8 flex justify-center">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle>Create Alpaca Brokerage Account</CardTitle>
                    <CardDescription>Fill out the form below to open an account with Alpaca.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="given_name">First Name</Label>
                            <Input id="given_name" placeholder="John" onChange={handleChange} required />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="family_name">Last Name</Label>
                            <Input id="family_name" placeholder="Doe" onChange={handleChange} required />
                        </div>
                        <div className="md:col-span-2 flex flex-col space-y-1.5">
                            <Label htmlFor="email_address">Email Address</Label>
                            <Input id="email_address" type="email" placeholder="john.doe@example.com" onChange={handleChange} required />
                        </div>
                        <div className="md:col-span-2 flex flex-col space-y-1.5">
                            <Label htmlFor="street_address">Street Address</Label>
                            <Input id="street_address" placeholder="123 Main St" onChange={handleChange} required />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" placeholder="Anytown" onChange={handleChange} required />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="state">State</Label>
                            <Input id="state" placeholder="CA" onChange={handleChange} required />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="postal_code">Postal Code</Label>
                            <Input id="postal_code" placeholder="12345" onChange={handleChange} required />
                        </div>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="country">Country</Label>
                            <Input id="country" value="USA" readOnly />
                        </div>
                        <div className="md:col-span-2">
                            <Button type="submit" className="w-full">Create Account</Button>
                        </div>
                    </form>
                    {message && <p className="mt-4 text-center">{message}</p>}
                </CardContent>
            </Card>
        </div>
    );
}
