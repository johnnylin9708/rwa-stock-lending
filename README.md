# RWA Stock Lending PoC

A Next.js proof‑of‑concept for tokenized stock lending that showcases:
- ERC‑3643 identity and claims (OnchainID + T‑REX)
- Self Protocol identity verification flow (QR, universal link)
- Alpaca broker simulation and price data
- Lending integration and price oracles with Compound/Chainlink

This PoC demonstrates end‑to‑end identity‑gated tokenization and lending.

## Smart Contract Addresses
### ERC-3643

【Main addresses】
Token (ERC3643):               ``0xBEae6Fa62362aB593B498692FD09002a9eEd52dc``
Identity Registry:             ``0xF2a0227754b62AD3719780F79BA034c871c873f0``
Identity Registry Storage:     ``0x2Cc255B7E2db100Df1581485C5c73b62b7191C42``
Claim Topics Registry:         ``0xC905Bf306CE609A0750981F6485166874012b92e``
Trusted Issuers Registry:      ``0x0A3008351D0149EE233d33AF187A548073dCA659``
Default Compliance:            ``0x88862e3b8Afba982319C8D2Be4d497b9110c5B1e``
Token OnchainID:               ``0x984f6F3b1Dba353dc952C7A3a8E340B48A89C947``
Claim Issuer Contract:         ``0x6cb335F1Bb7CEA9FD0e1cfC44C816A444717166b``

【Implemented addresses】
Token Implementation:                      ``0xB30C9fFe7EfFE3969B2D0D335047A27792f02AD9``
Identity Registry Implementation:          ``0xb3023fAcd46375AfEA1b137881acea12a8caBBdA``
Identity Registry Storage Implementation:  ``0x8dD746a266b4aC00b9DF28C3B8c210bCFC8e596a``
Claim Topics Registry Implementation:      ``0x02D5025eD6BB64Ca51Eb59d7f9faED34ECEBD82D``
Trusted Issuers Registry Implementation:   ``0x8F0f40163E0BbFC90a26921AE8B72250F1d52d32``
Modular Compliance Implementation:         ``0x1Af0bEa9eB56603Ae8347ab684ED10B6B97C991B``
OnchainID Identity Implementation:         ``0x1a96Bee51bc2e541A89D385b8d0C687c4b249fdb``

【Authority addresses】
TREX Implementation Authority:      ``0xaDbb8f774401C8C9CffFf193510885Bc07C2634B``
Identity Implementation Authority:  ``0x187eDAc6D0C7E9f7162FD469F5dDAD000910c9D4``
TREX Factory:                       ``0x732bee459D9ddebeEB980446E8AdbBb34Dc8F849``
Identity Factory:                   ``0x8f4381C78f9C42Ce6bcf176271200D05109c9D48``

### Compound

【Core addresses】

Comet: ``0xfa80b411995AaBb4cdA7BcE5cEF26b5d5Ac12353``

Comet:implementation: ``0xBaa1616ae8ef6Dcfa5aAb2f0db8D337478AE4Dd0``

CometExt: ``0xBaa1616ae8ef6Dcfa5aAb2f0db8D337478AE4Dd0``

【Token addreses】

USDt:``0x89e8a0f004CC32750b49D0dAbA5a88E88FA090E4``

TSTOCK: ``0xBEae6Fa62362aB593B498692FD09002a9eEd52dc``

【Price Feed Oracle】

USDt PriceFeed: ``0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E``

TSTOCK PriceFeed: ``0x4b531A318B0e44B549F3b2f824721b3D0d51930A``

### Self

Proof of Human: ``0xdeaab4cea71ff43d93f3cbc4c466f94fb86f002b``


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
.env.local
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

---

## 🔗 Additional Resources

### Contracts & SDKs Repositories
- **[Self SDK](https://github.com/johnnylin9708/workshop)** - Workshop repository for Self Protocol SDK integration. Demonstrates how to implement QR code generation, universal links, and claim verification flows using the Self mobile app for identity verification.

- **[ERC-3643](https://github.com/RonShih/Tokenized-Stock)** - Reference implementation for tokenized stock contracts using the ERC-3643 (T-REX) standard. Includes OnchainID identity management, IdentityRegistry, and compliance features for regulated token transfers.

- **[Compound](https://github.com/herochen11/comet_rwa_hackathon/)** - Compound Comet (Compound III) integration for RWA (Real World Assets) lending. Shows how to configure Comet contracts to accept tokenized assets as collateral and implement lending/borrowing functionality.
