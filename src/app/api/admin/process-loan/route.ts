/**
 * API: 管理员处理借贷申请（模拟银行确认和铸币）
 */
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  try {
    const { applicationId, action } = await request.json();
    
    if (!applicationId) {
      return NextResponse.json(
        { error: "缺少申请ID" },
        { status: 400 }
      );
    }
    
    const db = await getDatabase();
    const applicationsCollection = db.collection('loan_applications');
    
    const application = await applicationsCollection.findOne({ 
      _id: new ObjectId(applicationId) 
    });
    
    if (!application) {
      return NextResponse.json(
        { error: "申请不存在" },
        { status: 404 }
      );
    }
    
    if (action === 'confirm_reserve') {
      // 步骤2: 银行确认资产圈存
      await applicationsCollection.updateOne(
        { _id: new ObjectId(applicationId) },
        { 
          $set: { 
            status: 'bank_confirmed',
            bankReserveId: `BANK_${Date.now()}`,
            bankConfirmedAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
      
      // 记录日志
      await db.collection('activity_logs').insertOne({
        userId: application.userId,
        action: 'BANK_RESERVE_CONFIRMED',
        description: `银行确认资产圈存: ${application.assetSymbol} x${application.assetAmount}`,
        metadata: { applicationId },
        timestamp: new Date()
      });
      
      return NextResponse.json({
        success: true,
        message: "银行已确认资产圈存，准备铸造代币..."
      });
      
    } else if (action === 'mint_tokens') {
      // 步骤3: 铸造代币化资产
      
      // 模拟铸币交易（实际应该调用智能合约）
      const mockTxHash = `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
      const tokenSymbol = `T${application.assetSymbol}`; // AAPL -> TAAPL
      
      await applicationsCollection.updateOne(
        { _id: new ObjectId(applicationId) },
        { 
          $set: { 
            status: 'minting',
            mintTxHash: mockTxHash,
            tokenizedAssetAddress: process.env[`NEXT_PUBLIC_T${application.assetSymbol}_ADDRESS`] || '0x0000',
            updatedAt: new Date()
          } 
        }
      );
      
      // 记录铸币记录
      await db.collection('token_minting').insertOne({
        loanApplicationId: applicationId,
        userId: application.userId,
        walletAddress: application.walletAddress,
        tokenSymbol: tokenSymbol,
        tokenContractAddress: process.env[`NEXT_PUBLIC_T${application.assetSymbol}_ADDRESS`] || '0x0000',
        amount: application.assetAmount,
        txHash: mockTxHash,
        status: 'pending',
        initiatedAt: new Date()
      });
      
      // 模拟区块确认（实际应该监听链上事件）
      setTimeout(async () => {
        await applicationsCollection.updateOne(
          { _id: new ObjectId(applicationId) },
          { 
            $set: { 
              status: 'completed',
              mintedAmount: application.assetAmount,
              mintedAt: new Date(),
              completedAt: new Date(),
              updatedAt: new Date()
            } 
          }
        );
        
        await db.collection('token_minting').updateOne(
          { loanApplicationId: applicationId },
          { 
            $set: { 
              status: 'confirmed',
              blockNumber: Math.floor(Math.random() * 1000000),
              confirmedAt: new Date()
            } 
          }
        );
      }, 2000);
      
      // 记录日志
      await db.collection('activity_logs').insertOne({
        userId: application.userId,
        action: 'TOKENS_MINTED',
        description: `代币铸造完成: ${tokenSymbol} x${application.assetAmount}`,
        metadata: { applicationId, txHash: mockTxHash },
        timestamp: new Date()
      });
      
      return NextResponse.json({
        success: true,
        txHash: mockTxHash,
        tokenSymbol: tokenSymbol,
        amount: application.assetAmount,
        message: "代币铸造中，请等待区块确认..."
      });
      
    } else {
      return NextResponse.json(
        { error: "无效的操作" },
        { status: 400 }
      );
    }
    
  } catch (error: any) {
    console.error("处理申请失败:", error);
    return NextResponse.json(
      { error: error.message || "处理申请失败" },
      { status: 500 }
    );
  }
}

// 获取待处理的申请
export async function GET() {
  try {
    const db = await getDatabase();
    const applicationsCollection = db.collection('loan_applications');
    
    const pendingApplications = await applicationsCollection
      .find({ 
        status: { $in: ['submitted', 'bank_confirmed', 'minting'] } 
      })
      .sort({ submittedAt: -1 })
      .toArray();
    
    return NextResponse.json({
      applications: pendingApplications
    });
    
  } catch (error: any) {
    console.error("获取待处理申请失败:", error);
    return NextResponse.json(
      { error: error.message || "获取待处理申请失败" },
      { status: 500 }
    );
  }
}

