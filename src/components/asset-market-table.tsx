"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWeb3 } from "@/context/web3-provider";
import { ethers } from "ethers";
import { lendingContractABI, lendingContractAddress, tokenizedAssetABI } from "@/contracts";

interface Asset {
    symbol: string;
    originalSymbol: string;
    name: string;
    price: number;
    collateralFactor: number;
    borrowAPY: number;
    supplyAPY: number;
    totalBorrows: string;
    totalSupply: string;
    type: string;
}

interface AssetMarketTableProps {
    assets: Asset[];
    mode: "deposit" | "borrow";
    onSuccess?: () => void;
}

export function AssetMarketTable({ assets, mode, onSuccess }: AssetMarketTableProps) {
    const { signer, address } = useWeb3();
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [amount, setAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    
    const handleSubmit = async () => {
        if (!signer || !selectedAsset || !address) {
            alert("Please connect your wallet");
            return;
        }
        
        if (parseFloat(amount) <= 0) {
            alert("Please enter a valid amount");
            return;
        }
        
        setIsLoading(true);
        
        try {
            const lendingContract = new ethers.Contract(
                lendingContractAddress,
                lendingContractABI,
                signer
            );
            
            const amountWei = ethers.parseUnits(amount, 18);
            
            if (mode === "deposit") {
                // Get token contract address from lending pool
                const market = await lendingContract.markets(selectedAsset.symbol);
                const tokenAddress = market.tokenContract;
                
                // Approve token spending first
                const tokenContract = new ethers.Contract(
                    tokenAddress,
                    tokenizedAssetABI,
                    signer
                );
                
                const approveTx = await tokenContract.approve(lendingContractAddress, amountWei);
                await approveTx.wait();
                
                // Deposit collateral
                const depositTx = await lendingContract.depositCollateral(selectedAsset.symbol, amountWei);
                await depositTx.wait();
                
                alert("Collateral deposited successfully!");
            } else {
                // Borrow
                const borrowTx = await lendingContract.borrow(selectedAsset.symbol, amountWei);
                await borrowTx.wait();
                
                alert("Borrow successful!");
            }
            
            setDialogOpen(false);
            setAmount("");
            onSuccess?.();
            
        } catch (error: any) {
            console.error(`${mode} failed:`, error);
            alert(`Transaction failed: ${error.message || "Unknown error"}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Collateral Factor</TableHead>
                    <TableHead>Borrow APY</TableHead>
                    {mode === "deposit" && <TableHead>Supply APY</TableHead>}
                    <TableHead>Total {mode === "deposit" ? "Supply" : "Borrows"}</TableHead>
                    <TableHead></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {assets.map((asset) => (
                    <TableRow key={asset.symbol}>
                        <TableCell>
                            <div>
                                <p className="font-medium">{asset.symbol}</p>
                                <p className="text-xs text-muted-foreground">{asset.name}</p>
                            </div>
                        </TableCell>
                        <TableCell>${asset.price.toFixed(2)}</TableCell>
                        <TableCell>{(asset.collateralFactor * 100).toFixed(0)}%</TableCell>
                        <TableCell className="text-red-500">{asset.borrowAPY.toFixed(2)}%</TableCell>
                        {mode === "deposit" && (
                            <TableCell className="text-green-500">{asset.supplyAPY.toFixed(2)}%</TableCell>
                        )}
                        <TableCell>
                            {mode === "deposit" 
                                ? parseFloat(asset.totalSupply).toFixed(2)
                                : parseFloat(asset.totalBorrows).toFixed(2)
                            }
                        </TableCell>
                        <TableCell className="text-right">
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button 
                                        onClick={() => setSelectedAsset(asset)}
                                        variant={mode === "deposit" ? "default" : "outline"}
                                    >
                                        {mode === "deposit" ? "Deposit" : "Borrow"}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>
                                            {mode === "deposit" ? "Deposit" : "Borrow"} {selectedAsset?.symbol}
                                        </DialogTitle>
                                        <DialogDescription>
                                            {mode === "deposit" 
                                                ? "Deposit your tokenized assets as collateral to enable borrowing."
                                                : "Borrow stablecoins against your collateral."
                                            }
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="amount">Amount</Label>
                                            <Input
                                                id="amount"
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder="0.0"
                                                step="0.01"
                                            />
                                            {selectedAsset && (
                                                <p className="text-xs text-muted-foreground">
                                                    Current Price: ${selectedAsset.price.toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleSubmit} disabled={isLoading}>
                                            {isLoading ? "Processing..." : "Confirm"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

