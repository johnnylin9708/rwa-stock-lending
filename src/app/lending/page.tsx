"use client";

import { useState, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWeb3 } from "@/context/web3-provider";
import { SUPPORTED_ASSETS } from "@/lib/constants";
import {
  supplyCollateral,
  borrow,
  repay,
  withdrawCollateral,
  getAccountHealth,
  getUserBalances,
  getBorrowingPower,
  getTotalSupplyBase,
  getTotalBorrowBase,
  getTstockTotalValue,
  supplyUsdcSupply,
} from "@/lib/compound-client";
import { getTokenizedStockBalance } from "../actions/erc3643";

interface AccountHealth {
  isCollateralized: boolean;
  isLiquidatable: boolean;
  healthFactor: string;
  healthFactorNumber: number;
}

interface UserBalances {
  tspyCollateral: string;
  usdcSupply: string;
  usdcBorrow: string;
  tspyWalletBalance: string;
  usdcWalletBalance: string;
}

export default function LendingPage() {
  const { address, isAuthenticated, signer, connectWallet } = useWeb3();
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  
  // Compound III 相關狀態
  const [accountHealth, setAccountHealth] = useState<AccountHealth | null>(null);
  const [userBalances, setUserBalances] = useState<UserBalances | null>(null);
  const [borrowingPower, setBorrowingPower] = useState("0");
  const [isCompoundLoading, setIsCompoundLoading] = useState(false);
  const [totalSupplyBase, setTotalSupplyBase] = useState("0");
  const [totalBorrowBase, setTotalBorrowBase] = useState("0");
  const [tstockTotalValue, setTstockTotalValue] = useState("0");
  
  // Dialog 狀態
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [supplyUsdcDialogOpen, setSupplyUsdcDialogOpen] = useState(false);
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false);
  const [repayDialogOpen, setRepayDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  
  // Dialog 輸入值
  const [supplyAmount, setSupplyAmount] = useState("");
  const [supplyUsdcAmount, setSupplyUsdcAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  
  // 監控帳戶健康狀態和餘額
  useEffect(() => {
    if (signer && address && isAuthenticated) {
      const provider = signer.provider;
      if (!provider) return;

      const checkCompoundStatus = async () => {
        try {
          const [health, balances, power, totalSupplyBase, totalBorrowBase, tstockTotalValue] = await Promise.all([
            getAccountHealth(address, provider),
            getUserBalances(address, provider),
            getBorrowingPower(address, provider),
            getTotalSupplyBase(address, provider),
            getTotalBorrowBase(address, provider),
            getTstockTotalValue(address, provider)
          ]);
          
          setAccountHealth(health);
          setUserBalances(balances);
          setBorrowingPower(power);
          setTotalSupplyBase(totalSupplyBase);
          setTotalBorrowBase(totalBorrowBase);
          setTstockTotalValue(tstockTotalValue);
        } catch (error) {
          console.error("Failed to check Compound status:", error);
        }
      };
      
      checkCompoundStatus();
    }
  }, [signer, address, isAuthenticated]);
  
  // Fetch token balances for all supported assets
  useEffect(() => {
    if (address) {
      const fetchBalances = async () => {
        const balances: Record<string, string> = {};
        
        for (const asset of SUPPORTED_ASSETS) {
          try {
            const tStockBalance = await getTokenizedStockBalance(address)
            
            balances[asset.tokenAddress] = tStockBalance.balance || "0";
          } catch (error) {
            console.error(`Failed to fetch balance for ${asset.symbol}:`, error);
            balances[asset.tokenAddress] = "0";
          }
        }
        
        setTokenBalances(balances);
      };
      
      fetchBalances();
    }
  }, [address]);
  
  // Compound III 操作函數
  const handleSupplyCollateral = async () => {
    if (!signer || !supplyAmount || parseFloat(supplyAmount) <= 0) {
      alert("請輸入有效的數量");
      return;
    }
    
    setIsCompoundLoading(true);
    try {
      const tx = await supplyCollateral(supplyAmount, signer);
      console.log("Collateral supplied:", tx);
      
      // 等待交易確認
      await tx.wait();
      alert("抵押品存入成功！");
      setSupplyDialogOpen(false);
      setSupplyAmount("");
      
      // 刷新狀態
      if (address && signer.provider) {
        const [health, balances, power, totalSupplyBase, totalBorrowBase, tstockTotalValue] = await Promise.all([
          getAccountHealth(address, signer.provider),
          getUserBalances(address, signer.provider),
          getBorrowingPower(address, signer.provider),
          getTotalSupplyBase(address, signer.provider),
          getTotalBorrowBase(address, signer.provider),
          getTstockTotalValue(address, signer.provider)
        ]);
        
        setAccountHealth(health);
        setUserBalances(balances);
        setBorrowingPower(power);
        setTotalSupplyBase(totalSupplyBase);
        setTotalBorrowBase(totalBorrowBase);
        setTstockTotalValue(tstockTotalValue);
      }
      
    } catch (error: unknown) {
      console.error("Supply failed:", error);
      const errorMessage = error instanceof Error ? error.message : "未知錯誤";
      alert(`存入失敗: ${errorMessage}`);
    } finally {
      setIsCompoundLoading(false);
    }
  };

  const handleSupplyUsdcSupply = async () => {
    if (!signer || !supplyUsdcAmount || parseFloat(supplyUsdcAmount) <= 0) {
      alert("請輸入有效的數量");
      return;
    }
    
    setIsCompoundLoading(true);
    try {
      const tx = await supplyUsdcSupply(supplyUsdcAmount, signer);
      console.log("USDC supply supplied:", tx);
      
      // 等待交易確認
      await tx.wait();
      alert("USDC 供應存入成功！");
      setSupplyUsdcDialogOpen(false);
      setSupplyUsdcAmount("");
      
      // 刷新狀態
      if (address && signer.provider) {
        const [health, balances, power, totalSupplyBase, totalBorrowBase, tstockTotalValue] = await Promise.all([
          getAccountHealth(address, signer.provider),
          getUserBalances(address, signer.provider),
          getBorrowingPower(address, signer.provider),
          getTotalSupplyBase(address, signer.provider),
          getTotalBorrowBase(address, signer.provider),
          getTstockTotalValue(address, signer.provider)
        ]);
        
        setAccountHealth(health);
        setUserBalances(balances);
        setBorrowingPower(power);
        setTotalSupplyBase(totalSupplyBase);
        setTotalBorrowBase(totalBorrowBase);
        setTstockTotalValue(tstockTotalValue);
      }
      
    } catch (error: unknown) {
      console.error("USDC supply supply failed:", error);
      const errorMessage = error instanceof Error ? error.message : "未知錯誤";
      alert(`USDC 供應存入失敗: ${errorMessage}`);
    } finally {
      setIsCompoundLoading(false);
    }
  };
  
  const handleBorrow = async () => {
    if (!signer || !borrowAmount || parseFloat(borrowAmount) <= 0) {
      alert("請輸入有效的數量");
      return;
    }
    
    setIsCompoundLoading(true);
    try {
      const tx = await borrow(borrowAmount, signer);
      console.log("Borrowed:", tx);
      
      // 等待交易確認
      await tx.wait();
      alert("借貸成功！");
      setBorrowDialogOpen(false);
      setBorrowAmount("");
      
      // 刷新狀態
      if (address && signer.provider) {
        const [health, balances, power, totalSupplyBase, totalBorrowBase, tstockTotalValue] = await Promise.all([
          getAccountHealth(address, signer.provider),
          getUserBalances(address, signer.provider),
          getBorrowingPower(address, signer.provider),
          getTotalSupplyBase(address, signer.provider),
          getTotalBorrowBase(address, signer.provider),
          getTstockTotalValue(address, signer.provider)
        ]);
        
        setAccountHealth(health);
        setUserBalances(balances);
        setBorrowingPower(power);
        setTotalSupplyBase(totalSupplyBase);
        setTotalBorrowBase(totalBorrowBase);
        setTstockTotalValue(tstockTotalValue);
      }
      
    } catch (error: unknown) {
      console.error("Borrow failed:", error);
      const errorMessage = error instanceof Error ? error.message : "未知錯誤";
      alert(`借貸失敗: ${errorMessage}`);
    } finally {
      setIsCompoundLoading(false);
    }
  };
  
  const handleRepay = async () => {
    if (!signer || !repayAmount || parseFloat(repayAmount) <= 0) {
      alert("請輸入有效的數量");
      return;
    }
    
    setIsCompoundLoading(true);
    try {
      const tx = await repay(repayAmount, signer);
      console.log("Repaid:", tx);
      
      // 等待交易確認
      await tx.wait();
      alert("還款成功！");
      setRepayDialogOpen(false);
      setRepayAmount("");
      
      // 刷新狀態
      if (address && signer.provider) {
        const [health, balances, power, totalSupplyBase, totalBorrowBase, tstockTotalValue] = await Promise.all([
          getAccountHealth(address, signer.provider),
          getUserBalances(address, signer.provider),
          getBorrowingPower(address, signer.provider),
          getTotalSupplyBase(address, signer.provider),
          getTotalBorrowBase(address, signer.provider),
          getTstockTotalValue(address, signer.provider)
        ]);
        
        setAccountHealth(health);
        setUserBalances(balances);
        setBorrowingPower(power);
        setTotalSupplyBase(totalSupplyBase);
        setTotalBorrowBase(totalBorrowBase);
        setTstockTotalValue(tstockTotalValue);
      }
      
    } catch (error: unknown) {
      console.error("Repay failed:", error);
      const errorMessage = error instanceof Error ? error.message : "未知錯誤";
      alert(`還款失敗: ${errorMessage}`);
    } finally {
      setIsCompoundLoading(false);
    }
  };
  
  const handleWithdrawCollateral = async () => {
    if (!signer || !withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert("請輸入有效的數量");
      return;
    }
    
    setIsCompoundLoading(true);
    try {
      const tx = await withdrawCollateral(withdrawAmount, signer);
      console.log("Withdrawn:", tx);
      
      // 等待交易確認
      await tx.wait();
      alert("抵押品提取成功！");
      setWithdrawDialogOpen(false);
      setWithdrawAmount("");
      
      // 刷新狀態
      if (address && signer.provider) {
        const [health, balances, power, totalSupplyBase, totalBorrowBase, tstockTotalValue] = await Promise.all([
          getAccountHealth(address, signer.provider),
          getUserBalances(address, signer.provider),
          getBorrowingPower(address, signer.provider),
          getTotalSupplyBase(address, signer.provider),
          getTotalBorrowBase(address, signer.provider),
          getTstockTotalValue(address, signer.provider)
        ]);
        
        setAccountHealth(health);
        setUserBalances(balances);
        setBorrowingPower(power);
        setTotalSupplyBase(totalSupplyBase);
        setTotalBorrowBase(totalBorrowBase);
        setTstockTotalValue(tstockTotalValue);
      }
      
    } catch (error: unknown) {
      console.error("Withdraw failed:", error);
      const errorMessage = error instanceof Error ? error.message : "未知錯誤";
      alert(`提取失敗: ${errorMessage}`);
    } finally {
      setIsCompoundLoading(false);
    }
  };

  // 生成唯一的 ID
  const supplyAmountId = useId();
  const borrowAmountId = useId();
  const repayAmountId = useId();
  const withdrawAmountId = useId();
  
  if (!address || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">DeFi Collateral Lending</h1>
          <p className="text-sm text-gray-500 mb-8">
            Sign in to get started
          </p>
          <Button
            onClick={connectWallet}
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
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">DeFi Lending Platform</h1>
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
        {signer && address && (
          <div className="mb-6 border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Compound III 狀態</h2>
            
            {/* 帳戶健康狀態 */}
            {/* {accountHealth && (
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
            )} */}
            
            {/* 用戶餘額 */}
            {userBalances && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">TSPY 抵押品</div>
                  <div className="font-medium text-gray-900">{parseFloat(userBalances.tspyCollateral).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">Value: ${parseFloat(tstockTotalValue).toFixed(2)} USD</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">USDC 供應</div>
                  <div className="font-medium text-gray-900">{parseFloat(userBalances.usdcSupply).toFixed(2)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">USDC 借貸</div>
                  <div className="font-medium text-gray-900">{parseFloat(userBalances.usdcBorrow).toFixed(2)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">TSPY 錢包</div>
                  <div className="font-medium text-gray-900">{parseFloat(userBalances.tspyWalletBalance).toFixed(2)}</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-sm text-gray-500">USDC 錢包</div>
                  <div className="font-medium text-gray-900">{parseFloat(userBalances.usdcWalletBalance).toFixed(2)}</div>
                </div>
              </div>
            )}
            
            {/* 借貸能力 */}
            {/* <div className="mb-4 p-3 bg-blue-50 rounded">
              <div className="text-sm text-gray-500">借貸能力</div>
              <div className="font-medium text-blue-900">${parseFloat(borrowingPower).toFixed(2)} USDC</div>
            </div> */}
            
            {/* Compound III 操作按鈕 */}
            <div className="grid grid-cols-5 gap-4">
              <Button 
                onClick={() => setSupplyDialogOpen(true)}
                disabled={isCompoundLoading}
                className="w-full border border-gray-200 rounded-lg hover:border-gray-400 transition-colors text-gray-900"
              >
                存入 TSPY 抵押品
              </Button>
              <Button 
                onClick={() => setSupplyUsdcDialogOpen(true)}
                disabled={isCompoundLoading}
                className="w-full border border-gray-200 rounded-lg hover:border-gray-400 transition-colors text-gray-900"
              >
                存入 USDC 供應
              </Button>
              <Button 
                onClick={() => setBorrowDialogOpen(true)}
                disabled={isCompoundLoading}
                className="w-full border border-gray-200 rounded-lg hover:border-gray-400 transition-colors text-gray-900"
              >
                借出 USDC
              </Button>
              <Button 
                onClick={() => setRepayDialogOpen(true)}
                disabled={isCompoundLoading}
                className="w-full border border-gray-200 rounded-lg hover:border-gray-400 transition-colors text-gray-900"
              >
                還款 USDC
              </Button>
              <Button 
                onClick={() => setWithdrawDialogOpen(true)}
                disabled={isCompoundLoading}
                className="w-full border border-gray-200 rounded-lg hover:border-gray-400 transition-colors text-gray-900"
              >
                提取抵押品
              </Button>
            </div>
          </div>
        )}

        {/* 存入抵押品 Dialog */}
        <Dialog open={supplyDialogOpen} onOpenChange={setSupplyDialogOpen}>
          <DialogContent className="bg-white text-gray-900">
            <DialogHeader>
              <DialogTitle>存入 TSPY 抵押品</DialogTitle>
              <DialogDescription>
                輸入要存入的 TSPY 數量作為抵押品
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor={supplyAmountId}>數量 (TSPY)</Label>
              <Input
                id={supplyAmountId}
                type="number"
                value={supplyAmount}
                onChange={(e) => setSupplyAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
              />
              {userBalances && (
                <p className="text-xs text-gray-500 mt-2">
                  可用餘額: {parseFloat(userBalances.tspyWalletBalance).toFixed(2)} TSPY
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSupplyDialogOpen(false);
                  setSupplyAmount("");
                }}
                className="bg-white flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                取消
              </Button>
              <Button
                onClick={handleSupplyCollateral}
                disabled={isCompoundLoading || !supplyAmount || parseFloat(supplyAmount) <= 0}
                className="flex-1 px-4 py-2.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                {isCompoundLoading ? "處理中..." : "確認存入"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 存入 USDC 供應 Dialog */}
        <Dialog open={supplyUsdcDialogOpen} onOpenChange={setSupplyUsdcDialogOpen}>
          <DialogContent className="bg-white text-gray-900">
            <DialogHeader>
              <DialogTitle>存入 USDC 供應</DialogTitle>
              <DialogDescription>
                輸入要存入的 USDC 數量作為供應
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor={supplyAmountId}>數量 (USDC)</Label>
              <Input
                id={supplyAmountId}
                type="number"
                value={supplyUsdcAmount}
                onChange={(e) => setSupplyUsdcAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
              />
              {userBalances && (
                <p className="text-xs text-gray-500 mt-2">
                    可用餘額: {parseFloat(userBalances.usdcWalletBalance).toFixed(2)} USDC
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSupplyUsdcDialogOpen(false);
                  setSupplyUsdcAmount("");
                }}
                className="bg-white flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                取消
              </Button>
              <Button
                onClick={handleSupplyUsdcSupply}
                disabled={isCompoundLoading || !supplyUsdcAmount || parseFloat(supplyUsdcAmount) <= 0}
                className="flex-1 px-4 py-2.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                {isCompoundLoading ? "處理中..." : "確認存入 USDC 供應"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 借出 USDC Dialog */}
        <Dialog open={borrowDialogOpen} onOpenChange={setBorrowDialogOpen}>
          <DialogContent className="bg-white text-gray-900">
            <DialogHeader>
              <DialogTitle>借出 USDC</DialogTitle>
              <DialogDescription>
                輸入要借出的 USDC 數量
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor={borrowAmountId}>數量 (USDC)</Label>
              <Input
                id={borrowAmountId}
                type="number"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
              />
              <p className="text-xs text-gray-500 mt-2">
                借貸能力: ${parseFloat(borrowingPower).toFixed(2)} USDC
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setBorrowDialogOpen(false);
                  setBorrowAmount("");
                }}
                className="bg-white flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                取消
              </Button>
              <Button
                onClick={handleBorrow}
                disabled={isCompoundLoading || !borrowAmount || parseFloat(borrowAmount) <= 0}
                className="bg-white flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {isCompoundLoading ? "處理中..." : "確認借出"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 還款 USDC Dialog */}
        <Dialog open={repayDialogOpen} onOpenChange={setRepayDialogOpen}>
          <DialogContent className="bg-white text-gray-900">
            <DialogHeader>
              <DialogTitle>還款 USDC</DialogTitle>
              <DialogDescription>
                輸入要還款的 USDC 數量
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor={repayAmountId}>數量 (USDC)</Label>
              <Input
                id={repayAmountId}
                type="number"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
              />
              {userBalances && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    當前借貸: {parseFloat(userBalances.usdcBorrow).toFixed(2)} USDC
                  </p>
                  <p className="text-xs text-gray-500">
                    錢包餘額: {parseFloat(userBalances.usdcWalletBalance).toFixed(2)} USDC
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRepayDialogOpen(false);
                  setRepayAmount("");
                }}
                className="bg-white flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                取消
              </Button>
              <Button
                onClick={handleRepay}
                disabled={isCompoundLoading || !repayAmount || parseFloat(repayAmount) <= 0}
                className="bg-white flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {isCompoundLoading ? "處理中..." : "確認還款"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 提取抵押品 Dialog */}
        <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>提取抵押品</DialogTitle>
              <DialogDescription>
                輸入要提取的 TSPY 數量
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor={withdrawAmountId}>數量 (TSPY)</Label>
              <Input
                id={withdrawAmountId}
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
              />
              {userBalances && (
                <p className="text-xs text-gray-500 mt-2">
                  抵押品餘額: {parseFloat(userBalances.tspyCollateral).toFixed(2)} TSPY
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setWithdrawDialogOpen(false);
                  setWithdrawAmount("");
                }}
                className="bg-white flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                取消
              </Button>
              <Button
                onClick={handleWithdrawCollateral}
                disabled={isCompoundLoading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                className="bg-white flex-1 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {isCompoundLoading ? "處理中..." : "確認提取"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
