// src/lib/compound-client.ts
import { ethers } from 'ethers';

// 合約地址 (從環境變數獲取，客戶端可安全暴露)
// 注意：合約地址是公開資訊，暴露在客戶端是完全安全的
// 如果需要客戶端使用，使用 NEXT_PUBLIC_ 前綴
const COMET_ADDRESS = process.env.NEXT_PUBLIC_COMET_ADDRESS || "0xfa80b411995AaBb4cdA7BcE5cEF26b5d5Ac12353";
const TSPY_ADDRESS = process.env.NEXT_PUBLIC_TSPY_ADDRESS || "0xBEae6Fa62362aB593B498692FD09002a9eEd52dc";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x89e8a0f004CC32750b49D0dAbA5a88E88FA090E4";
const TSTOCK_PRICE_FEED_ADDRESS = process.env.NEXT_PUBLIC_TSTOCK_PRICE_FEED_ADDRESS || "0x4b531A318B0e44B549F3b2f824721b3D0d51930A";

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
  "function getAssetInfoByAddress(address asset) public view returns (uint8 offset, address asset, address priceFeed, uint64 scale, uint64 borrowCollateralFactor, uint64 liquidateCollateralFactor, uint64 liquidationFactor, uint128 supplyCap)",
  "function getTotalCollateralValue(address user) external view returns (uint256)",
  "function getTotalBorrowValue(address user) external view returns (uint256)",
  "function getPrice(address feed) external view returns (uint256)",
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

/**
 * 獲取 Comet 合約實例
 */
function getCometContract(provider: ethers.Provider | ethers.Signer): ethers.Contract {
  return new ethers.Contract(COMET_ADDRESS, COMET_ABI, provider);
}

/**
 * 存入 TSPY 作為抵押品
 */
export async function supplyCollateral(
  amount: string,
  signer: ethers.Signer
): Promise<ethers.ContractTransactionResponse> {
  const tspyContract = new ethers.Contract(TSPY_ADDRESS, ERC20_ABI, signer);
  const cometContract = getCometContract(signer);
  
  // 1. 檢查授權
  const userAddress = await signer.getAddress();
  const allowance = await tspyContract.allowance(userAddress, COMET_ADDRESS);
  const requiredAmount = ethers.parseUnits(amount, 0);

  if (allowance < requiredAmount) {
    const approveTx = await tspyContract.approve(COMET_ADDRESS, requiredAmount);
    await approveTx.wait();
  }
  
  // 2. 存入抵押品
  const supplyTx = await cometContract.supply(TSPY_ADDRESS, requiredAmount);
  return supplyTx;
}

/**
 * 存入 USDC 作為供應
 */
export async function supplyUsdcSupply(
  amount: string,
  signer: ethers.Signer
): Promise<ethers.ContractTransactionResponse> {
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
  const cometContract = getCometContract(signer);
  
  // 1. 檢查授權
  const userAddress = await signer.getAddress();
  const allowance = await usdcContract.allowance(userAddress, COMET_ADDRESS);
  const requiredAmount = ethers.parseUnits(amount, 6);

  if (allowance < requiredAmount) {
    const approveTx = await usdcContract.approve(COMET_ADDRESS, requiredAmount);
    await approveTx.wait();
  }
  
  // 2. 存入抵押品
  const supplyTx = await cometContract.supply(USDC_ADDRESS, requiredAmount);
  return supplyTx;
}

/**
 * 借出 USDC
 */
export async function borrow(
  amount: string,
  signer: ethers.Signer
): Promise<ethers.ContractTransactionResponse> {
  const cometContract = getCometContract(signer);
  const requiredAmount = ethers.parseUnits(amount, 6); // USDC 6 decimals
  
  const borrowTx = await cometContract.withdraw(USDC_ADDRESS, requiredAmount);
  return borrowTx;
}

/**
 * 還款
 */
export async function repay(
  amount: string,
  signer: ethers.Signer
): Promise<ethers.ContractTransactionResponse> {
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
  const cometContract = getCometContract(signer);
  const requiredAmount = ethers.parseUnits(amount, 6); // USDC 6 decimals
  
  // 1. 檢查授權
  const userAddress = await signer.getAddress();
  const allowance = await usdcContract.allowance(userAddress, COMET_ADDRESS);
  
  if (allowance < requiredAmount) {
    console.log("Approving USDC for Comet...");
    const approveTx = await usdcContract.approve(COMET_ADDRESS, requiredAmount);
    await approveTx.wait();
    console.log("USDC approved");
  }
  
  // 2. 還款
  console.log("Repaying USDC...");
  const repayTx = await cometContract.repay(requiredAmount);
  return repayTx;
}

/**
 * 提取抵押品
 */
export async function withdrawCollateral(
  amount: string,
  signer: ethers.Signer
): Promise<ethers.ContractTransactionResponse> {
  const cometContract = getCometContract(signer);
  const requiredAmount = ethers.parseUnits(amount, 0); // TSPY 18 decimals
  
  console.log("Withdrawing collateral...");
  const withdrawTx = await cometContract.withdraw(TSPY_ADDRESS, requiredAmount);
  return withdrawTx;
}

/**
 * 檢查帳戶健康狀態
 */
export async function getAccountHealth(
  userAddress: string,
  provider: ethers.Provider
): Promise<{
  isCollateralized: boolean;
  isLiquidatable: boolean;
  healthFactor: string;
  healthFactorNumber: number;
}> {
  try {
    const cometContract = getCometContract(provider);
    const [isCollateralized, isLiquidatable, healthFactor] = await Promise.all([
      cometContract.isBorrowCollateralized(userAddress),
      cometContract.isLiquidatable(userAddress),
      cometContract.getAccountHealth(userAddress)
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
export async function getUserBalances(
  userAddress: string,
  provider: ethers.Provider
): Promise<{
  tspyCollateral: string;
  usdcSupply: string;
  usdcBorrow: string;
  tspyWalletBalance: string;
  usdcWalletBalance: string;
}> {
  try {
    const cometContract = getCometContract(provider);
    const [tspyCollateral, usdcSupply, usdcBorrow] = await Promise.all([
      cometContract.collateralBalanceOf(userAddress, TSPY_ADDRESS),
      cometContract.balanceOf(userAddress),
      cometContract.borrowBalanceOf(userAddress)
    ]);

    console.log("usdcBorrow", usdcBorrow);
    
    // 獲取錢包餘額
    const tspyContract = new ethers.Contract(TSPY_ADDRESS, ERC20_ABI, provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    
    const [tspyWalletBalance, usdcWalletBalance] = await Promise.all([
      tspyContract.balanceOf(userAddress),
      usdcContract.balanceOf(userAddress)
    ]);
    
    return {
      tspyCollateral: ethers.formatUnits(tspyCollateral, 0),
      usdcSupply: ethers.formatUnits(usdcSupply, 6),
      usdcBorrow: ethers.formatUnits(usdcBorrow, 6),
      tspyWalletBalance: ethers.formatUnits(tspyWalletBalance, 0),
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
export async function getBorrowingPower(
  userAddress: string,
  provider: ethers.Provider
): Promise<string> {
  try {
    const cometContract = getCometContract(provider);
    const tstockAssetInfo = await cometContract.getAssetInfoByAddress(TSPY_ADDRESS);
    const borrowCF = tstockAssetInfo.borrowCollateralFactor;
    const collateralValueUSD = await getTstockTotalValue(userAddress, provider);

    const maxBorrowUSD = Number(collateralValueUSD) * Number(borrowCF) / Number(1e18);
    return maxBorrowUSD.toString();
  } catch (error) {
    console.error("Failed to get borrowing power:", error);
    return "0";
  }
}

/**
 * 獲取總供應價值
 */
export async function getTotalSupplyBase(
  userAddress: string,
  provider: ethers.Provider
): Promise<string> {
  try {
    const cometContract = getCometContract(provider);
    const value = await cometContract.getTotalSupplyBase(userAddress);
    return ethers.formatUnits(value, 6); // USD 6 decimals
  } catch (error) {
    console.error("Failed to get total collateral value:", error);
    return "0";
  }
}

/**
 * 獲取總借貸價值
 */
export async function getTotalBorrowBase(
  userAddress: string,
  provider: ethers.Provider
): Promise<string> {
  try {
    const cometContract = getCometContract(provider);
    const value = await cometContract.getTotalBorrowBase(userAddress);
    return ethers.formatUnits(value, 6); // USDC 6 decimals
  } catch (error) {
    console.error("Failed to get total borrow value:", error);
    return "0";
  }
}

/**
 * 獲取 TStock 總價值
 */
export async function getTstockTotalValue(
  userAddress: string,
  provider: ethers.Provider
): Promise<string> {
  try {
    const cometContract = getCometContract(provider);
    const existingCollateral = await cometContract.collateralBalanceOf(userAddress, TSPY_ADDRESS);
    const tstockPrice = await cometContract.getPrice(TSTOCK_PRICE_FEED_ADDRESS);
    const existingCollateralBigInt = ethers.formatUnits(existingCollateral, 0);
    const tstockPriceBigInt = ethers.formatUnits(tstockPrice, 8);
    return (Number(existingCollateralBigInt) * Number(tstockPriceBigInt)).toString(); // USD 6 decimals
  } catch (error) {
    console.error("Failed to get tstock total value:", error);
    return "0";
  }
}

/**
 * 計息
 */
export async function accrueInterest(
  signer: ethers.Signer
): Promise<ethers.ContractTransactionResponse> {
  const cometContract = getCometContract(signer);
  return await cometContract.accrueInterest();
}

// 導出常數
export const COMPOUND_CONSTANTS = {
  COMET_ADDRESS,
  TSPY_ADDRESS,
  USDC_ADDRESS
};
