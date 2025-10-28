// scripts/setup-chainlink.js
const { ethers } = require("hardhat");

async function setupChainlink() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting up Chainlink with account:", deployer.address);
  
  // Chainlink 價格預言機地址 (Sepolia 測試網)
  const CHAINLINK_ADDRESSES = {
    // Sepolia 測試網
    sepolia: {
      SPY_USD: "0x...", // 需要從 Chainlink 獲取實際地址
      USDC_USD: "0x...", // 需要從 Chainlink 獲取實際地址
      ETH_USD: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // 已知的 ETH/USD 地址
    },
    // 主網
    mainnet: {
      SPY_USD: "0x...", // 需要從 Chainlink 獲取實際地址
      USDC_USD: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", // 已知的 USDC/USD 地址
      ETH_USD: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // 已知的 ETH/USD 地址
    }
  };
  
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === 'sepolia' ? 'sepolia' : 'mainnet';
  const addresses = CHAINLINK_ADDRESSES[networkName];
  
  console.log(`\n=== 設置 Chainlink 價格預言機 (${networkName}) ===`);
  
  try {
    // 1. 部署 SPY 價格預言機
    console.log("\n--- 部署 SPY 價格預言機 ---");
    const SPYOracle = await ethers.getContractFactory("SPYPriceOracle");
    
    // 使用 ETH/USD 作為測試 (因為 SPY/USD 可能不可用)
    const testPriceFeed = addresses.ETH_USD || addresses.SPY_USD;
    console.log("Using price feed:", testPriceFeed);
    
    const spyOracle = await SPYOracle.deploy(testPriceFeed);
    await spyOracle.waitForDeployment();
    const oracleAddress = await spyOracle.getAddress();
    console.log("SPY Price Oracle deployed to:", oracleAddress);
    
    // 2. 測試價格獲取
    console.log("\n--- 測試價格獲取 ---");
    try {
      const price = await spyOracle.getPrice();
      const priceWithDecimals = await spyOracle.getPriceWithDecimals();
      const priceAndTimestamp = await spyOracle.getPriceAndTimestamp();
      const isValid = await spyOracle.isPriceValid();
      
      console.log("Raw price (8 decimals):", ethers.formatUnits(price, 8));
      console.log("Price with decimals (18 decimals):", ethers.formatUnits(priceWithDecimals, 18));
      console.log("Price and timestamp:", {
        price: ethers.formatUnits(priceAndTimestamp.price, 8),
        timestamp: new Date(priceAndTimestamp.timestamp * 1000).toISOString()
      });
      console.log("Is price valid:", isValid);
      
      // 獲取價格預言機資訊
      const feedInfo = await spyOracle.getPriceFeedInfo();
      console.log("Price feed info:", {
        address: feedInfo.feedAddress,
        decimals: feedInfo.decimals,
        description: feedInfo.description
      });
      
    } catch (error) {
      console.log("Price oracle test failed:", error.message);
      console.log("This might be because the price feed is not available on this network");
    }
    
    // 3. 部署 USDC 價格預言機 (如果需要)
    console.log("\n--- 部署 USDC 價格預言機 ---");
    const USDCOracle = await ethers.getContractFactory("SPYPriceOracle");
    const usdcOracle = await USDCOracle.deploy(addresses.USDC_USD || addresses.ETH_USD);
    await usdcOracle.waitForDeployment();
    const usdcOracleAddress = await usdcOracle.getAddress();
    console.log("USDC Price Oracle deployed to:", usdcOracleAddress);
    
    // 4. 創建價格預言機管理器
    console.log("\n--- 部署價格預言機管理器 ---");
    const PriceOracleManager = await ethers.getContractFactory("PriceOracleManager");
    const oracleManager = await PriceOracleManager.deploy();
    await oracleManager.waitForDeployment();
    const managerAddress = await oracleManager.getAddress();
    console.log("Price Oracle Manager deployed to:", managerAddress);
    
    // 5. 註冊價格預言機
    console.log("\n--- 註冊價格預言機 ---");
    const registerTx1 = await oracleManager.registerOracle("SPY", oracleAddress);
    await registerTx1.wait();
    console.log("SPY oracle registered");
    
    const registerTx2 = await oracleManager.registerOracle("USDC", usdcOracleAddress);
    await registerTx2.wait();
    console.log("USDC oracle registered");
    
    // 6. 測試價格預言機管理器
    console.log("\n--- 測試價格預言機管理器 ---");
    const spyPrice = await oracleManager.getPrice("SPY");
    const usdcPrice = await oracleManager.getPrice("USDC");
    
    console.log("SPY price from manager:", ethers.formatUnits(spyPrice, 8));
    console.log("USDC price from manager:", ethers.formatUnits(usdcPrice, 8));
    
    // 7. 輸出部署結果
    console.log("\n=== Chainlink 設置完成 ===");
    console.log("Network:", networkName);
    console.log("SPY Oracle:", oracleAddress);
    console.log("USDC Oracle:", usdcOracleAddress);
    console.log("Oracle Manager:", managerAddress);
    
    // 8. 保存配置
    const config = {
      network: networkName,
      chainId: network.chainId,
      deployer: deployer.address,
      oracles: {
        SPY: oracleAddress,
        USDC: usdcOracleAddress,
        Manager: managerAddress
      },
      chainlinkFeeds: addresses,
      timestamp: new Date().toISOString()
    };
    
    const fs = require('fs');
    fs.writeFileSync(
      'deployments/chainlink-config.json',
      JSON.stringify(config, null, 2)
    );
    console.log("Chainlink config saved to deployments/chainlink-config.json");
    
    return config;
    
  } catch (error) {
    console.error("Chainlink setup failed:", error);
    throw error;
  }
}

// 如果直接執行此腳本
if (require.main === module) {
  setupChainlink()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { setupChainlink };
