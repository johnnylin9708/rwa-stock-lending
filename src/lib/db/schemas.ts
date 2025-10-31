/**
 * MongoDB Schemas for POC
 */

// User information - combined with Alpaca Broker API
export interface UserSchema {
  _id?: string;
  walletAddress: string;
  email: string;
  
  // Authentication related
  lastLogin?: Date;
  
  // KYC information
  kycStatus: 'pending' | 'approved' | 'rejected' | 'not_started';
  kycData?: {
    fullName: string;
    givenName: string;
    familyName: string;
    dateOfBirth: string; // YYYY-MM-DD
    idNumber?: string;
    taxId?: string;
    country: string;
    phoneNumber: string;
    address: {
      streetAddress: string[];
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    submittedAt: Date;
    approvedAt?: Date;
    rejectedAt?: Date;
    rejectionReason?: string;
  };
  
  // Alpaca Broker account information
  alpacaAccount?: {
    accountId: string; // Alpaca assigned account ID
    accountNumber?: string; // Account number
    status: 'SUBMITTED' | 'ACTION_REQUIRED' | 'EDITED' | 'APPROVAL_PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'ACCOUNT_CLOSED';
    accountType?: 'trading' | 'margin';
    createdAt: Date;
    approvedAt?: Date;
    currency?: 'USD';
    lastSync?: Date; // Last sync time
  };
  
  // ERC-3643 related (OnchainID & T-REX Token)
  erc3643?: {
    identityAddress?: string;           // OnchainID Identity contract address
    identityCreatedAt?: Date;          // Identity creation time
    claims: Array<{
      claimName: string;
      claimId: string;
      topic: string;                    // Example: "KYC_VERIFIED"
      issuer: string;                   // ClaimIssuer address
      signature: string;
      data: string;
      issuedAt: Date;
      isValid: boolean;
    }>;
    isRegistered: boolean;              // Whether registered to IdentityRegistry
    registeredAt?: Date;
    country: number;                    // ISO 3166-1 numeric code
  };
  
  bankAccounts?: BankAccountSchema[];
  createdAt: Date;
  updatedAt: Date;
}

// Bank account
export interface BankAccountSchema {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  verified: boolean;
  verifiedAt?: Date;
}

// Loan application
export interface LoanApplicationSchema {
  _id?: string;
  userId: string;
  walletAddress: string;
  
  // Application information
  assetType: 'STOCK' | 'BOND';
  assetSymbol: string;  // Example: AAPL, GOOGL
  assetAmount: number;  // Stock/bond quantity
  assetValue: number;   // USD value
  
  // Loan conditions
  requestedLoanAmount: number;  // Requested loan amount(USDC)
  collateralFactor: number;     // Collateral factor
  estimatedAPY: number;         // Estimated APY
  
  // Bank reserve information
  bankReserveId?: string;  // Bank reserve ID
  bankConfirmedAt?: Date;
  
  // Tokenization information
  tokenizedAssetAddress?: string;  // Token contract address
  mintTxHash?: string;             // Tokenization transaction hash
  mintedAmount?: number;           // Tokenized quantity
  mintedAt?: Date;
  
  // Timestamp
  submittedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Notes
  notes?: string;
}
