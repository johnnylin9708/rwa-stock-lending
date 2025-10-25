// Contract addresses - Replace with your deployed contract addresses
export const lendingContractAddress = process.env.NEXT_PUBLIC_LENDING_POOL_ADDRESS || "0x0000000000000000000000000000000000000000";
export const interestRateModelAddress = process.env.NEXT_PUBLIC_INTEREST_RATE_MODEL_ADDRESS || "0x0000000000000000000000000000000000000000";

// Tokenized Asset Addresses (examples)
export const tokenizedAssets = {
    TAAPL: process.env.NEXT_PUBLIC_TAAPL_ADDRESS || "0x0000000000000000000000000000000000000000",
    TGOOGL: process.env.NEXT_PUBLIC_TGOOGL_ADDRESS || "0x0000000000000000000000000000000000000000",
    TTSLA: process.env.NEXT_PUBLIC_TTSLA_ADDRESS || "0x0000000000000000000000000000000000000000",
};

// LendingPool Contract ABI
export const lendingContractABI = [
    "function listMarket(string assetSymbol, address tokenAddress, uint256 collateralFactor, uint256 liquidationThreshold, uint256 liquidationPenalty) external",
    "function depositCollateral(string assetSymbol, uint256 amount) external",
    "function withdrawCollateral(string assetSymbol, uint256 amount) external",
    "function borrow(string assetSymbol, uint256 amount) external",
    "function repay(string assetSymbol, uint256 amount) external",
    "function liquidate(address borrower, string assetSymbol, uint256 repayAmount) external",
    "function accrueInterest(string assetSymbol) public",
    "function getTotalCollateralValue(address user) public view returns (uint256)",
    "function getBorrowingPower(address user) public view returns (uint256)",
    "function getTotalBorrowValue(address user) public view returns (uint256)",
    "function getAccountHealth(address user) public view returns (uint256)",
    "function getBorrowAPY(string assetSymbol) external view returns (uint256)",
    "function getSupplyAPY(string assetSymbol) external view returns (uint256)",
    "function markets(string) public view returns (bool isListed, uint256 collateralFactorMantissa, uint256 liquidationThreshold, uint256 liquidationPenalty, uint256 totalBorrows, uint256 totalSupply, uint256 totalReserves, uint256 borrowIndex, uint256 supplyIndex, uint256 accrualBlockNumber, address tokenContract)",
    "function accounts(address, string) public view returns (uint256 collateral, uint256 borrowed, uint256 borrowIndex)",
    "event MarketListed(string assetSymbol, address tokenAddress)",
    "event CollateralDeposited(address indexed user, string assetSymbol, uint256 amount)",
    "event CollateralWithdrawn(address indexed user, string assetSymbol, uint256 amount)",
    "event Borrowed(address indexed user, string assetSymbol, uint256 amount)",
    "event Repaid(address indexed user, string assetSymbol, uint256 amount)",
    "event Liquidated(address indexed liquidator, address indexed borrower, string assetSymbol, uint256 amount)"
];

// TokenizedAsset Contract ABI
export const tokenizedAssetABI = [
    "function name() public view returns (string)",
    "function symbol() public view returns (string)",
    "function decimals() public view returns (uint8)",
    "function totalSupply() public view returns (uint256)",
    "function balanceOf(address account) public view returns (uint256)",
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function allowance(address owner, address spender) public view returns (uint256)",
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) public returns (bool)",
    "function assetSymbol() public view returns (string)",
    "function assetType() public view returns (string)",
    "function currentPrice() public view returns (uint256)",
    "function getPrice() external view returns (uint256)",
    "function updatePrice(uint256 newPrice) external",
    "function mint(address to, uint256 amount) external",
    "function burn(address from, uint256 amount) external",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
    "event PriceUpdated(uint256 newPrice, uint256 timestamp)"
];

// InterestRateModel Contract ABI
export const interestRateModelABI = [
    "function BASE_RATE() public view returns (uint256)",
    "function MULTIPLIER() public view returns (uint256)",
    "function JUMP_MULTIPLIER() public view returns (uint256)",
    "function KINK() public view returns (uint256)",
    "function BLOCKS_PER_YEAR() public view returns (uint256)",
    "function getUtilizationRate(uint256 cash, uint256 borrows, uint256 reserves) public pure returns (uint256)",
    "function getBorrowRate(uint256 cash, uint256 borrows, uint256 reserves) public pure returns (uint256)",
    "function getSupplyRate(uint256 cash, uint256 borrows, uint256 reserves, uint256 reserveFactorMantissa) public pure returns (uint256)",
    "function getAPY(uint256 ratePerBlock) public pure returns (uint256)"
];
