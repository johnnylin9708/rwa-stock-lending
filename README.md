# RWA Stock Lending PoC

A Next.js proof‑of‑concept for tokenized stock lending that showcases:
- ERC‑3643 identity and claims (OnchainID + T‑REX)
- Self Protocol identity verification flow (QR, universal link)
- Alpaca broker simulation and price data
- Lending integration and price oracles with Compound/Chainlink

This PoC demonstrates end‑to‑end identity‑gated tokenization and lending.

## 🏗️ Architecture Overview

- **Web app**: Next.js App Router, React, TypeScript, TailwindCSS
- **Data**: MongoDB for users, KYC status, ERC‑3643 identity snapshots, tokenization history
- **Web3**: Ethers v6; OnchainID/T‑REX contracts for ERC‑3643; Compound client for lending
- **Price/Market**: Alpaca API client; Chainlink oracle script for SPY


 <!-- api/
      admin/
        approve-kyc/route.ts        # Admin approval
        process-loan/route.ts       # Loan processing
      loan/apply/route.ts           # Loan application
      prices/route.ts               # Price feed -->
### Project Structure (key folders)
```
src/
  app/
    actions/
      erc3643.ts                    # Identity, claims, minting
      alpaca.ts                     # Alpaca helpers
      tokenization.ts               # Tokenization helpers
      user.ts                       # User helpers
    self/page.tsx                   # Self verification page (QR)
    lending/page.tsx                # Lending UI
    admin/page.tsx                  # Admin UI
    page.tsx                        # Home
  components/                       # UI components
  context/web3-provider.tsx         # Wallet/provider context
  lib/
    alpaca-client.ts                # Alpaca client
    compound-client.ts              # Compound client
    erc3643-client.ts               # ERC‑3643 contract calls
    db/ { mongodb.ts, schemas.ts }  # Mongo connection + schemas
contracts/                          # Solidity contracts (oracle, etc.)
scripts/                            # Hardhat + oracle setup
```

## 🔑 Core Concepts (PoC Focus)

### 1) ERC‑3643 Identity and Claims (OnchainID + T‑REX)
- Create identity via IdentityProxy, grant management key, and optionally register in `IdentityRegistry`.
- Add a KYC claim from a trusted issuer; registry + claim topic must be correctly configured.

### 2) Self Protocol Flow (off‑chain verification UX)
- `src/app/self/page.tsx` renders a QR (`SelfQRcodeWrapper`) built with `SelfAppBuilder`.
- On success callback, the app can call `addSelfVerifiedClaim` to persist a Self‑verified claim and update user KYC status.
- This complements ERC‑3643 on‑chain identity by recording off‑chain verification signals.

### 3) Alpaca Broker Simulation + Prices
- `src/lib/alpaca-client.ts` integrates Alpaca endpoints to fetch quotes and simulate a brokerage account.
- Tokenization actions can refer to Alpaca balances to freeze/represent tokenized quantities in Mongo.

### 4) Lending and Oracles (Compound/Chainlink)
- Chainlink setup scripts: `scripts/setup-chainlink.js` and contracts like `SPYPriceOracle.sol` to provide reference prices.
- Future integration with Compound (Comet) to accept tokenized assets as collateral.
- Client helpers in `src/lib/compound-client.ts` wrap interactions for UI/API.

## Prerequisites

- Node.js 20+
- [Self Mobile App](https://self.xyz/download) (iOS/Android)

## ⚙️ Environment Variables
```bash
cp .env.example .env
```

- Mongo
  - `MONGODB_URI`

- RPC / Network
  - `ETHEREUM_RPC_URL`

- ERC‑3643 / OnchainID / T‑REX
  - `IDENTITY_FACTORY_ADDRESS`
  - `IDENTITY_IMPLEMENTATION_AUTHORITY`
  - `IDENTITY_REGISTRY`
  - `TOKEN_ADDRESS`                         # T‑REX token address
  - `TOKEN_AGENT_PRIVATE_KEY`               # agent that can add keys/claims
  - `CLAIM_ISSUER_CONTRACT`                 # trusted issuer address
  - `CLAIM_ISSUER_SIGNING_KEY`              # issuer private key for signatures
  - `KYC_CLAIM_TOPIC`                       # numeric topic (as string)

- Self Protocol (UI integration)
  - `NEXT_PUBLIC_SELF_APP_NAME`
  - `NEXT_PUBLIC_SELF_SCOPE`
  - `NEXT_PUBLIC_SELF_ENDPOINT`

- Optional
  - `ALPACA_*` keys if calling Alpaca directly

## 🚀 Run Locally
```bash
npm install
npm run dev
# http://localhost:3000
```

## 🧭 PoC Demo Flow

1. Connect wallet on the homepage.
2. Sign up for creating an account under our platform and Alpaca for brokerage usage, after registering successfully and then create an identity with `createIdentityForUser` and add KYC claim with `addKYCClaimToIdentity` into user identity for future verification.
3. Open `Self` page (`/self`), scan QR with Self app and complete verification, this process will add another claim by self human proof verification on their APP.
4. Tokenize/mint tokens with `mintTokensToUser` (requires verified identity).


## 🧩 Core Library vs. Actions

- Core contract logic lives in `src/lib/erc3643-client.ts` (OnchainID/T‑REX):
  - `createIdentityForUser(address)`
  - `registerUserToRegistry(address, identity, country)`
  - `updateIdentityInRegistry(address, newIdentity, country?)`
  - `deleteIdentityFromRegistry(address)`
  - `addKYCClaimToIdentity(userAddress, identityAddress, claimData?)`
  - `verifyUser(address)`
  - `diagnoseVerification(address)`
  - `mintTokensToUser(address, amount)`
  - `getTokenBalance(address)`
  - `checkConfiguration()`

- Actions in `src/app/actions/*` are thin server wrappers for frontend use and persistence. They should delegate to `erc3643-client.ts` for all blockchain logic, then write results to Mongo when needed.

### Why this separation
- `erc3643-client.ts` is framework‑agnostic, testable, and owns the ERC‑3643 invariants and sequencing (registry first, then claims, etc.).
- `src/app/actions` handles Next.js concerns (request context, auth, input sanitation) and database side‑effects.

<!-- ## 🔌 API Routes (Next.js)
- `prices/route.ts`: consolidated price feed endpoint
- `loan/apply/route.ts`: submit loan applications
- `admin/approve-kyc/route.ts`: admin approve KYC
- `admin/process-loan/route.ts`: admin loan processing -->

## 🗄️ Data Model (Mongo Snapshots)
- Collection `users` (`src/lib/db/schemas.ts`):
  - `walletAddress`, `kycStatus`, `kycData`
  - `erc3643`: `identityAddress`, `claims[]`, `isRegistered`, `country`
  - `alpacaAccount` (optional)
- Tokenization history recorded on mint actions.

<!-- ## 🧱 Smart Contracts and Scripts
- `contracts/SPYPriceOracle.sol`, `PriceOracleManager.sol`, `Comet.sol`, `MockUSDC.sol` (testing)
- `scripts/setup-chainlink.js`: set up mock price feeds
- `scripts/deploy-comet.js`: Comet/Compound deployment helper (PoC) -->

## 📦 ERC‑3643 Client Configuration
These env vars are required by `src/lib/erc3643-client.ts`:
- `IDENTITY_FACTORY_ADDRESS`
- `IDENTITY_IMPLEMENTATION_AUTHORITY`
- `IDENTITY_REGISTRY`
- `TOKEN_ADDRESS`
- `TOKEN_AGENT_PRIVATE_KEY`
- `CLAIM_ISSUER_CONTRACT`
- `CLAIM_ISSUER_SIGNING_KEY`
- `KYC_CLAIM_TOPIC`
- `ETHEREUM_RPC_URL`

Notes:
- `KYC_CLAIM_TOPIC` must exist in ClaimTopicsRegistry; `CLAIM_ISSUER_CONTRACT` must be in TrustedIssuersRegistry used by the token’s `IdentityRegistry`.
- Identity should be registered in the registry before minting or verification checks will fail.

## 🔐 Notes
- Identity registration must happen before claims are validated by T‑REX token/compliance.
- `KYC_CLAIM_TOPIC` and `CLAIM_ISSUER_CONTRACT` must match the registries used by the token.
- Use test keys/contracts only in this PoC.

## ⚠️ Disclaimer
This is a PoC for demonstration only. Do not use in production. Keys, contracts, and registries are for testing.

