// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./TokenizedAsset.sol";
import "./InterestRateModel.sol";

/**
 * @title LendingPool
 * @dev Main lending protocol contract for tokenized assets
 * Allows users to deposit collateral and borrow against it
 */
contract LendingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Struct for market information
    struct Market {
        bool isListed;
        uint256 collateralFactorMantissa;  // e.g., 0.75e18 = 75%
        uint256 liquidationThreshold;      // e.g., 0.85e18 = 85%
        uint256 liquidationPenalty;        // e.g., 0.10e18 = 10%
        uint256 totalBorrows;
        uint256 totalSupply;
        uint256 totalReserves;
        uint256 borrowIndex;
        uint256 supplyIndex;
        uint256 accrualBlockNumber;
        TokenizedAsset tokenContract;
    }
    
    // Struct for user account
    struct Account {
        uint256 collateral;        // Amount deposited as collateral
        uint256 borrowed;          // Amount borrowed
        uint256 borrowIndex;       // User's borrow index for interest calculation
    }
    
    // Markets: assetSymbol => Market
    mapping(string => Market) public markets;
    string[] public allMarkets;
    
    // User accounts: user => assetSymbol => Account
    mapping(address => mapping(string => Account)) public accounts;
    
    // Stable coin for lending/borrowing (e.g., USDC)
    IERC20 public stableCoin;
    
    // Interest rate model
    InterestRateModel public interestRateModel;
    
    // Reserve factor (percentage of interest going to reserves)
    uint256 public constant RESERVE_FACTOR = 1e17; // 10%
    
    // Close factor (max percentage that can be liquidated at once)
    uint256 public constant CLOSE_FACTOR = 5e17; // 50%
    
    // Events
    event MarketListed(string assetSymbol, address tokenAddress);
    event CollateralDeposited(address indexed user, string assetSymbol, uint256 amount);
    event CollateralWithdrawn(address indexed user, string assetSymbol, uint256 amount);
    event Borrowed(address indexed user, string assetSymbol, uint256 amount);
    event Repaid(address indexed user, string assetSymbol, uint256 amount);
    event Liquidated(address indexed liquidator, address indexed borrower, string assetSymbol, uint256 amount);
    
    constructor(address _stableCoin, address _interestRateModel) Ownable(msg.sender) {
        stableCoin = IERC20(_stableCoin);
        interestRateModel = InterestRateModel(_interestRateModel);
    }
    
    /**
     * @dev List a new market for a tokenized asset
     */
    function listMarket(
        string memory assetSymbol,
        address tokenAddress,
        uint256 collateralFactor,
        uint256 liquidationThreshold,
        uint256 liquidationPenalty
    ) external onlyOwner {
        require(!markets[assetSymbol].isListed, "Market already listed");
        require(collateralFactor <= 1e18, "Invalid collateral factor");
        
        markets[assetSymbol] = Market({
            isListed: true,
            collateralFactorMantissa: collateralFactor,
            liquidationThreshold: liquidationThreshold,
            liquidationPenalty: liquidationPenalty,
            totalBorrows: 0,
            totalSupply: 0,
            totalReserves: 0,
            borrowIndex: 1e18,
            supplyIndex: 1e18,
            accrualBlockNumber: block.number,
            tokenContract: TokenizedAsset(tokenAddress)
        });
        
        allMarkets.push(assetSymbol);
        emit MarketListed(assetSymbol, tokenAddress);
    }
    
    /**
     * @dev Deposit tokenized assets as collateral
     */
    function depositCollateral(string memory assetSymbol, uint256 amount) external nonReentrant {
        Market storage market = markets[assetSymbol];
        require(market.isListed, "Market not listed");
        
        // Transfer tokens from user
        market.tokenContract.transferFrom(msg.sender, address(this), amount);
        
        // Update account
        accounts[msg.sender][assetSymbol].collateral += amount;
        market.totalSupply += amount;
        
        emit CollateralDeposited(msg.sender, assetSymbol, amount);
    }
    
    /**
     * @dev Withdraw collateral (if health factor allows)
     */
    function withdrawCollateral(string memory assetSymbol, uint256 amount) external nonReentrant {
        Market storage market = markets[assetSymbol];
        require(market.isListed, "Market not listed");
        
        Account storage account = accounts[msg.sender][assetSymbol];
        require(account.collateral >= amount, "Insufficient collateral");
        
        // Check if withdrawal would make account unhealthy
        account.collateral -= amount;
        require(getAccountHealth(msg.sender) >= 1e18, "Withdrawal would make account unhealthy");
        
        market.totalSupply -= amount;
        
        // Transfer tokens to user
        market.tokenContract.transfer(msg.sender, amount);
        
        emit CollateralWithdrawn(msg.sender, assetSymbol, amount);
    }
    
    /**
     * @dev Borrow stablecoins against collateral
     */
    function borrow(string memory assetSymbol, uint256 amount) external nonReentrant {
        Market storage market = markets[assetSymbol];
        require(market.isListed, "Market not listed");
        
        // Accrue interest
        accrueInterest(assetSymbol);
        
        // Calculate borrowing power
        uint256 borrowingPower = getBorrowingPower(msg.sender);
        uint256 currentBorrowValue = getTotalBorrowValue(msg.sender);
        
        require(borrowingPower >= currentBorrowValue + amount, "Insufficient collateral");
        
        // Update account
        Account storage account = accounts[msg.sender][assetSymbol];
        if (account.borrowed == 0) {
            account.borrowIndex = market.borrowIndex;
        } else {
            // Compound existing interest
            uint256 interest = (account.borrowed * market.borrowIndex) / account.borrowIndex - account.borrowed;
            account.borrowed += interest;
            account.borrowIndex = market.borrowIndex;
        }
        
        account.borrowed += amount;
        market.totalBorrows += amount;
        
        // Transfer stablecoins to user
        stableCoin.safeTransfer(msg.sender, amount);
        
        emit Borrowed(msg.sender, assetSymbol, amount);
    }
    
    /**
     * @dev Repay borrowed stablecoins
     */
    function repay(string memory assetSymbol, uint256 amount) external nonReentrant {
        Market storage market = markets[assetSymbol];
        require(market.isListed, "Market not listed");
        
        // Accrue interest
        accrueInterest(assetSymbol);
        
        Account storage account = accounts[msg.sender][assetSymbol];
        require(account.borrowed > 0, "No debt to repay");
        
        // Calculate actual debt with interest
        uint256 interest = (account.borrowed * market.borrowIndex) / account.borrowIndex - account.borrowed;
        uint256 totalDebt = account.borrowed + interest;
        
        uint256 repayAmount = amount > totalDebt ? totalDebt : amount;
        
        // Transfer stablecoins from user
        stableCoin.safeTransferFrom(msg.sender, address(this), repayAmount);
        
        // Update account
        account.borrowed = totalDebt - repayAmount;
        account.borrowIndex = market.borrowIndex;
        market.totalBorrows -= repayAmount;
        
        emit Repaid(msg.sender, assetSymbol, repayAmount);
    }
    
    /**
     * @dev Liquidate an undercollateralized position
     */
    function liquidate(
        address borrower,
        string memory assetSymbol,
        uint256 repayAmount
    ) external nonReentrant {
        require(getAccountHealth(borrower) < 1e18, "Account is healthy");
        
        Market storage market = markets[assetSymbol];
        require(market.isListed, "Market not listed");
        
        accrueInterest(assetSymbol);
        
        Account storage account = accounts[borrower][assetSymbol];
        uint256 totalDebt = (account.borrowed * market.borrowIndex) / account.borrowIndex;
        
        // Can only liquidate up to close factor
        uint256 maxRepay = (totalDebt * CLOSE_FACTOR) / 1e18;
        require(repayAmount <= maxRepay, "Exceeds close factor");
        
        // Calculate collateral to seize (with penalty)
        uint256 assetPrice = market.tokenContract.getPrice();
        uint256 collateralToSeize = (repayAmount * 1e18 * (1e18 + market.liquidationPenalty)) / (assetPrice * 1e18);
        
        require(account.collateral >= collateralToSeize, "Insufficient collateral");
        
        // Transfer repayment from liquidator
        stableCoin.safeTransferFrom(msg.sender, address(this), repayAmount);
        
        // Update borrower account
        account.borrowed -= repayAmount;
        account.collateral -= collateralToSeize;
        market.totalBorrows -= repayAmount;
        
        // Transfer seized collateral to liquidator
        market.tokenContract.transfer(msg.sender, collateralToSeize);
        
        emit Liquidated(msg.sender, borrower, assetSymbol, repayAmount);
    }
    
    /**
     * @dev Accrue interest for a market
     */
    function accrueInterest(string memory assetSymbol) public {
        Market storage market = markets[assetSymbol];
        
        uint256 currentBlock = block.number;
        if (market.accrualBlockNumber == currentBlock) {
            return;
        }
        
        uint256 blockDelta = currentBlock - market.accrualBlockNumber;
        uint256 borrowRate = interestRateModel.getBorrowRate(
            stableCoin.balanceOf(address(this)),
            market.totalBorrows,
            market.totalReserves
        );
        
        // Calculate interest
        uint256 interestAccumulated = (market.totalBorrows * borrowRate * blockDelta) / 1e18;
        uint256 reserveIncrease = (interestAccumulated * RESERVE_FACTOR) / 1e18;
        
        // Update market
        market.totalBorrows += interestAccumulated;
        market.totalReserves += reserveIncrease;
        market.borrowIndex += (market.borrowIndex * borrowRate * blockDelta) / 1e18;
        market.accrualBlockNumber = currentBlock;
    }
    
    /**
     * @dev Get total collateral value in USD for a user
     */
    function getTotalCollateralValue(address user) public view returns (uint256) {
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < allMarkets.length; i++) {
            string memory assetSymbol = allMarkets[i];
            Market storage market = markets[assetSymbol];
            Account storage account = accounts[user][assetSymbol];
            
            if (account.collateral > 0) {
                uint256 price = market.tokenContract.getPrice();
                uint256 value = (account.collateral * price) / 1e18;
                totalValue += value;
            }
        }
        
        return totalValue;
    }
    
    /**
     * @dev Get borrowing power (collateral value * collateral factor)
     */
    function getBorrowingPower(address user) public view returns (uint256) {
        uint256 totalPower = 0;
        
        for (uint256 i = 0; i < allMarkets.length; i++) {
            string memory assetSymbol = allMarkets[i];
            Market storage market = markets[assetSymbol];
            Account storage account = accounts[user][assetSymbol];
            
            if (account.collateral > 0) {
                uint256 price = market.tokenContract.getPrice();
                uint256 value = (account.collateral * price) / 1e18;
                uint256 power = (value * market.collateralFactorMantissa) / 1e18;
                totalPower += power;
            }
        }
        
        return totalPower;
    }
    
    /**
     * @dev Get total borrowed value for a user
     */
    function getTotalBorrowValue(address user) public view returns (uint256) {
        uint256 totalBorrow = 0;
        
        for (uint256 i = 0; i < allMarkets.length; i++) {
            string memory assetSymbol = allMarkets[i];
            Market storage market = markets[assetSymbol];
            Account storage account = accounts[user][assetSymbol];
            
            if (account.borrowed > 0) {
                uint256 debt = (account.borrowed * market.borrowIndex) / account.borrowIndex;
                totalBorrow += debt;
            }
        }
        
        return totalBorrow;
    }
    
    /**
     * @dev Get account health factor (must be >= 1.0 to be healthy)
     * healthFactor = (collateralValue * liquidationThreshold) / borrowValue
     */
    function getAccountHealth(address user) public view returns (uint256) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = getTotalBorrowValue(user);
        
        if (totalBorrowValue == 0) {
            return type(uint256).max; // No borrows = healthy
        }
        
        for (uint256 i = 0; i < allMarkets.length; i++) {
            string memory assetSymbol = allMarkets[i];
            Market storage market = markets[assetSymbol];
            Account storage account = accounts[user][assetSymbol];
            
            if (account.collateral > 0) {
                uint256 price = market.tokenContract.getPrice();
                uint256 value = (account.collateral * price) / 1e18;
                uint256 adjustedValue = (value * market.liquidationThreshold) / 1e18;
                totalCollateralValue += adjustedValue;
            }
        }
        
        return (totalCollateralValue * 1e18) / totalBorrowValue;
    }
    
    /**
     * @dev Get current borrow APY for a market
     */
    function getBorrowAPY(string memory assetSymbol) external view returns (uint256) {
        Market storage market = markets[assetSymbol];
        uint256 borrowRate = interestRateModel.getBorrowRate(
            stableCoin.balanceOf(address(this)),
            market.totalBorrows,
            market.totalReserves
        );
        return interestRateModel.getAPY(borrowRate);
    }
    
    /**
     * @dev Get current supply APY for a market
     */
    function getSupplyAPY(string memory assetSymbol) external view returns (uint256) {
        Market storage market = markets[assetSymbol];
        uint256 supplyRate = interestRateModel.getSupplyRate(
            stableCoin.balanceOf(address(this)),
            market.totalBorrows,
            market.totalReserves,
            RESERVE_FACTOR
        );
        return interestRateModel.getAPY(supplyRate);
    }
}

