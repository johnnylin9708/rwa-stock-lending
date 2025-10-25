# RWA Stock Lending Platform

A decentralized lending platform for tokenized Real World Assets (RWA), specifically stocks and bonds. Users can deposit tokenized assets as collateral and borrow stablecoins against them.

## 🎯 Core Features

### For Users
- **Deposit Collateral**: Deposit tokenized stocks/bonds as collateral
- **Borrow Stablecoins**: Borrow against your collateral with competitive rates
- **Real-time Market Data**: Live price feeds from Alpaca API
- **Health Factor Monitoring**: Track your position's safety in real-time
- **Trading Integration**: Execute trades directly through Alpaca
- **Transaction History**: View all your lending activities

### For the Platform
- **Dynamic Interest Rates**: Compound-style kinked interest rate model
- **Risk Management**: Automated liquidation for underwater positions
- **Multiple Assets**: Support for various tokenized stocks and bonds
- **Price Oracle Integration**: Chainlink and Alpaca price feeds
- **Smart Contract Security**: Built with OpenZeppelin standards

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Smart Contracts**: Solidity 0.8.20, OpenZeppelin
- **Blockchain**: Ethereum (Sepolia testnet), Binance Smart Chain
- **Market Data**: Alpaca Markets API
- **Price Oracles**: Chainlink, Alpaca
- **Web3**: Ethers.js v6
- **UI**: Tailwind CSS, Radix UI

### Project Structure
```
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── api/               # API routes
│   │   │   ├── alpaca/       # Alpaca integration
│   │   │   ├── lending/      # Lending APIs
│   │   │   └── prices/       # Price feeds
│   │   ├── dashboard/        # User dashboard
│   │   ├── lending/          # Lending interface
│   │   ├── trade/            # Trading interface
│   │   └── history/          # Transaction history
│   ├── components/            # React components
│   ├── contracts/            # Contract ABIs and addresses
│   ├── context/              # React contexts (Web3)
│   └── lib/                  # Utilities and helpers
├── contracts/                 # Solidity smart contracts
│   ├── TokenizedAsset.sol    # ERC20 tokenized assets
│   ├── LendingPool.sol       # Main lending protocol
│   └── InterestRateModel.sol # Interest calculations
└── public/                    # Static assets
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MetaMask wallet
- Alpaca API account
- Infura/Alchemy account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rwa-stock-stacking-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your `.env.local` with:
   - Alpaca API credentials
   - Blockchain RPC URL
   - Contract addresses (after deployment)

5. Deploy smart contracts:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

6. Start the development server:
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

For detailed setup instructions, see [ENV_SETUP.md](ENV_SETUP.md).

## 📚 Documentation

- **[Setup Guide](ENV_SETUP.md)**: Complete environment setup
- **[Smart Contracts](contracts/README.md)**: Contract documentation and deployment
- **[API Documentation](#)**: API endpoints reference

## 🔑 Key Concepts

### Collateral Factor
The maximum percentage of collateral value that can be borrowed. Example: 75% means you can borrow up to $75 for every $100 of collateral.

### Health Factor
Ratio of collateral value to borrowed value. Must stay above 1.0 to avoid liquidation:
```
Health Factor = (Collateral Value × Liquidation Threshold) / Borrowed Value
```

### Interest Rate Model
Uses a kinked model similar to Compound:
- **Below 80% utilization**: Gradual rate increase
- **Above 80% utilization**: Steep rate increase

### Liquidation
When health factor drops below 1.0, positions can be liquidated:
- Liquidator repays debt
- Receives collateral + 10% bonus
- Maximum 50% of debt can be liquidated at once

## 🌟 Supported Assets

| Asset | Symbol | Type | Collateral Factor | Liquidation Threshold |
|-------|--------|------|-------------------|-----------------------|
| Apple Inc. | TAAPL | Stock | 75% | 85% |
| Alphabet Inc. | TGOOGL | Stock | 75% | 85% |
| Tesla Inc. | TTSLA | Stock | 65% | 80% |
| Microsoft Corp. | TMSFT | Stock | 75% | 85% |
| US Gov Bonds | TUSG | Bond | 90% | 95% |

## 📊 Interest Rates

Current rate parameters:
- **Base Rate**: 2%
- **Multiplier**: 10%
- **Jump Multiplier**: 300%
- **Optimal Utilization**: 80%

## 🔐 Security

- Smart contracts built with OpenZeppelin
- Reentrancy protection on all critical functions
- Access control for admin operations
- Regular security audits recommended

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run smart contract tests:
```bash
npx hardhat test
```

## 🛣️ Roadmap

- [x] Basic lending and borrowing
- [x] Interest rate calculations
- [x] Health factor monitoring
- [x] Real-time price feeds
- [ ] Liquidation bot
- [ ] Mobile responsive design
- [ ] Additional asset support
- [ ] Governance token
- [ ] Cross-chain support
- [ ] Advanced analytics dashboard

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📝 License

MIT License - see LICENSE file for details

## ⚠️ Disclaimer

This is an MVP for demonstration purposes. Not audited for production use. Use at your own risk. Always conduct thorough testing and audits before deploying to mainnet.

## 🔗 Links

- [Alpaca Markets](https://alpaca.markets/)
- [Chainlink](https://chain.link/)
- [Compound Protocol](https://compound.finance/)
- [OpenZeppelin](https://openzeppelin.com/)

## 📧 Support

For questions and support:
- Open an issue on GitHub
- Check documentation in `/contracts/README.md` and `ENV_SETUP.md`
