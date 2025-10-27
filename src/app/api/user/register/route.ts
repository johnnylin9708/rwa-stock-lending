/**
 * API: 用户注册和KYC - 整合 Alpaca Broker API
 */
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { UserSchema } from "@/lib/db/schemas";
import { isValidAddress, getSessionFromHeaders } from "@/lib/auth-helpers";
import { createBrokerageAccount } from "@/lib/alpaca-client";

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, email, kycData, createAlpacaAccount } = await request.json();
    
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
    
    const normalizedAddress = walletAddress.toLowerCase();
    
    // 检查用户是否已存在
    const existingUser = await usersCollection.findOne({ 
      walletAddress: normalizedAddress 
    });
    
    // 如果用户已注册，更新信息
    if (existingUser && existingUser.email && existingUser.kycStatus !== 'not_started') {
      return NextResponse.json(
        { error: "该钱包地址已注册" },
        { status: 400 }
      );
    }
    
    // Validate KYC data if provided
    if (kycData) {
      const requiredFields = ['givenName', 'familyName', 'dateOfBirth', 'phoneNumber', 'address'];
      const missingFields = requiredFields.filter(field => !kycData[field]);
      
      if (missingFields.length > 0) {
        return NextResponse.json(
          { error: `Missing KYC fields: ${missingFields.join(', ')}` },
          { status: 400 }
        );
      }
      
      // Validate address structure
      if (!kycData.address.streetAddress || !kycData.address.city || 
          !kycData.address.state || !kycData.address.postalCode || 
          !kycData.address.country) {
        return NextResponse.json(
          { error: "Complete address information is required" },
          { status: 400 }
        );
      }
    }
    
    // 准备用户数据
    const userData: UserSchema = {
      walletAddress: normalizedAddress,
      email,
      kycStatus: kycData ? 'pending' : 'not_started',
      kycData: kycData ? {
        fullName: `${kycData.givenName} ${kycData.familyName}`,
        givenName: kycData.givenName,
        familyName: kycData.familyName,
        dateOfBirth: kycData.dateOfBirth,
        taxId: kycData.taxId,
        country: kycData.address.country,
        phoneNumber: kycData.phoneNumber,
        address: kycData.address,
        submittedAt: new Date()
      } : undefined,
      bankAccounts: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create Alpaca brokerage account if requested and KYC data is provided
    if (createAlpacaAccount && kycData) {
      try {
        const alpacaAccount = await createBrokerageAccount({
          email,
          givenName: kycData.givenName,
          familyName: kycData.familyName,
          dateOfBirth: kycData.dateOfBirth,
          taxId: kycData.taxId,
          phoneNumber: kycData.phoneNumber,
          streetAddress: Array.isArray(kycData.address.streetAddress) 
            ? kycData.address.streetAddress 
            : [kycData.address.streetAddress],
          city: kycData.address.city,
          state: kycData.address.state,
          postalCode: kycData.address.postalCode,
          country: kycData.address.country,
          citizenship: kycData.citizenship,
          fundingSource: kycData.fundingSource || ['employment_income'],
          // Financial information
          employmentStatus: kycData.employmentStatus,
          annualIncome: kycData.annualIncome,
          netWorth: kycData.netWorth,
          liquidNetWorth: kycData.liquidNetWorth,
          // Investment profile
          investmentExperience: kycData.investmentExperience,
          investmentObjective: kycData.investmentObjective,
          riskTolerance: kycData.riskTolerance,
          // Trusted contact
          trustedContact: kycData.trustedContact ? {
            givenName: kycData.trustedContact.givenName,
            familyName: kycData.trustedContact.familyName,
            emailAddress: kycData.trustedContact.emailAddress,
            phoneNumber: kycData.trustedContact.phoneNumber,
            streetAddress: kycData.trustedContact.streetAddress,
            city: kycData.trustedContact.city,
            state: kycData.trustedContact.state,
            postalCode: kycData.trustedContact.postalCode,
            country: kycData.trustedContact.country,
          } : undefined,
        });
        
        // Add Alpaca account info to user data
        userData.alpacaAccount = {
          accountId: alpacaAccount.id,
          accountNumber: alpacaAccount.account_number,
          status: alpacaAccount.status,
          accountType: 'trading',
          createdAt: new Date(),
          currency: 'USD',
        };
        
        userData.kycStatus = 'approved'; // Alpaca will handle KYC approval
        
      } catch (alpacaError: any) {
        console.error("Failed to create Alpaca account:", alpacaError);
        // Continue with user registration even if Alpaca account creation fails
        // User can retry later
        return NextResponse.json(
          { error: alpacaError.response?.data?.message || alpacaError.message || "Failed to create Alpaca account" },
          { status: alpacaError.status || 500 }
        );
        
      }
    }
    
    let result;
    if (existingUser) {
      // Update existing user
      await usersCollection.updateOne(
        { walletAddress: normalizedAddress },
        { $set: userData }
      );
      result = { insertedId: existingUser._id };
    } else {
      // Create new user
      result = await usersCollection.insertOne(userData as any);
    }
    
    // 记录活动日志
    const logsCollection = db.collection('activity_logs');
    await logsCollection.insertOne({
      userId: result.insertedId?.toString(),
      walletAddress: normalizedAddress,
      action: 'USER_REGISTERED',
      description: userData.alpacaAccount 
        ? '用户注册成功并创建 Alpaca 账户' 
        : '用户注册成功',
      metadata: { 
        walletAddress, 
        email,
        hasAlpacaAccount: !!userData.alpacaAccount,
        alpacaAccountId: userData.alpacaAccount?.accountId
      },
      timestamp: new Date()
    });
    
    return NextResponse.json({
      success: true,
      userId: result.insertedId,
      alpacaAccountId: userData.alpacaAccount?.accountId,
      alpacaAccountStatus: userData.alpacaAccount?.status,
      message: userData.alpacaAccount 
        ? "注册成功！Alpaca 账户已创建，KYC 审核通常需要1-2个工作日。" 
        : "注册成功！您可以稍后提交 KYC 信息以创建交易账户。"
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
    
    // Try to get from session first
    const session = getSessionFromHeaders(request.headers);
    
    let addressToQuery: string;
    
    if (walletAddress) {
      if (!isValidAddress(walletAddress)) {
        return NextResponse.json(
          { error: "无效的钱包地址" },
          { status: 400 }
        );
      }
      addressToQuery = walletAddress.toLowerCase();
    } else if (session) {
      addressToQuery = session.walletAddress;
    } else {
      return NextResponse.json(
        { error: "需要提供钱包地址或有效的会话" },
        { status: 400 }
      );
    }
    
    const db = await getDatabase();
    const usersCollection = db.collection<UserSchema>('users');
    
    const user = await usersCollection.findOne({ 
      walletAddress: addressToQuery 
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
    }
    
    // 不返回敏感信息
    const { kycData, nonce, sessionToken, ...safeUser } = user;
    
    return NextResponse.json({
      user: {
        ...safeUser,
        kycStatus: user.kycStatus,
        hasKYC: !!kycData,
        hasAlpacaAccount: !!user.alpacaAccount,
        alpacaAccountStatus: user.alpacaAccount?.status,
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

