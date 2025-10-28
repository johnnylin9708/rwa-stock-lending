/**
 * API: 申请借贷（简化版）
 */
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { LoanApplicationSchema } from "@/lib/db/schemas";
import { isValidAddress } from "@/lib/auth-helpers";
import { getLatestPrice } from "@/lib/alpaca-client";
import { SUPPORTED_ASSETS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const { 
      walletAddress, 
      assetSymbol, 
      assetAmount,
      requestedLoanAmount
    } = await request.json();
    
    // 验证输入
    if (!walletAddress || !isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: "无效的钱包地址" },
        { status: 400 }
      );
    }
    
    // 查找资产配置
    const assetConfig = SUPPORTED_ASSETS.find(a => a.symbol === assetSymbol);
    if (!assetConfig) {
      return NextResponse.json(
        { error: "不支持的资产" },
        { status: 400 }
      );
    }
    
    // 从Alpaca获取实时价格
    let assetPrice = 0;
    try {
      assetPrice = await getLatestPrice(assetConfig.originalSymbol);
    } catch (error) {
      console.error("获取价格失败:", error);
      assetPrice = 100; // 使用默认价格
    }
    
    const assetValue = assetPrice * assetAmount;
    const collateralFactor = assetConfig.collateralFactor;
    const maxLoan = assetValue * collateralFactor;
    
    if (requestedLoanAmount > maxLoan) {
      return NextResponse.json(
        { 
          error: `借款金额超过最大可借额度`,
          maxLoanAmount: maxLoan,
          assetValue: assetValue
        },
        { status: 400 }
      );
    }
    
    // 连接数据库
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    
    // 检查或创建用户
    let user = await usersCollection.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    });
    
    if (!user) {
      // 自动创建用户（简化版，实际应该要求KYC）
      const newUser = {
        walletAddress: walletAddress.toLowerCase(),
        kycStatus: 'approved', // 简化版直接批准
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await usersCollection.insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }
    
    // 计算预估APY (使用Compound风格利率模型)
    // 假设当前市场利用率为50%，在80%最优利用率以下
    const utilizationRate = 0.5;
    const baseRate = 0.02; // 2%
    const multiplier = 0.1; // 10%
    const estimatedAPY = (baseRate + utilizationRate * multiplier) * 100; // 转为百分比
    
    // 创建借贷申请
    const loanApplication: LoanApplicationSchema = {
      userId: user._id.toString(),
      walletAddress: walletAddress.toLowerCase(),
      assetType: assetConfig.type as 'STOCK' | 'BOND',
      assetSymbol: assetConfig.originalSymbol,
      assetAmount,
      assetValue,
      requestedLoanAmount,
      collateralFactor,
      estimatedAPY,
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date()
    };
    
    const applicationsCollection = db.collection('loan_applications');
    const result = await applicationsCollection.insertOne(loanApplication as any);
    
    return NextResponse.json({
      success: true,
      applicationId: result.insertedId,
      loanDetails: {
        assetValue,
        maxLoanAmount: maxLoan,
        requestedAmount: requestedLoanAmount,
        collateralFactor: collateralFactor * 100,
        estimatedAPY,
        assetPrice
      },
      message: "借贷申请已提交！等待银行确认资产圈存..."
    });
    
  } catch (error: any) {
    console.error("申请借贷失败:", error);
    return NextResponse.json(
      { error: error.message || "申请借贷失败" },
      { status: 500 }
    );
  }
}

// 获取申请列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("address");
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: "缺少钱包地址" },
        { status: 400 }
      );
    }
    
    const db = await getDatabase();
    const applicationsCollection = db.collection('loan_applications');
    
    const applications = await applicationsCollection
      .find({ walletAddress: walletAddress.toLowerCase() })
      .sort({ submittedAt: -1 })
      .limit(20)
      .toArray();
    
    return NextResponse.json({
      applications
    });
    
  } catch (error: any) {
    console.error("获取申请列表失败:", error);
    return NextResponse.json(
      { error: error.message || "获取申请列表失败" },
      { status: 500 }
    );
  }
}
