// src/lib/compound-client.ts
import { ethers } from 'ethers';

// 合約地址 (從部署腳本獲取)
const COMET_ADDRESS = process.env.NEXT_PUBLIC_COMET_ADDRESS || "0x...";
const TSPY_ADDRESS = "0xBEae6Fa62362aB593B498692FD09002a9eEd52dc";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x...";

// Comet 合約 ABI (簡化版)
const COMET_ABI = [
  "function supply(address asset, uint256 amount) external",
  "function withdraw(address asset, uint256 amount) external",
  "function borrow(uint256 amount) external",
  "function repay(uint256 amount) external",
  "function collateralBalanceOf(address user, address asset) external view returns (uint256)",
  "function borrowBalanceOf(address user) external view returns (uint256)",
  "function balanceOf(address user) external view returns (uint256)",
  "function getAccountHealth(address user) external view returns (uint256)",
  "function isBorrowCollateralized(address user) external view returns (bool)",
  "function isLiquidatable(address user) external view returns (bool)",
  "function getBorrowingPower(address user) external view returns (uint256)",
  "function getTotalCollateralValue(address user) external view returns (uint256)",
  "function getTotalBorrowValue(address user) external view returns (uint256)",
  "function accrueInterest() external",
  "event CollateralSupplied(address indexed user, address indexed asset, uint256 amount)",
  "event CollateralWithdrawn(address indexed user, address indexed asset, uint256 amount)",
  "event Borrowed(address indexed user, uint256 amount)",
  "event Repaid(address indexed user, uint256 amount)"
];

// ERC20 合約 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)"
];

export class CompoundService {
  private comet: ethers.Contract;
  private provider: ethers.Provider;
  
  constructor(cometAddress: string, provider: ethers.Provider) {
    this.provider = provider;
    this.comet = new ethers.Contract(cometAddress, COMET_ABI, provider);
  }
  
  /**
   * 存入 TSPY 作為抵押品
   */
  async supplyCollateral(amount: string, signer: ethers.Signer): Promise<ethers.ContractTransactionResponse> {
    const tspyContract = new ethers.Contract(TSPY_ADDRESS, ERC20_ABI, signer);
    
    // 1. 檢查授權
    const allowance = await tspyContract.allowance(await signer.getAddress(), COMET_ADDRESS);
    const requiredAmount = ethers.parseUnits(amount, 18);
    
    if (allowance < requiredAmount) {
      console.log("Approving TSPY for Comet...");
      const approveTx = await tspyContract.approve(COMET_ADDRESS, requiredAmount);
      await approveTx.wait();
      console.log("TSPY approved");
    }
    
    // 2. 存入抵押品
    console.log("Supplying collateral...");
    const supplyTx = await this.comet.connect(signer).supply(TSPY_ADDRESS, requiredAmount);
    return supplyTx;
  }
  
  /**
   * 借出 USDC
   */
  async borrow(amount: string, signer: ethers.Signer): Promise<ethers.ContractTransactionResponse> {
    const requiredAmount = ethers.parseUnits(amount, 6); // USDC 6 decimals
    
    console.log("Borrowing USDC...");
    const borrowTx = await this.comet.connect(signer).borrow(requiredAmount);
    return borrowTx;
  }
  
  /**
   * 還款
   */
  async repay(amount: string, signer: ethers.Signer): Promise<ethers.ContractTransactionResponse> {
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
    const requiredAmount = ethers.parseUnits(amount, 6); // USDC 6 decimals
    
    // 1. 檢查授權
    const allowance = await usdcContract.allowance(await signer.getAddress(), COMET_ADDRESS);
    
    if (allowance < requiredAmount) {
      console.log("Approving USDC for Comet...");
      const approveTx = await usdcContract.approve(COMET_ADDRESS, requiredAmount);
      await approveTx.wait();
      console.log("USDC approved");
    }
    
    // 2. 還款
    console.log("Repaying USDC...");
    const repayTx = await this.comet.connect(signer).repay(requiredAmount);
    return repayTx;
  }
  
  /**
   * 提取抵押品
   */
  async withdrawCollateral(amount: string, signer: ethers.Signer): Promise<ethers.ContractTransactionResponse> {
    const requiredAmount = ethers.parseUnits(amount, 18); // TSPY 18 decimals
    
    console.log("Withdrawing collateral...");
    const withdrawTx = await this.comet.connect(signer).withdraw(TSPY_ADDRESS, requiredAmount);
    return withdrawTx;
  }
  
  /**
   * 檢查帳戶健康狀態
   */
  async getAccountHealth(userAddress: string): Promise<{
    isCollateralized: boolean;
    isLiquidatable: boolean;
    healthFactor: string;
    healthFactorNumber: number;
  }> {
    try {
      const [isCollateralized, isLiquidatable, healthFactor] = await Promise.all([
        this.comet.isBorrowCollateralized(userAddress),
        this.comet.isLiquidatable(userAddress),
        this.comet.getAccountHealth(userAddress)
      ]);
      
      const healthFactorNumber = parseFloat(ethers.formatUnits(healthFactor, 18));
      
      return {
        isCollateralized,
        isLiquidatable,
        healthFactor: ethers.formatUnits(healthFactor, 18),
        healthFactorNumber
      };
    } catch (error) {
      console.error("Failed to get account health:", error);
      return {
        isCollateralized: false,
        isLiquidatable: true,
        healthFactor: "0",
        healthFactorNumber: 0
      };
    }
  }
  
  /**
   * 獲取用戶餘額
   */
  async getUserBalances(userAddress: string): Promise<{
    tspyCollateral: string;
    usdcSupply: string;
    usdcBorrow: string;
    tspyWalletBalance: string;
    usdcWalletBalance: string;
  }> {
    try {
      const [tspyCollateral, usdcSupply, usdcBorrow] = await Promise.all([
        this.comet.collateralBalanceOf(userAddress, TSPY_ADDRESS),
        this.comet.balanceOf(userAddress),
        this.comet.borrowBalanceOf(userAddress)
      ]);
      
      // 獲取錢包餘額
      const tspyContract = new ethers.Contract(TSPY_ADDRESS, ERC20_ABI, this.provider);
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.provider);
      
      const [tspyWalletBalance, usdcWalletBalance] = await Promise.all([
        tspyContract.balanceOf(userAddress),
        usdcContract.balanceOf(userAddress)
      ]);
      
      return {
        tspyCollateral: ethers.formatUnits(tspyCollateral, 18),
        usdcSupply: ethers.formatUnits(usdcSupply, 6),
        usdcBorrow: ethers.formatUnits(usdcBorrow, 6),
        tspyWalletBalance: ethers.formatUnits(tspyWalletBalance, 18),
        usdcWalletBalance: ethers.formatUnits(usdcWalletBalance, 6)
      };
    } catch (error) {
      console.error("Failed to get user balances:", error);
      return {
        tspyCollateral: "0",
        usdcSupply: "0",
        usdcBorrow: "0",
        tspyWalletBalance: "0",
        usdcWalletBalance: "0"
      };
    }
  }
  
  /**
   * 獲取借貸能力
   */
  async getBorrowingPower(userAddress: string): Promise<string> {
    try {
      const power = await this.comet.getBorrowingPower(userAddress);
      return ethers.formatUnits(power, 6); // USDC 6 decimals
    } catch (error) {
      console.error("Failed to get borrowing power:", error);
      return "0";
    }
  }
  
  /**
   * 獲取總抵押品價值
   */
  async getTotalCollateralValue(userAddress: string): Promise<string> {
    try {
      const value = await this.comet.getTotalCollateralValue(userAddress);
      return ethers.formatUnits(value, 6); // USD 6 decimals
    } catch (error) {
      console.error("Failed to get total collateral value:", error);
      return "0";
    }
  }
  
  /**
   * 獲取總借貸價值
   */
  async getTotalBorrowValue(userAddress: string): Promise<string> {
    try {
      const value = await this.comet.getTotalBorrowValue(userAddress);
      return ethers.formatUnits(value, 6); // USDC 6 decimals
    } catch (error) {
      console.error("Failed to get total borrow value:", error);
      return "0";
    }
  }
  
  /**
   * 計息
   */
  async accrueInterest(): Promise<ethers.ContractTransactionResponse> {
    return await this.comet.accrueInterest();
  }
  
  /**
   * 獲取合約地址
   */
  async getAddress(): Promise<string> {
    return await this.comet.getAddress();
  }
  
  /**
   * 監聽事件
   */
  on(eventName: string, callback: (...args: any[]) => void) {
    this.comet.on(eventName, callback);
  }
  
  /**
   * 移除事件監聽器
   */
  off(eventName: string, callback?: (...args: any[]) => void) {
    if (callback) {
      this.comet.off(eventName, callback);
    } else {
      this.comet.removeAllListeners(eventName);
    }
  }
}

// 創建 Compound 服務實例的工廠函數
export function createCompoundService(provider: ethers.Provider): CompoundService {
  return new CompoundService(COMET_ADDRESS, provider);
}

// 導出常數
export const COMPOUND_CONSTANTS = {
  COMET_ADDRESS,
  TSPY_ADDRESS,
  USDC_ADDRESS
};
