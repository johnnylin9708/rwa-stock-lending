"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWeb3 } from "@/context/web3-provider";
import { Button } from "@/components/ui/button";

interface Transaction {
    type: string;
    assetSymbol: string;
    amount: string;
    txHash: string;
    blockNumber: number;
    timestamp: string | null;
    liquidator?: string;
}

export default function HistoryPage() {
    const { address, isAuthenticated, authenticateWallet } = useWeb3();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchHistory = async () => {
            if (!address) {
                setIsLoading(false);
                return;
            }
            
            try {
                const response = await fetch(`/api/lending/history?address=${address}`);
                const data = await response.json();
                setTransactions(data.transactions || []);
            } catch (error) {
                console.error("Failed to fetch history:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchHistory();
    }, [address]);
    
    if (!address || !isAuthenticated) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
                <h1 className="text-3xl font-bold mb-4">Transaction History</h1>
                <p className="text-muted-foreground mb-6">
                    Sign in to view your transaction history
                </p>
                <Button onClick={authenticateWallet} size="lg">
                    Sign In
                </Button>
            </div>
        );
    }
    
    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <p className="text-lg">Loading transaction history...</p>
            </div>
        );
    }
    
    const getTypeColor = (type: string) => {
        switch (type) {
            case "DEPOSIT":
                return "text-green-600";
            case "WITHDRAW":
                return "text-blue-600";
            case "BORROW":
                return "text-orange-600";
            case "REPAY":
                return "text-purple-600";
            case "LIQUIDATION":
                return "text-red-600";
            default:
                return "";
        }
    };
    
    const shortenHash = (hash: string) => {
        return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
    };
    
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Transaction History</h1>
            
            <Card>
                <CardHeader>
                    <CardTitle>Your Lending Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    {transactions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No transactions found
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Asset</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Transaction</TableHead>
                                    <TableHead>Block</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map((tx, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <span className={`font-medium ${getTypeColor(tx.type)}`}>
                                                {tx.type}
                                            </span>
                                        </TableCell>
                                        <TableCell>{tx.assetSymbol}</TableCell>
                                        <TableCell>
                                            {parseFloat(tx.amount).toFixed(4)}
                                        </TableCell>
                                        <TableCell>
                                            <a
                                                href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline"
                                            >
                                                {shortenHash(tx.txHash)}
                                            </a>
                                        </TableCell>
                                        <TableCell>{tx.blockNumber}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

