"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  
  // 获取待处理申请
  const fetchApplications = async () => {
    try {
      const response = await fetch("/api/admin/process-loan");
      const data = await response.json();
      setApplications(data.applications || []);
    } catch (error) {
      console.error("获取申请失败:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchApplications();
    
    // 每5秒刷新一次
    const interval = setInterval(fetchApplications, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // 处理申请
  const handleProcess = async (applicationId: string, action: string) => {
    setProcessing(applicationId);
    
    try {
      const response = await fetch("/api/admin/process-loan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, action })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        await fetchApplications();
      } else {
        alert(data.error || "处理失败");
      }
    } catch (error) {
      console.error("处理失败:", error);
      alert("处理失败，请重试");
    } finally {
      setProcessing(null);
    }
  };
  
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      'submitted': { text: '待确认', color: 'bg-blue-50 text-blue-700 border border-blue-200' },
      'bank_confirmed': { text: '已确认', color: 'bg-green-50 text-green-700 border border-green-200' },
      'minting': { text: '铸币中', color: 'bg-purple-50 text-purple-700 border border-purple-200' },
      'completed': { text: '已完成', color: 'bg-gray-50 text-gray-700 border border-gray-200' }
    };
    const config = statusMap[status] || { text: status, color: 'bg-gray-50 border border-gray-200' };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-500">加载中...</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">管理后台</h1>
            <p className="text-sm text-gray-500">处理借贷申请和铸币操作</p>
          </div>
          <button
            onClick={fetchApplications}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            刷新
          </button>
        </div>
        
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">借贷申请处理</h2>
          </div>
          <div className="p-6">
          {applications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">暂无待处理申请</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>申请ID</TableHead>
                  <TableHead>用户地址</TableHead>
                  <TableHead>资产</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>借款金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app._id}>
                    <TableCell className="font-mono text-xs">
                      {app._id.toString().slice(-8)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {app.walletAddress.slice(0, 6)}...{app.walletAddress.slice(-4)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {app.assetSymbol}
                    </TableCell>
                    <TableCell>
                      {app.assetAmount}
                      <div className="text-xs text-muted-foreground">
                        ${app.assetValue.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${app.requestedLoanAmount}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(app.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {app.status === 'submitted' && (
                          <button
                            onClick={() => handleProcess(app._id, 'confirm_reserve')}
                            disabled={processing === app._id}
                            className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 disabled:bg-gray-300 transition-colors"
                          >
                            {processing === app._id ? "处理中..." : "确认圈存"}
                          </button>
                        )}
                        {app.status === 'bank_confirmed' && (
                          <button
                            onClick={() => handleProcess(app._id, 'mint_tokens')}
                            disabled={processing === app._id}
                            className="px-3 py-1.5 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                          >
                            {processing === app._id ? "铸币中..." : "铸造代币"}
                          </button>
                        )}
                        {app.status === 'minting' && (
                          <span className="text-xs text-gray-500">
                            等待区块确认...
                          </span>
                        )}
                        {app.status === 'completed' && (
                          <span className="text-xs text-gray-600">
                            ✓ 已完成
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          </div>
        </div>
        
        <div className="mt-6 border border-gray-200 rounded-lg bg-white">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">流程说明</h2>
          </div>
          <div className="p-6">
            <div className="space-y-5 text-sm">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-medium text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-1">用户提交申请</p>
                  <p className="text-gray-600 text-xs">
                    用户选择资产和借款金额，提交借贷申请
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-medium text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-1">银行确认圈存</p>
                  <p className="text-gray-600 text-xs">
                    模拟银行确认用户资产并圈存（通过Alpaca Paper Trading）
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-medium text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-1">铸造代币</p>
                  <p className="text-gray-600 text-xs">
                    将资产代币化，铸造ERC20代币到用户KYC钱包
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center font-medium text-sm flex-shrink-0">
                  4
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-1">完成借贷</p>
                  <p className="text-gray-600 text-xs">
                    用户收到代币化资产，可以在借贷平台使用（Compound风格）
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

