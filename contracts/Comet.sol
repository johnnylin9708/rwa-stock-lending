// contracts/Comet.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SPYPriceOracle.sol";

/**
 * @title Comet
 * @dev Compound III 風格的借貸合約，支援 TSPY 作為抵押品借 USDC
 */
contract Comet is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // 抵押品資產結構
    struct CollateralAsset {
        address asset;                    // 抵押品 token 地址
        address priceFeed;               // 價格預言機地址
        uint256 scale;                   // token decimals
        uint256 borrowCollateralFactor; // 借貸抵押因子 (75%)
        uint256 liquidateCollateralFactor; // 清算抵押因子 (85%)
        uint256 liquidationFactor;      // 清算因子 (90%)
        uint256 supplyCap;              // 供應上限
        bool isListed;                  // 是否已上線
    }
    
    // 用戶帳戶結構
    struct Account {
        uint256 collateral;        // 抵押品數量
        uint256 borrowed;          // 借貸數量
        uint256 borrowIndex;       // 借貸指數
    }
    
    // 合約狀態
    IERC20 public baseToken;           // USDC
    uint256 public baseTokenScale;     // USDC decimals (6)
    uint256 public baseBorrowMin;       // 最小借貸金額
    uint256 public targetReserves;     // 目標儲備
    uint256 public totalReserves;      // 總儲備
    uint256 public totalBorrows;       // 總借貸
    uint256 public borrowIndex;        // 借貸指數
    uint256 public accrualBlockNumber; // 計息區塊號
    
    // 利率模型參數
    uint256 public kink;                    // 拐點 (80%)
    uint256 public perYearInterestRateBase; // 基礎利率 (2%)
    uint256 public perYearInterestRateSlopeLow;  // 低斜率 (10%)
    uint256 public perYearInterestRateSlopeHigh; // 高斜率 (300%)
    
    // 抵押品資產
    mapping(address => CollateralAsset) public collateralAssets;
    address[] public allCollateralAssets;
    
    // 用戶帳戶
    mapping(address => mapping(address => Account)) public accounts;
    
    // 事件
    event CollateralSupplied(address indexed user, address indexed asset, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed asset, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(address indexed liquidator, address indexed borrower, address indexed asset, uint256 amount);
    event CollateralAssetListed(address indexed asset, address indexed priceFeed);
    
    constructor(
        address _baseToken,
        uint256 _baseTokenScale,
        uint256 _baseBorrowMin,
        uint256 _targetReserves,
        uint256 _kink,
        uint256 _perYearInterestRateBase,
        uint256 _perYearInterestRateSlopeLow,
        uint256 _perYearInterestRateSlopeHigh
    ) Ownable(msg.sender) {
        baseToken = IERC20(_baseToken);
        baseTokenScale = _baseTokenScale;
        baseBorrowMin = _baseBorrowMin;
        targetReserves = _targetReserves;
        kink = _kink;
        perYearInterestRateBase = _perYearInterestRateBase;
        perYearInterestRateSlopeLow = _perYearInterestRateSlopeLow;
        perYearInterestRateSlopeHigh = _perYearInterestRateSlopeHigh;
        borrowIndex = 1e18;
        accrualBlockNumber = block.number;
    }
    
    /**
     * @dev 上線抵押品資產
     */
    function listCollateralAsset(
        address asset,
        address priceFeed,
        uint256 scale,
        uint256 borrowCollateralFactor,
        uint256 liquidateCollateralFactor,
        uint256 liquidationFactor,
        uint256 supplyCap
    ) external onlyOwner {
        require(!collateralAssets[asset].isListed, "Asset already listed");
        require(borrowCollateralFactor <= 1e18, "Invalid borrow collateral factor");
        require(liquidateCollateralFactor <= 1e18, "Invalid liquidate collateral factor");
        
        collateralAssets[asset] = CollateralAsset({
            asset: asset,
            priceFeed: priceFeed,
            scale: scale,
            borrowCollateralFactor: borrowCollateralFactor,
            liquidateCollateralFactor: liquidateCollateralFactor,
            liquidationFactor: liquidationFactor,
            supplyCap: supplyCap,
            isListed: true
        });
        
        allCollateralAssets.push(asset);
        emit CollateralAssetListed(asset, priceFeed);
    }
    
    /**
     * @dev 存入抵押品
     */
    function supply(address asset, uint256 amount) external nonReentrant {
        CollateralAsset storage collateral = collateralAssets[asset];
        require(collateral.isListed, "Asset not listed");
        
        // 轉移抵押品
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        
        // 更新帳戶
        accounts[msg.sender][asset].collateral += amount;
        
        emit CollateralSupplied(msg.sender, asset, amount);
    }
    
    /**
     * @dev 提取抵押品
     */
    function withdraw(address asset, uint256 amount) external nonReentrant {
        CollateralAsset storage collateral = collateralAssets[asset];
        require(collateral.isListed, "Asset not listed");
        
        Account storage account = accounts[msg.sender][asset];
        require(account.collateral >= amount, "Insufficient collateral");
        
        // 檢查健康因子
        account.collateral -= amount;
        require(getAccountHealth(msg.sender) >= 1e18, "Withdrawal would make account unhealthy");
        
        // 轉移抵押品
        IERC20(asset).safeTransfer(msg.sender, amount);
        
        emit CollateralWithdrawn(msg.sender, asset, amount);
    }
    
    /**
     * @dev 借貸基礎資產
     */
    function borrow(uint256 amount) external nonReentrant {
        require(amount >= baseBorrowMin, "Amount below minimum");
        
        // 計息
        accrueInterest();
        
        // 檢查借貸能力
        uint256 borrowingPower = getBorrowingPower(msg.sender);
        uint256 currentBorrowValue = getTotalBorrowValue(msg.sender);
        
        require(borrowingPower >= currentBorrowValue + amount, "Insufficient collateral");
        
        // 更新帳戶
        Account storage account = accounts[msg.sender][address(baseToken)];
        if (account.borrowed == 0) {
            account.borrowIndex = borrowIndex;
        } else {
            // 複利計算
            uint256 interest = (account.borrowed * borrowIndex) / account.borrowIndex - account.borrowed;
            account.borrowed += interest;
            account.borrowIndex = borrowIndex;
        }
        
        account.borrowed += amount;
        totalBorrows += amount;
        
        // 轉移基礎資產
        baseToken.safeTransfer(msg.sender, amount);
        
        emit Borrowed(msg.sender, amount);
    }
    
    /**
     * @dev 還款
     */
    function repay(uint256 amount) external nonReentrant {
        // 計息
        accrueInterest();
        
        Account storage account = accounts[msg.sender][address(baseToken)];
        require(account.borrowed > 0, "No debt to repay");
        
        // 計算實際債務
        uint256 interest = (account.borrowed * borrowIndex) / account.borrowIndex - account.borrowed;
        uint256 totalDebt = account.borrowed + interest;
        
        uint256 repayAmount = amount > totalDebt ? totalDebt : amount;
        
        // 轉移基礎資產
        baseToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        
        // 更新帳戶
        account.borrowed = totalDebt - repayAmount;
        account.borrowIndex = borrowIndex;
        totalBorrows -= repayAmount;
        
        emit Repaid(msg.sender, repayAmount);
    }
    
    /**
     * @dev 清算
     */
    function liquidate(
        address borrower,
        address asset,
        uint256 repayAmount
    ) external nonReentrant {
        require(getAccountHealth(borrower) < 1e18, "Account is healthy");
        
        CollateralAsset storage collateral = collateralAssets[asset];
        require(collateral.isListed, "Asset not listed");
        
        accrueInterest();
        
        Account storage account = accounts[borrower][asset];
        uint256 totalDebt = (account.borrowed * borrowIndex) / account.borrowIndex;
        
        // 計算可清算的抵押品
        uint256 assetPrice = SPYPriceOracle(collateral.priceFeed).getPriceWithDecimals();
        uint256 collateralToSeize = (repayAmount * 1e18 * (1e18 + collateral.liquidationFactor)) / (assetPrice * 1e18);
        
        require(account.collateral >= collateralToSeize, "Insufficient collateral");
        
        // 轉移還款
        baseToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        
        // 更新借款人帳戶
        account.borrowed -= repayAmount;
        account.collateral -= collateralToSeize;
        totalBorrows -= repayAmount;
        
        // 轉移清算的抵押品
        IERC20(asset).safeTransfer(msg.sender, collateralToSeize);
        
        emit Liquidated(msg.sender, borrower, asset, repayAmount);
    }
    
    /**
     * @dev 計息
     */
    function accrueInterest() public {
        uint256 currentBlock = block.number;
        if (accrualBlockNumber == currentBlock) {
            return;
        }
        
        uint256 blockDelta = currentBlock - accrualBlockNumber;
        uint256 borrowRate = getBorrowRate();
        
        // 計算利息
        uint256 interestAccumulated = (totalBorrows * borrowRate * blockDelta) / 1e18;
        uint256 reserveIncrease = (interestAccumulated * 1e17) / 1e18; // 10% 儲備
        
        // 更新狀態
        totalBorrows += interestAccumulated;
        totalReserves += reserveIncrease;
        borrowIndex += (borrowIndex * borrowRate * blockDelta) / 1e18;
        accrualBlockNumber = currentBlock;
    }
    
    /**
     * @dev 獲取借貸利率
     */
    function getBorrowRate() public view returns (uint256) {
        uint256 utilization = totalBorrows == 0 ? 0 : (totalBorrows * 1e18) / baseToken.balanceOf(address(this));
        
        if (utilization <= kink) {
            return perYearInterestRateBase + (utilization * perYearInterestRateSlopeLow) / 1e18;
        } else {
            uint256 normalRate = perYearInterestRateBase + (kink * perYearInterestRateSlopeLow) / 1e18;
            uint256 excessUtilization = utilization - kink;
            return normalRate + (excessUtilization * perYearInterestRateSlopeHigh) / 1e18;
        }
    }
    
    /**
     * @dev 獲取總抵押品價值
     */
    function getTotalCollateralValue(address user) public view returns (uint256) {
        uint256 totalValue = 0;
        
        for (uint256 i = 0; i < allCollateralAssets.length; i++) {
            address asset = allCollateralAssets[i];
            CollateralAsset storage collateral = collateralAssets[asset];
            Account storage account = accounts[user][asset];
            
            if (account.collateral > 0) {
                uint256 price = SPYPriceOracle(collateral.priceFeed).getPriceWithDecimals();
                uint256 value = (account.collateral * price) / 1e18;
                totalValue += value;
            }
        }
        
        return totalValue;
    }
    
    /**
     * @dev 獲取借貸能力
     */
    function getBorrowingPower(address user) public view returns (uint256) {
        uint256 totalPower = 0;
        
        for (uint256 i = 0; i < allCollateralAssets.length; i++) {
            address asset = allCollateralAssets[i];
            CollateralAsset storage collateral = collateralAssets[asset];
            Account storage account = accounts[user][asset];
            
            if (account.collateral > 0) {
                uint256 price = SPYPriceOracle(collateral.priceFeed).getPriceWithDecimals();
                uint256 value = (account.collateral * price) / 1e18;
                uint256 power = (value * collateral.borrowCollateralFactor) / 1e18;
                totalPower += power;
            }
        }
        
        return totalPower;
    }
    
    /**
     * @dev 獲取總借貸價值
     */
    function getTotalBorrowValue(address user) public view returns (uint256) {
        Account storage account = accounts[user][address(baseToken)];
        if (account.borrowed == 0) {
            return 0;
        }
        
        uint256 debt = (account.borrowed * borrowIndex) / account.borrowIndex;
        return debt;
    }
    
    /**
     * @dev 獲取帳戶健康因子
     */
    function getAccountHealth(address user) public view returns (uint256) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = getTotalBorrowValue(user);
        
        if (totalBorrowValue == 0) {
            return type(uint256).max; // 無借貸 = 健康
        }
        
        for (uint256 i = 0; i < allCollateralAssets.length; i++) {
            address asset = allCollateralAssets[i];
            CollateralAsset storage collateral = collateralAssets[asset];
            Account storage account = accounts[user][asset];
            
            if (account.collateral > 0) {
                uint256 price = SPYPriceOracle(collateral.priceFeed).getPriceWithDecimals();
                uint256 value = (account.collateral * price) / 1e18;
                uint256 adjustedValue = (value * collateral.liquidateCollateralFactor) / 1e18;
                totalCollateralValue += adjustedValue;
            }
        }
        
        return (totalCollateralValue * 1e18) / totalBorrowValue;
    }
    
    /**
     * @dev 檢查是否可借貸
     */
    function isBorrowCollateralized(address user) external view returns (bool) {
        return getAccountHealth(user) >= 1e18;
    }
    
    /**
     * @dev 檢查是否可清算
     */
    function isLiquidatable(address user) external view returns (bool) {
        return getAccountHealth(user) < 1e18;
    }
    
    /**
     * @dev 獲取抵押品餘額
     */
    function collateralBalanceOf(address user, address asset) external view returns (uint256) {
        return accounts[user][asset].collateral;
    }
    
    /**
     * @dev 獲取借貸餘額
     */
    function borrowBalanceOf(address user) external view returns (uint256) {
        return getTotalBorrowValue(user);
    }
    
    /**
     * @dev 獲取基礎資產餘額
     */
    function balanceOf(address user) external view returns (uint256) {
        return baseToken.balanceOf(user);
    }
}
