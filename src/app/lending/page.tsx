"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWeb3 } from "@/context/web3-provider";
import { SUPPORTED_ASSETS } from "@/lib/constants";

export default function ApplyPage() {
  const { address, connectWallet } = useWeb3();
  const [selectedAsset, setSelectedAsset] = useState("");
  const [assetAmount, setAssetAmount] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [assetPrice, setAssetPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [applications, setApplications] = useState<any[]>([]);
  
  // Fetch asset price
  useEffect(() => {
    if (selectedAsset) {
      const asset = SUPPORTED_ASSETS.find(a => a.symbol === selectedAsset);
      if (asset) {
        fetch("/api/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: asset.originalSymbol })
        })
          .then(res => res.json())
          .then(data => setAssetPrice(data.price || 100))
          .catch(() => setAssetPrice(100));
      }
    }
  }, [selectedAsset]);
  
  // Fetch user applications
  useEffect(() => {
    if (address) {
      fetch(`/api/loan/apply?address=${address}`)
        .then(res => res.json())
        .then(data => setApplications(data.applications || []))
        .catch(console.error);
    }
  }, [address]);
  
  // Calculate loan information
  const assetValue = parseFloat(assetAmount) * assetPrice;
  const asset = SUPPORTED_ASSETS.find(a => a.symbol === selectedAsset);
  const collateralFactor = asset?.collateralFactor || 0.75;
  const maxLoan = assetValue * collateralFactor;
  
  // Submit application
  const handleSubmit = async () => {
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }
    
    if (!selectedAsset || !assetAmount || !loanAmount) {
      alert("Please fill in all fields");
      return;
    }
    
    if (parseFloat(loanAmount) > maxLoan) {
      alert(`Loan amount cannot exceed $${maxLoan.toFixed(2)}`);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/loan/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          assetSymbol: selectedAsset,
          assetAmount: parseFloat(assetAmount),
          requestedLoanAmount: parseFloat(loanAmount)
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        // Refresh application list
        const appsRes = await fetch(`/api/loan/apply?address=${address}`);
        const appsData = await appsRes.json();
        setApplications(appsData.applications || []);
        
        // Clear form
        setSelectedAsset("");
        setAssetAmount("");
        setLoanAmount("");
      } else {
        alert(data.error || "Application failed");
      }
    } catch (error) {
      console.error("Application failed:", error);
      alert("Application failed, please retry");
    } finally {
      setIsLoading(false);
    }
  };
  
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'submitted': 'Submitted',
      'bank_processing': 'Bank Processing',
      'bank_confirmed': 'Bank Confirmed',
      'minting': 'Minting',
      'completed': 'Completed',
      'rejected': 'Rejected'
    };
    return statusMap[status] || status;
  };
  
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      'submitted': 'bg-blue-50 text-blue-700',
      'bank_confirmed': 'bg-green-50 text-green-700',
      'minting': 'bg-purple-50 text-purple-700',
      'completed': 'bg-gray-100 text-gray-700',
      'rejected': 'bg-red-50 text-red-700'
    };
    return colorMap[status] || 'bg-gray-50 text-gray-600';
  };
  
  if (!address) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Apply for DeFi Collateral Lending</h1>
          <p className="text-sm text-gray-500 mb-8">
            Connect your wallet to get started
          </p>
          <Button
            onClick={connectWallet}
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Apply for Loan</h1>
          <p className="text-sm text-gray-500">Use tokenized assets as collateral to borrow stablecoins</p>
        </div>
      
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Loan Application Form */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-lg font-medium text-gray-900 mb-1">Loan Application</h2>
            <p className="text-sm text-gray-500 mb-6">Select collateral asset and apply for loan</p>
            <div className="space-y-5">
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Collateral Asset</Label>
                <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_ASSETS.map(asset => (
                      <SelectItem key={asset.symbol} value={asset.symbol}>
                        {asset.icon} {asset.name} ({asset.originalSymbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Asset Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={assetAmount}
                  onChange={(e) => setAssetAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                />
                {assetAmount && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Value: ${assetValue.toFixed(2)}
                  </p>
                )}
              </div>
              
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount (USDC)</Label>
                <Input
                  id="loan"
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                />
                {assetAmount && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Max Borrow: ${maxLoan.toFixed(2)} (Collateral Factor: {(collateralFactor * 100).toFixed(0)}%)
                  </p>
                )}
              </div>
            
              {selectedAsset && assetAmount && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Asset Price</span>
                      <span className="font-medium text-gray-900">${assetPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Collateral Value</span>
                      <span className="font-medium text-gray-900">${assetValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Collateral Factor</span>
                      <span className="font-medium text-gray-900">{(collateralFactor * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Est. APY</span>
                      <span className="font-semibold text-gray-900">7.0%</span>
                    </div>
                  </div>
                </div>
              )}
              
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !selectedAsset || !assetAmount || !loanAmount}
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isLoading ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </div>
        
          {/* My Applications */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-lg font-medium text-gray-900 mb-1">My Applications</h2>
            <p className="text-sm text-gray-500 mb-6">View loan application status</p>
            
            {applications.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">No applications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <div key={app._id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">
                            {app.assetSymbol} × {app.assetAmount}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(app.submittedAt).toLocaleDateString('en-US')}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(app.status)}`}>
                          {getStatusText(app.status)}
                        </span>
                      </div>
                      <div className="text-sm space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Collateral Value</span>
                          <span className="text-gray-700">${app.assetValue.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Loan Amount</span>
                          <span className="font-medium text-gray-900">${app.requestedLoanAmount}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Interest Rate</span>
                          <span className="text-gray-700">{app.estimatedAPY.toFixed(2)}%</span>
                        </div>
                        {app.mintTxHash && (
                          <div className="flex justify-between text-xs pt-1.5 border-t border-gray-100">
                            <span className="text-gray-500">Tx Hash</span>
                            <span className="font-mono text-gray-700">
                              {app.mintTxHash.slice(0, 10)}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

