# Smart Contracts for RWA Lending Platform

This directory contains the Solidity smart contracts for the tokenized Real World Assets (RWA) lending platform.

## Contracts Overview

### 1. TokenizedAsset.sol
ERC20 token representing tokenized stocks or bonds.
- **Features:**
  - Represents ownership of real-world assets (stocks/bonds)
  - Price oracle integration
  - Authorized minting/burning for the lending platform
  - Price updates from external oracles

### 2. InterestRateModel.sol
Interest rate calculation using a kinked model (similar to Compound).
- **Features:**
  - Utilization-based interest rates
  - Kinked rate model (changes rate at optimal utilization)
  - Borrow and supply APY calculations

**Parameters:**
- Base Rate: 2%
- Multiplier: 10%
- Jump Multiplier: 300%
- Optimal Utilization (Kink): 80%

### 3. LendingPool.sol
Main lending protocol contract.
- **Features:**
  - Collateral deposits and withdrawals
  - Borrowing against collateral
  - Interest accrual
  - Health factor monitoring
  - Liquidation mechanism
  - Multiple asset support

## Deployment Instructions

### Prerequisites
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

### 1. Setup Hardhat

Create `hardhat.config.js`:
```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    sepolia: {
      url: process.env.NEXT_PUBLIC_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

### 2. Install OpenZeppelin Contracts
```bash
npm install @openzeppelin/contracts
```

### 3. Deploy Contracts

Create `scripts/deploy.js`:
```javascript
const hre = require("hardhat");

async function main() {
  // Deploy InterestRateModel
  const InterestRateModel = await hre.ethers.getContractFactory("InterestRateModel");
  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  console.log("InterestRateModel deployed to:", await interestRateModel.getAddress());

  // Deploy a stablecoin (or use existing USDC)
  // For testing, you might want to deploy a mock USDC
  const stableCoinAddress = "YOUR_STABLECOIN_ADDRESS";

  // Deploy LendingPool
  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(
    stableCoinAddress,
    await interestRateModel.getAddress()
  );
  await lendingPool.waitForDeployment();
  console.log("LendingPool deployed to:", await lendingPool.getAddress());

  // Deploy TokenizedAssets
  const TokenizedAsset = await hre.ethers.getContractFactory("TokenizedAsset");
  
  const tAAPL = await TokenizedAsset.deploy(
    "Tokenized Apple Inc.",
    "TAAPL",
    "AAPL",
    "STOCK",
    ethers.parseUnits("170", 8) // $170 with 8 decimals
  );
  await tAAPL.waitForDeployment();
  console.log("TAAPL deployed to:", await tAAPL.getAddress());

  // List market in LendingPool
  await lendingPool.listMarket(
    "TAAPL",
    await tAAPL.getAddress(),
    ethers.parseUnits("0.75", 18), // 75% collateral factor
    ethers.parseUnits("0.85", 18), // 85% liquidation threshold
    ethers.parseUnits("0.10", 18)  // 10% liquidation penalty
  );
  console.log("TAAPL market listed");

  // Authorize LendingPool to mint/burn tokens
  await tAAPL.setAuthorizedMinter(await lendingPool.getAddress(), true);
  console.log("LendingPool authorized to mint/burn TAAPL");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Deploy:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### 4. Update Environment Variables

Copy the deployed contract addresses to your `.env` file.

## Key Parameters

### Collateral Factors
- Stocks (AAPL, GOOGL, MSFT): 75%
- Volatile Stocks (TSLA): 65%
- Bonds: 90%

### Liquidation Thresholds
- Stocks: 85%
- Volatile Stocks: 80%
- Bonds: 95%

### Interest Rate Model
- Utilization below 80%: Gradual rate increase
- Utilization above 80%: Steep rate increase (jump)

## Testing

Create test files in `test/` directory:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LendingPool", function () {
  // Add your tests here
});
```

Run tests:
```bash
npx hardhat test
```

## Security Considerations

1. **Access Control**: Only authorized addresses can mint/burn tokens
2. **Reentrancy Protection**: All external calls are protected
3. **Oracle Security**: Price updates should be from trusted sources
4. **Liquidation**: Proper health factor monitoring prevents bad debt
5. **Interest Accrual**: Accurate interest calculation prevents manipulation

## Upgrades and Maintenance

- Use a multisig wallet for contract ownership
- Implement timelock for critical parameter changes
- Regular security audits recommended
- Monitor health factors and liquidation opportunities

## Integration with Frontend

The frontend uses ethers.js to interact with these contracts. See `/src/contracts/index.ts` for ABI definitions and addresses.

## License

MIT License

