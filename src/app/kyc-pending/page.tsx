"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeb3 } from "@/context/web3-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function KYCPendingPage() {
  const router = useRouter();
  const { user, sessionToken, isAuthenticated, refreshUserInfo } = useWeb3();
  const [claimStatus, setClaimStatus] = useState<{
    hasValidClaim: boolean;
    isRegistered: boolean;
    identityAddress: string | null;
    message: string;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // 检查 KYC 和 Claim 状态
  const checkStatus = async () => {
    if (!sessionToken) return;
    
    try {
      setIsChecking(true);
      const response = await fetch("/api/erc3643/claim/verify", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setClaimStatus(data);
        setLastChecked(new Date());
        
        // 如果已经验证通过，刷新用户信息并跳转
        if (data.hasValidClaim && data.isRegistered) {
          await refreshUserInfo();
          setTimeout(() => {
            router.push("/");
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Failed to check status:", error);
    } finally {
      setIsChecking(false);
    }
  };

  // 自动检查状态（每 15 秒）
  useEffect(() => {
    if (!isAuthenticated || !sessionToken) {
      router.push("/signup");
      return;
    }

    // 立即检查一次
    checkStatus();

    // 设置定时检查
    const interval = setInterval(checkStatus, 15000); // 每 15 秒检查一次
    
    return () => clearInterval(interval);
  }, [sessionToken, isAuthenticated]);

  // 手动刷新
  const handleRefresh = () => {
    checkStatus();
    refreshUserInfo();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>未认证</CardTitle>
            <CardDescription>请先登录</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/signup")}>
              前往登录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">KYC 审核状态</CardTitle>
            <CardDescription>
              您的身份验证正在处理中
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 审核状态 */}
            <div className="space-y-4">
              {/* 步骤 1: KYC 提交 */}
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-green-900">✓ KYC 信息已提交</h3>
                  <p className="text-xs text-green-700 mt-1">
                    您的 KYC 信息已成功提交到 Alpaca
                  </p>
                </div>
              </div>

              {/* 步骤 2: Identity 创建 */}
              {user?.erc3643?.identityAddress ? (
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-green-900">✓ 链上身份已创建</h3>
                    <p className="text-xs text-green-700 mt-1">
                      OnchainID Identity: {user.erc3643.identityAddress.slice(0, 10)}...{user.erc3643.identityAddress.slice(-8)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="animate-spin w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-yellow-900">⏳ 等待链上身份创建</h3>
                    <p className="text-xs text-yellow-700 mt-1">
                      正在部署 Identity 合约...
                    </p>
                  </div>
                </div>
              )}

              {/* 步骤 3: 管理员审核 */}
              {claimStatus?.hasValidClaim ? (
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-green-900">✓ KYC 审核通过</h3>
                    <p className="text-xs text-green-700 mt-1">
                      您的身份已验证，正在跳转到首页...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex-shrink-0 mt-1">
                    <svg className="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-900">⏳ 等待管理员审核</h3>
                    <p className="text-xs text-blue-700 mt-1">
                      管理员将审核您的 KYC 信息并签发 Claim
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      通常需要 1-2 个工作日
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 状态信息 */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">钱包地址:</span>
                <span className="font-mono text-gray-900">
                  {user?.walletAddress?.slice(0, 6)}...{user?.walletAddress?.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">KYC 状态:</span>
                <span className="font-medium text-gray-900">
                  {user?.kycStatus === 'approved' ? '已通过' : 
                   user?.kycStatus === 'pending' ? '审核中' : '未提交'}
                </span>
              </div>
              {claimStatus && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">链上验证:</span>
                    <span className={`font-medium ${claimStatus.isRegistered ? 'text-green-600' : 'text-yellow-600'}`}>
                      {claimStatus.isRegistered ? '已验证' : '未验证'}
                    </span>
                  </div>
                  {lastChecked && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>最后检查:</span>
                      <span>{lastChecked.toLocaleTimeString('zh-CN')}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <Button
                onClick={handleRefresh}
                disabled={isChecking}
                variant="outline"
                className="flex-1"
              >
                {isChecking ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    检查中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    刷新状态
                  </>
                )}
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                className="flex-1"
              >
                返回首页
              </Button>
            </div>

            {/* 提示信息 */}
            <div className="text-center text-sm text-gray-500">
              <p>系统将每 15 秒自动检查审核状态</p>
              <p className="mt-1">审核通过后将自动跳转到首页</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

