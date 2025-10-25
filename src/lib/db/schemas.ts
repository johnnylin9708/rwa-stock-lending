/**
 * MongoDB Schemas for POC
 */

// 用户信息
export interface UserSchema {
  _id?: string;
  walletAddress: string;
  email: string;
  kycStatus: 'pending' | 'approved' | 'rejected';
  kycData?: {
    fullName: string;
    idNumber: string;
    country: string;
    dateOfBirth: string;
    submittedAt: Date;
    approvedAt?: Date;
  };
  bankAccounts?: BankAccountSchema[];
  createdAt: Date;
  updatedAt: Date;
}

// 银行账户
export interface BankAccountSchema {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  verified: boolean;
  verifiedAt?: Date;
}

// 借贷申请
export interface LoanApplicationSchema {
  _id?: string;
  userId: string;
  walletAddress: string;
  
  // 申请信息
  assetType: 'STOCK' | 'BOND';
  assetSymbol: string;  // 例如: AAPL, GOOGL
  assetAmount: number;  // 股票/债券数量
  assetValue: number;   // 美元价值
  
  // 借贷条件
  requestedLoanAmount: number;  // 请求借款金额(USDC)
  collateralFactor: number;     // 抵押因子
  estimatedAPY: number;         // 预估年化利率
  
  // 状态流程
  status: 'submitted' | 'bank_processing' | 'bank_confirmed' | 'minting' | 'completed' | 'rejected';
  
  // 银行圈存信息
  bankReserveId?: string;  // 银行圈存ID
  bankConfirmedAt?: Date;
  
  // 铸币信息
  tokenizedAssetAddress?: string;  // 代币合约地址
  mintTxHash?: string;             // 铸币交易哈希
  mintedAmount?: number;           // 铸造数量
  mintedAt?: Date;
  
  // 时间戳
  submittedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // 备注
  notes?: string;
}

// 资产圈存记录
export interface AssetReserveSchema {
  _id?: string;
  loanApplicationId: string;
  userId: string;
  
  // 银行信息
  bankName: string;
  accountNumber: string;
  
  // 资产信息
  assetType: 'STOCK' | 'BOND';
  assetSymbol: string;
  quantity: number;
  reservedValue: number;
  
  // 状态
  status: 'pending' | 'confirmed' | 'released' | 'failed';
  
  // 银行响应
  bankReferenceId?: string;
  bankConfirmationDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// 代币铸造记录
export interface TokenMintingSchema {
  _id?: string;
  loanApplicationId: string;
  userId: string;
  walletAddress: string;
  
  // 代币信息
  tokenSymbol: string;           // TAAPL, TGOOGL等
  tokenContractAddress: string;
  amount: number;
  
  // 交易信息
  txHash: string;
  blockNumber?: number;
  status: 'pending' | 'confirmed' | 'failed';
  
  // 时间戳
  initiatedAt: Date;
  confirmedAt?: Date;
}

// 代币化持仓记录
export interface TokenizedPositionSchema {
  _id?: string;
  userId: string;
  walletAddress: string;
  
  // 原始股票信息
  originalSymbol: string;      // AAPL, GOOGL, etc
  alpacaPositionQty: number;   // Alpaca上的原始持仓数量
  
  // 已代币化信息
  tokenizedQty: number;        // 已代币化数量
  frozenQty: number;           // 冻结数量
  availableQty: number;        // 可用数量 (alpacaPositionQty - frozenQty)
  
  // 代币合约信息
  tokenSymbol: string;         // TAAPL, TGOOGL
  tokenContractAddress: string;
  
  // 代币化记录
  tokenizations: {
    amount: number;
    txHash: string;
    blockNumber?: number;
    timestamp: Date;
    status: 'pending' | 'confirmed' | 'failed';
  }[];
  
  // 状态
  status: 'active' | 'closed';
  
  createdAt: Date;
  updatedAt: Date;
}

// 系统日志
export interface ActivityLogSchema {
  _id?: string;
  userId: string;
  action: string;
  description: string;
  metadata?: any;
  timestamp: Date;
}

