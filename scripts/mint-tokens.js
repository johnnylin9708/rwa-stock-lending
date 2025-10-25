const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Script to mint test tokens for development
 * Usage: npx hardhat run scripts/mint-tokens.js --network sepolia
 */

async function main() {
  // Configuration
  const RECIPIENT_ADDRESS = process.env.TEST_WALLET_ADDRESS || "YOUR_WALLET_ADDRESS";
  const MINT_AMOUNT = ethers.parseUnits("1000", 18); // Mint 1000 tokens

  // Token addresses (update with your deployed addresses)
  const tokens = {
    TAAPL: process.env.NEXT_PUBLIC_TAAPL_ADDRESS,
    TGOOGL: process.env.NEXT_PUBLIC_TGOOGL_ADDRESS,
    TTSLA: process.env.NEXT_PUBLIC_TTSLA_ADDRESS,
    TMSFT: process.env.NEXT_PUBLIC_TMSFT_ADDRESS,
    TUSG: process.env.NEXT_PUBLIC_TUSG_ADDRESS,
    mUSDC: process.env.NEXT_PUBLIC_STABLECOIN_ADDRESS,
  };

  console.log("Minting test tokens...\n");
  console.log("Recipient:", RECIPIENT_ADDRESS);
  console.log("Amount:", ethers.formatUnits(MINT_AMOUNT, 18), "tokens each\n");

  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address, "\n");

  for (const [symbol, address] of Object.entries(tokens)) {
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      console.log(`⚠️  ${symbol}: No address configured, skipping...`);
      continue;
    }

    try {
      const TokenContract = await ethers.getContractAt("TokenizedAsset", address);
      
      console.log(`Minting ${symbol}...`);
      const tx = await TokenContract.mint(RECIPIENT_ADDRESS, MINT_AMOUNT);
      await tx.wait();
      
      const balance = await TokenContract.balanceOf(RECIPIENT_ADDRESS);
      console.log(`✅ ${symbol} minted successfully!`);
      console.log(`   New balance: ${ethers.formatUnits(balance, 18)}\n`);
    } catch (error) {
      console.error(`❌ Error minting ${symbol}:`, error.message, "\n");
    }
  }

  console.log("✅ Minting completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

