const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString(), "\n");

  // 1. Deploy InterestRateModel
  console.log("Deploying InterestRateModel...");
  const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  const interestRateModelAddress = await interestRateModel.getAddress();
  console.log("✅ InterestRateModel deployed to:", interestRateModelAddress, "\n");

  // 2. Deploy or use existing stablecoin
  // For testing, you might want to deploy a mock ERC20
  console.log("Note: You need to provide a stablecoin address (e.g., USDC on testnet)");
  console.log("For testing, you can deploy a mock ERC20 token\n");
  
  // Mock stablecoin deployment (for testing only)
  const MockERC20 = await ethers.getContractFactory("TokenizedAsset");
  const mockUSDC = await MockERC20.deploy(
    "Mock USDC",
    "mUSDC",
    "USDC",
    "STABLECOIN",
    ethers.parseUnits("1", 8) // $1 with 8 decimals
  );
  await mockUSDC.waitForDeployment();
  const stableCoinAddress = await mockUSDC.getAddress();
  console.log("✅ Mock USDC deployed to:", stableCoinAddress, "\n");

  // 3. Deploy LendingPool
  console.log("Deploying LendingPool...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(
    stableCoinAddress,
    interestRateModelAddress
  );
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();
  console.log("✅ LendingPool deployed to:", lendingPoolAddress, "\n");

  // 4. Deploy Tokenized Assets
  const assets = [
    { name: "Tokenized Apple Inc.", symbol: "TAAPL", original: "AAPL", price: "170" },
    { name: "Tokenized Alphabet Inc.", symbol: "TGOOGL", original: "GOOGL", price: "140" },
    { name: "Tokenized Tesla Inc.", symbol: "TTSLA", original: "TSLA", price: "250" },
    { name: "Tokenized Microsoft Corp.", symbol: "TMSFT", original: "MSFT", price: "370" },
    { name: "Tokenized US Gov Bonds", symbol: "TUSG", original: "USG", price: "100" },
  ];

  const deployedAssets = {};

  for (const asset of assets) {
    console.log(`Deploying ${asset.symbol}...`);
    const TokenizedAsset = await ethers.getContractFactory("TokenizedAsset");
    const tokenizedAsset = await TokenizedAsset.deploy(
      asset.name,
      asset.symbol,
      asset.original,
      asset.original === "USG" ? "BOND" : "STOCK",
      ethers.parseUnits(asset.price, 8) // Price with 8 decimals
    );
    await tokenizedAsset.waitForDeployment();
    const assetAddress = await tokenizedAsset.getAddress();
    deployedAssets[asset.symbol] = assetAddress;
    console.log(`✅ ${asset.symbol} deployed to:`, assetAddress);

    // Authorize LendingPool to mint/burn
    await tokenizedAsset.setAuthorizedMinter(lendingPoolAddress, true);
    console.log(`✅ LendingPool authorized to mint/burn ${asset.symbol}\n`);
  }

  // 5. List markets in LendingPool
  const marketConfigs = [
    { symbol: "TAAPL", cf: "0.75", lt: "0.85", lp: "0.10" },
    { symbol: "TGOOGL", cf: "0.75", lt: "0.85", lp: "0.10" },
    { symbol: "TTSLA", cf: "0.65", lt: "0.80", lp: "0.10" },
    { symbol: "TMSFT", cf: "0.75", lt: "0.85", lp: "0.10" },
    { symbol: "TUSG", cf: "0.90", lt: "0.95", lp: "0.10" },
  ];

  console.log("Listing markets in LendingPool...");
  for (const config of marketConfigs) {
    await lendingPool.listMarket(
      config.symbol,
      deployedAssets[config.symbol],
      ethers.parseUnits(config.cf, 18), // Collateral factor
      ethers.parseUnits(config.lt, 18), // Liquidation threshold
      ethers.parseUnits(config.lp, 18)  // Liquidation penalty
    );
    console.log(`✅ ${config.symbol} market listed`);
  }

  console.log("\n🎉 Deployment completed successfully!\n");
  console.log("=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("InterestRateModel:", interestRateModelAddress);
  console.log("StableCoin (Mock USDC):", stableCoinAddress);
  console.log("LendingPool:", lendingPoolAddress);
  console.log("\nTokenized Assets:");
  for (const [symbol, address] of Object.entries(deployedAssets)) {
    console.log(`  ${symbol}:`, address);
  }
  console.log("=".repeat(60));
  
  console.log("\n📝 Add these to your .env.local file:");
  console.log(`NEXT_PUBLIC_LENDING_POOL_ADDRESS=${lendingPoolAddress}`);
  console.log(`NEXT_PUBLIC_INTEREST_RATE_MODEL_ADDRESS=${interestRateModelAddress}`);
  console.log(`NEXT_PUBLIC_STABLECOIN_ADDRESS=${stableCoinAddress}`);
  for (const [symbol, address] of Object.entries(deployedAssets)) {
    console.log(`NEXT_PUBLIC_${symbol}_ADDRESS=${address}`);
  }
  
  console.log("\n🔍 Verify contracts on Etherscan:");
  console.log("npx hardhat verify --network sepolia", lendingPoolAddress, stableCoinAddress, interestRateModelAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

