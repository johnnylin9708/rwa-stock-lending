"use client";

import { useState, useEffect, useId } from "react";
// Removed unused Card imports
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWeb3 } from "@/context/web3-provider";
import { SUPPORTED_ASSETS } from "@/lib/constants";
import { CompoundService, createCompoundService } from "@/lib/compound-client";

export default function ApplyPage() {
  const { address, isAuthenticated, authenticateWallet, sessionToken, signer } = useWeb3();
  const [selectedAsset, setSelectedAsset] = useState("");
  const [assetAmount, setAssetAmount] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [assetPrice, setAssetPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [applications, setApplications] = useState<Array<{
    _id: string;
    assetSymbol: string;
    assetAmount: number;
    assetValue: number;
    requestedLoanAmount: number;
    estimatedAPY: number;
    status: string;
    submittedAt: string;
    mintTxHash?: string;
  }>>([]);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  
  // Compound III 相關狀態
  const [compoundService, setCompoundService] = useState<CompoundService | null>(null);
  const [accountHealth, setAccountHealth] = useState<any>(null);
  const [userBalances, setUserBalances] = useState<any>(null);
  const [borrowingPower, setBorrowingPower] = useState("0");
  const [isCompoundLoading, setIsCompoundLoading] = useState(false);
  
  const amountInputId = useId();
  const loanInputId = useId();
  
  // 初始化 Compound III 服務
  useEffect(() => {
    if (signer && isAuthenticated) {
      try {
        const service = createCompoundService(signer.provider);
        setCompoundService(service);
        console.log("Compound service initialized");
      } catch (error) {
        console.error("Failed to initialize Compound service:", error);
      }
    }
  }, [signer, isAuthenticated]);
  
  // 監控帳戶健康狀態和餘額
  useEffect(() => {
    if (compoundService && address) {
      const checkCompoundStatus = async () => {
        try {
          const [health, balances, power] = await Promise.all([
            compoundService.getAccountHealth(address),
            compoundService.getUserBalances(address),
            compoundService.getBorrowingPower(address)
          ]);
          
          setAccountHealth(health);
          setUserBalances(balances);
          setBorrowingPower(power);
          
          console.log("Compound status updated:", { health, balances, power });
        } catch (error) {
          console.error("Failed to check Compound status:", error);
        }
      };
      
      checkCompoundStatus();
      const interval = setInterval(checkCompoundStatus, 15000); // 每15秒檢查一次
      return () => clearInterval(interval);
    }
  }, [compoundService, address]);
  
  // Fetch token balances for all supported assets
  useEffect(() => {
    if (sessionToken && address) {
      const fetchBalances = async () => {
        const balances: Record<string, string> = {};
        
        for (const asset of SUPPORTED_ASSETS) {
          try {
            const response = await fetch('/api/erc3643/token/mint', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              balances[asset.tokenAddress] = data.balance || "0";
            } else {
              balances[asset.tokenAddress] = "0";
            }
          } catch (error) {
            console.error(`Failed to fetch balance for ${asset.symbol}:`, error);
            balances[asset.tokenAddress] = "0";
          }
        }
        
        setTokenBalances(balances);
      };
      
      fetchBalances();
    }
  }, [sessionToken, address]);
  
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
  
  // Compound III 操作函數
  const handleSupplyCollateral = async () => {
    if (!compoundService || !signer || !assetAmount) {
      alert("請先連接錢包並輸入數量");
      return;
    }
    
    setIsCompoundLoading(true);
    try {
      const tx = await compoundService.supplyCollateral(assetAmount, signer);
      console.log("Collateral supplied:", tx);
      
      // 等待交易確認
      await tx.wait();
      alert("抵押品存入成功！");
      
      // 刷新狀態
      const [health, balances, power] = await Promise.all([
        compoundService.getAccountHealth(address!),
        compoundService.getUserBalances(address!),
        compoundService.getBorrowingPower(address!)
      ]);
      
      setAccountHealth(health);
      setUserBalances(balances);
      setBorrowingPower(power);
      
    } catch (error: any) {
      console.error("Supply failed:", error);
      alert(`存入失敗: ${error.message}`);
    } finally {
      setIsCompoundLoading(false);
    }
  };
  
  const handleBorrow = async () => {
    if (!compoundService || !signer || !loanAmount) {
      alert("請先連接錢包並輸入借貸數量");
      return;
    }
    
    setIsCompoundLoading(true);
    try {
      const tx = await compoundService.borrow(loanAmount, signer);
      console.log("Borrowed:", tx);
      
      // 等待交易確認
      await tx.wait();
      alert("借貸成功！");
      
      // 刷新狀態
      const [health, balances, power] = await Promise.all([
        compoundService.getAccountHealth(address!),
        compoundService.getUserBalances(address!),
        compoundService.getBorrowingPower(address!)
      ]);
      
      setAccountHealth(health);
      setUserBalances(balances);
      setBorrowingPower(power);
      
    } catch (error: any) {
      console.error("Borrow failed:", error);
      alert(`借貸失敗: ${error.message}`);
    } finally {
      setIsCompoundLoading(false);
    }
  };
  
  const handleRepay = async () => {
    if (!compoundService || !signer || !loanAmount) {
      alert("請先連接錢包並輸入還款數量");
      return;
    }
    
    setIsCompoundLoading(true);
    try {
      const tx = await compoundService.repay(loanAmount, signer);
      console.log("Repaid:", tx);
      
      // 等待交易確認
      await tx.wait();
      alert("還款成功！");
      
      // 刷新狀態
      const [health, balances, power] = await Promise.all([
        compoundService.getAccountHealth(address!),
        compoundService.getUserBalances(address!),
        compoundService.getBorrowingPower(address!)
      ]);
      
      setAccountHealth(health);
      setUserBalances(balances);
      setBorrowingPower(power);
      
    } catch (error: any) {
      console.error("Repay failed:", error);
      alert(`還款失敗: ${error.message}`);
    } finally {
      setIsCompoundLoading(false);
    }
  };
  
  const handleWithdrawCollateral = async () => {
    if (!compoundService || !signer || !assetAmount) {
      alert("請先連接錢包並輸入提取數量");
      return;
    }
    
    setIsCompoundLoading(true);
    try {
      const tx = await compoundService.withdrawCollateral(assetAmount, signer);
      console.log("Withdrawn:", tx);
      
      // 等待交易確認
      await tx.wait();
      alert("抵押品提取成功！");
      
      // 刷新狀態
      const [health, balances, power] = await Promise.all([
        compoundService.getAccountHealth(address!),
        compoundService.getUserBalances(address!),
        compoundService.getBorrowingPower(address!)
      ]);
      
      setAccountHealth(health);
      setUserBalances(balances);
      setBorrowingPower(power);
      
    } catch (error: any) {
      console.error("Withdraw failed:", error);
      alert(`提取失敗: ${error.message}`);
    } finally {
      setIsCompoundLoading(false);
    }
  };
  
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
    
    // Check if user has enough token balance
    const asset = SUPPORTED_ASSETS.find(a => a.symbol === selectedAsset);
    const availableBalance = parseFloat(tokenBalances[asset?.tokenAddress || ""] || "0");
    const requestedAmount = parseFloat(assetAmount);
    
    if (requestedAmount > availableBalance) {
      alert(`Insufficient balance. You have ${availableBalance} tokens available.`);
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
  
  if (!address || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Apply for DeFi Collateral Lending</h1>
          <p className="text-sm text-gray-500 mb-8">
            Sign in to get started
          </p>
          <Button
            onClick={authenticateWallet}
            className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Sign In
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
      
        {/* Token Balances Overview */}
        <div className="mb-6 border border-gray-200 rounded-lg p-6 bg-white">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Your Tokenized Assets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SUPPORTED_ASSETS.map((asset) => {
              const balance = tokenBalances[asset.tokenAddress] || "0";
              const balanceNum = parseFloat(balance);
              
              return (
                <div key={asset.symbol} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-600">{asset.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{asset.symbol}</span>
                        <p className="text-xs text-gray-500">← {asset.originalSymbol}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${balanceNum > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {balanceNum.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 4
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Collateral Factor:</span>
                      <span>{(asset.collateralFactor * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={balanceNum > 0 ? 'text-green-600' : 'text-gray-400'}>
                        {balanceNum > 0 ? 'Available' : 'No Balance'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compound III 狀態面板 */}
        {compoundService && (
          <div className="mb-6 border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Compound III 狀態</h2>
            
            {/* 帳戶健康狀態 */}
            {accountHealth && (
              <div className={`p-4 rounded-lg mb-4 ${
                accountHealth.isCollateralized ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">帳戶健康狀態</span>
                  <span className={`px-2 py-1 rounded text-sm ${
                    accountHealth.isCollateralized ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {accountHealth.isCollateralized ? '健康' : '危險'}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  健康因子: {accountHealth.healthFactorNumber.toFixed(2)}
                </div>
                {accountHealth.isLiquidatable && (
                  <p className="text-red-600 text-sm mt-2">⚠️ 帳戶可能被清算</p>
                )}
              </div>
            )}
            
            {/* 用戶餘額 */}
            {userBalances && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">TSPY 抵押品</div>
                  <div className="font-medium">{parseFloat(userBalances.tspyCollateral).toFixed(2)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">USDC 供應</div>
                  <div className="font-medium">{parseFloat(userBalances.usdcSupply).toFixed(2)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">USDC 借貸</div>
                  <div className="font-medium">{parseFloat(userBalances.usdcBorrow).toFixed(2)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">TSPY 錢包</div>
                  <div className="font-medium">{parseFloat(userBalances.tspyWalletBalance).toFixed(2)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">USDC 錢包</div>
                  <div className="font-medium">{parseFloat(userBalances.usdcWalletBalance).toFixed(2)}</div>
                </div>
              </div>
            )}
            
            {/* 借貸能力 */}
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <div className="text-sm text-gray-500">借貸能力</div>
              <div className="font-medium text-blue-900">${parseFloat(borrowingPower).toFixed(2)} USDC</div>
            </div>
            
            {/* Compound III 操作按鈕 */}
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={handleSupplyCollateral} 
                disabled={isCompoundLoading || !assetAmount}
                className="w-full"
              >
                {isCompoundLoading ? "處理中..." : "存入 TSPY 抵押品"}
              </Button>
              <Button 
                onClick={handleBorrow} 
                disabled={isCompoundLoading || !loanAmount}
                className="w-full"
              >
                {isCompoundLoading ? "處理中..." : "借出 USDC"}
              </Button>
              <Button 
                onClick={handleRepay} 
                disabled={isCompoundLoading || !loanAmount}
                className="w-full"
              >
                {isCompoundLoading ? "處理中..." : "還款 USDC"}
              </Button>
              <Button 
                onClick={handleWithdrawCollateral} 
                disabled={isCompoundLoading || !assetAmount}
                className="w-full"
              >
                {isCompoundLoading ? "處理中..." : "提取抵押品"}
              </Button>
            </div>
          </div>
        )}

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
                        {asset.name} ({asset.originalSymbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Asset Amount</Label>
                <Input
                  id={amountInputId}
                  type="number"
                  value={assetAmount}
                  onChange={(e) => setAssetAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  max={selectedAsset ? tokenBalances[SUPPORTED_ASSETS.find(a => a.symbol === selectedAsset)?.tokenAddress || ""] || "0" : undefined}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
                />
                {selectedAsset && (
                  <div className="mt-1.5 space-y-1">
                    <p className="text-xs text-gray-500">
                      Value: ${assetValue.toFixed(2)}
                    </p>
                    <p className="text-xs text-blue-600">
                      Available Balance: {tokenBalances[SUPPORTED_ASSETS.find(a => a.symbol === selectedAsset)?.tokenAddress || ""] || "0"} tokens
                    </p>
                  </div>
                )}
              </div>
              
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount (USDC)</Label>
                <Input
                  id={loanInputId}
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

