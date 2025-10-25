/**
 * API: 用户注册和KYC
 */
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";
import { isValidAddress } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, email, kycData } = await request.json();
    
    // 验证输入
    if (!walletAddress || !isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: "无效的钱包地址" },
        { status: 400 }
      );
    }
    
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: "无效的邮箱地址" },
        { status: 400 }
      );
    }
    
    // 连接数据库
    const db = await getDatabase();
    const usersCollection = db.collection<UserSchema>('users');
    
    // 检查用户是否已存在
    const existingUser = await usersCollection.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: "该钱包地址已注册" },
        { status: 400 }
      );
    }
    
    // 创建新用户
    const newUser: UserSchema = {
      walletAddress: walletAddress.toLowerCase(),
      email,
      kycStatus: kycData ? 'pending' : 'pending',
      kycData: kycData ? {
        ...kycData,
        submittedAt: new Date()
      } : undefined,
      bankAccounts: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await usersCollection.insertOne(newUser as any);
    
    // 记录活动日志
    const logsCollection = db.collection('activity_logs');
    await logsCollection.insertOne({
      userId: result.insertedId.toString(),
      action: 'USER_REGISTERED',
      description: '用户注册成功',
      metadata: { walletAddress, email },
      timestamp: new Date()
    });
    
    return NextResponse.json({
      success: true,
      userId: result.insertedId,
      message: "注册成功！KYC审核通常需要1-2个工作日。"
    });
    
  } catch (error: any) {
    console.error("注册失败:", error);
    return NextResponse.json(
      { error: error.message || "注册失败" },
      { status: 500 }
    );
  }
}

// 获取用户信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("address");
    
    if (!walletAddress || !isValidAddress(walletAddress)) {
      return NextResponse.json(
        { error: "无效的钱包地址" },
        { status: 400 }
      );
    }
    
    const db = await getDatabase();
    const usersCollection = db.collection<UserSchema>('users');
    
    const user = await usersCollection.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
    }
    
    // 不返回敏感信息
    const { kycData, ...safeUser } = user;
    
    return NextResponse.json({
      user: {
        ...safeUser,
        kycStatus: user.kycStatus,
        hasKYC: !!kycData
      }
    });
    
  } catch (error: any) {
    console.error("获取用户信息失败:", error);
    return NextResponse.json(
      { error: error.message || "获取用户信息失败" },
      { status: 500 }
    );
  }
}

