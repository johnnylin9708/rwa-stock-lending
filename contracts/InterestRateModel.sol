// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title InterestRateModel
 * @dev Interest rate model similar to Compound's approach
 * Uses utilization rate to determine borrow and supply rates
 */
contract InterestRateModel {
    // Constants (scaled by 1e18)
    uint256 public constant BASE_RATE = 2e16;           // 2% base rate
    uint256 public constant MULTIPLIER = 1e17;          // 10% multiplier
    uint256 public constant JUMP_MULTIPLIER = 3e18;     // 300% jump multiplier
    uint256 public constant KINK = 8e17;                // 80% optimal utilization
    uint256 public constant BLOCKS_PER_YEAR = 2102400;  // Assuming 15 sec blocks
    
    /**
     * @dev Calculate the utilization rate
     * utilizationRate = borrows / (cash + borrows - reserves)
     */
    function getUtilizationRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) public pure returns (uint256) {
        if (borrows == 0) {
            return 0;
        }
        
        uint256 totalSupply = cash + borrows - reserves;
        if (totalSupply == 0) {
            return 0;
        }
        
        return (borrows * 1e18) / totalSupply;
    }
    
    /**
     * @dev Calculate the borrow rate per block
     * Uses a kinked interest rate model (similar to Compound)
     */
    function getBorrowRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) public pure returns (uint256) {
        uint256 utilizationRate = getUtilizationRate(cash, borrows, reserves);
        
        if (utilizationRate <= KINK) {
            // Below kink: rate = baseRate + (utilizationRate * multiplier)
            return BASE_RATE + (utilizationRate * MULTIPLIER) / 1e18;
        } else {
            // Above kink: rate = baseRate + (kink * multiplier) + (excess * jumpMultiplier)
            uint256 normalRate = BASE_RATE + (KINK * MULTIPLIER) / 1e18;
            uint256 excessUtil = utilizationRate - KINK;
            return normalRate + (excessUtil * JUMP_MULTIPLIER) / 1e18;
        }
    }
    
    /**
     * @dev Calculate the supply rate per block
     * supplyRate = borrowRate * utilizationRate * (1 - reserveFactor)
     */
    function getSupplyRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves,
        uint256 reserveFactorMantissa
    ) public pure returns (uint256) {
        uint256 oneMinusReserveFactor = 1e18 - reserveFactorMantissa;
        uint256 borrowRate = getBorrowRate(cash, borrows, reserves);
        uint256 utilizationRate = getUtilizationRate(cash, borrows, reserves);
        
        uint256 rateToPool = (borrowRate * oneMinusReserveFactor) / 1e18;
        return (utilizationRate * rateToPool) / 1e18;
    }
    
    /**
     * @dev Calculate APY from per-block rate
     */
    function getAPY(uint256 ratePerBlock) public pure returns (uint256) {
        // APY = (1 + ratePerBlock)^blocksPerYear - 1
        // Approximation: APY ≈ ratePerBlock * blocksPerYear
        return ratePerBlock * BLOCKS_PER_YEAR;
    }
}

