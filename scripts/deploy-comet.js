// scripts/deploy-comet.js
const { ethers } = require("hardhat");

async function deployComet() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  // 環境變數
  const TSPY_ADDRESS = "0xBEae6Fa62362aB593B498692FD09002a9eEd52dc"; // 您的 TSPY token 地址
  const USDC_ADDRESS = process.env.USDC_ADDRESS || "0x..."; // USDC 合約地址
  const SPY_PRICE_FEED = process.env.SPY_PRICE_FEED || "0x..."; // Chainlink SPY/USD 價格預言機
  
  try {
    // 1. 部署 USDC 合約 (測試用)
    console.log("\n=== 部署 USDC 合約 ===");
    const USDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDC.deploy();
    await usdc.waitForDeployment();
    const usdcAddress = await usdc.getAddress();
    console.log("USDC deployed to:", usdcAddress);
    
    // 2. 部署 SPY 價格預言機
    console.log("\n=== 部署 SPY 價格預言機 ===");
    const SPYOracle = await ethers.getContractFactory("SPYPriceOracle");
    const spyOracle = await SPYOracle.deploy(SPY_PRICE_FEED);
    await spyOracle.waitForDeployment();
    const oracleAddress = await spyOracle.getAddress();
    console.log("SPY Price Oracle deployed to:", oracleAddress);
    
    // 3. 部署 Comet 合約
    console.log("\n=== 部署 Comet 合約 ===");
    const Comet = await ethers.getContractFactory("Comet");
    
    // Comet 配置參數
    const cometConfig = {
      // 基礎資產配置
      baseToken: usdcAddress,
      baseTokenPriceFeed: "0x...", // USDC/USD 價格預言機
      baseTokenScale: ethers.parseUnits("1", 6), // USDC 6 decimals
      
      // 抵押品配置
      collateralAssets: [{
        asset: TSPY_ADDRESS,
        priceFeed: oracleAddress, // 我們的 SPY 價格預言機
        scale: ethers.parseUnits("1", 18), // TSPY 18 decimals
        borrowCollateralFactor: ethers.parseUnits("0.75", 18), // 75%
        liquidateCollateralFactor: ethers.parseUnits("0.85", 18), // 85%
        liquidationFactor: ethers.parseUnits("0.90", 18), // 90%
        supplyCap: ethers.parseUnits("1000000", 18) // 100萬 TSPY
      }],
      
      // 利率模型
      kink: ethers.parseUnits("0.8", 18), // 80%
      perYearInterestRateBase: ethers.parseUnits("0.02", 18), // 2%
      perYearInterestRateSlopeLow: ethers.parseUnits("0.1", 18), // 10%
      perYearInterestRateSlopeHigh: ethers.parseUnits("3.0", 18), // 300%
      
      // 其他參數
      baseBorrowMin: ethers.parseUnits("100", 6), // 最小借貸 100 USDC
      targetReserves: ethers.parseUnits("10000", 6), // 目標儲備 10,000 USDC
      governor: deployer.address,
      pauseGuardian: deployer.address,
      baseTokenBalance: ethers.parseUnits("100000", 6) // 初始流動性 100,000 USDC
    };
    
    const comet = await Comet.deploy(cometConfig);
    await comet.waitForDeployment();
    const cometAddress = await comet.getAddress();
    console.log("Comet deployed to:", cometAddress);
    
    // 4. 配置 TSPY 授權
    console.log("\n=== 配置 TSPY 授權 ===");
    const TSPY = await ethers.getContractAt("TokenizedAsset", TSPY_ADDRESS);
    
    // 授權 Comet 合約使用 TSPY
    const authTx = await TSPY.authorizeComet(cometAddress);
    await authTx.wait();
    console.log("TSPY authorized Comet contract");
    
    // 檢查授權狀態
    const isAuthorized = await TSPY.isAuthorizedComet(cometAddress);
    console.log("Comet authorized:", isAuthorized);
    
    // 5. 初始化 Comet 流動性
    console.log("\n=== 初始化 Comet 流動性 ===");
    
    // 鑄造 USDC 給 Comet 合約
    const mintTx = await usdc.mint(cometAddress, ethers.parseUnits("100000", 6));
    await mintTx.wait();
    console.log("Minted 100,000 USDC to Comet");
    
    // 檢查 Comet 餘額
    const cometBalance = await usdc.balanceOf(cometAddress);
    console.log("Comet USDC balance:", ethers.formatUnits(cometBalance, 6));
    
    // 6. 測試價格預言機
    console.log("\n=== 測試價格預言機 ===");
    try {
      const price = await spyOracle.getPrice();
      console.log("Current SPY price:", ethers.formatUnits(price, 8));
    } catch (error) {
      console.log("Price oracle test failed:", error.message);
    }
    
    // 7. 輸出部署結果
    console.log("\n=== 部署完成 ===");
    console.log("USDC Address:", usdcAddress);
    console.log("SPY Oracle Address:", oracleAddress);
    console.log("Comet Address:", cometAddress);
    console.log("TSPY Address:", TSPY_ADDRESS);
    
    // 8. 保存部署資訊
    const deploymentInfo = {
      network: await ethers.provider.getNetwork(),
      deployer: deployer.address,
      usdc: usdcAddress,
      spyOracle: oracleAddress,
      comet: cometAddress,
      tspy: TSPY_ADDRESS,
      timestamp: new Date().toISOString()
    };
    
    const fs = require('fs');
    fs.writeFileSync(
      'deployments/comet-deployment.json',
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("Deployment info saved to deployments/comet-deployment.json");
    
    return deploymentInfo;
    
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  deployComet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { deployComet };
