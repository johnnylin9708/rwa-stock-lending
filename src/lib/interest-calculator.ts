/**
 * Interest Rate Calculator (based on Compound's model)
 */

import { INTEREST_RATE_PARAMS } from "./constants";

const { BASE_RATE, MULTIPLIER, JUMP_MULTIPLIER, OPTIMAL_UTILIZATION } = INTEREST_RATE_PARAMS;

/**
 * Calculate utilization rate
 * utilizationRate = borrows / (cash + borrows - reserves)
 */
export function calculateUtilizationRate(
    cash: number,
    borrows: number,
    reserves: number
): number {
    if (borrows === 0) {
        return 0;
    }
    
    const totalSupply = cash + borrows - reserves;
    if (totalSupply === 0) {
        return 0;
    }
    
    return borrows / totalSupply;
}

/**
 * Calculate borrow APY using kinked interest rate model
 */
export function calculateBorrowAPY(
    cash: number,
    borrows: number,
    reserves: number
): number {
    const utilizationRate = calculateUtilizationRate(cash, borrows, reserves);
    
    if (utilizationRate <= OPTIMAL_UTILIZATION) {
        // Below optimal: rate = baseRate + (utilizationRate * multiplier)
        return BASE_RATE + (utilizationRate * MULTIPLIER);
    } else {
        // Above optimal: rate = baseRate + (optimal * multiplier) + (excess * jumpMultiplier)
        const normalRate = BASE_RATE + (OPTIMAL_UTILIZATION * MULTIPLIER);
        const excessUtil = utilizationRate - OPTIMAL_UTILIZATION;
        return normalRate + (excessUtil * JUMP_MULTIPLIER);
    }
}

/**
 * Calculate supply APY
 * supplyAPY = borrowAPY * utilizationRate * (1 - reserveFactor)
 */
export function calculateSupplyAPY(
    cash: number,
    borrows: number,
    reserves: number,
    reserveFactor: number = 0.1
): number {
    const borrowAPY = calculateBorrowAPY(cash, borrows, reserves);
    const utilizationRate = calculateUtilizationRate(cash, borrows, reserves);
    const oneMinusReserveFactor = 1 - reserveFactor;
    
    return borrowAPY * utilizationRate * oneMinusReserveFactor;
}

/**
 * Calculate interest accrued over time
 */
export function calculateInterest(
    principal: number,
    apy: number,
    days: number
): number {
    // Simple interest: interest = principal * apy * (days / 365)
    return principal * apy * (days / 365);
}

/**
 * Calculate compound interest
 */
export function calculateCompoundInterest(
    principal: number,
    apy: number,
    days: number,
    compoundingPeriodsPerYear: number = 365
): number {
    // A = P(1 + r/n)^(nt)
    const r = apy;
    const n = compoundingPeriodsPerYear;
    const t = days / 365;
    
    const amount = principal * Math.pow(1 + r / n, n * t);
    return amount - principal;
}

/**
 * Calculate health factor
 * healthFactor = (collateralValue * liquidationThreshold) / borrowValue
 */
export function calculateHealthFactor(
    collateralValue: number,
    borrowValue: number,
    liquidationThreshold: number
): number {
    if (borrowValue === 0) {
        return Infinity; // No borrows = perfect health
    }
    
    return (collateralValue * liquidationThreshold) / borrowValue;
}

/**
 * Calculate borrowing power
 * borrowingPower = collateralValue * collateralFactor
 */
export function calculateBorrowingPower(
    collateralValue: number,
    collateralFactor: number
): number {
    return collateralValue * collateralFactor;
}

/**
 * Calculate liquidation price for an asset
 * The price at which the position becomes liquidatable
 */
export function calculateLiquidationPrice(
    collateralAmount: number,
    borrowAmount: number,
    liquidationThreshold: number
): number {
    if (collateralAmount === 0) {
        return 0;
    }
    
    // liquidationPrice = borrowAmount / (collateralAmount * liquidationThreshold)
    return borrowAmount / (collateralAmount * liquidationThreshold);
}

/**
 * Calculate maximum borrow amount based on collateral
 */
export function calculateMaxBorrow(
    collateralValue: number,
    collateralFactor: number,
    currentBorrowValue: number = 0
): number {
    const maxBorrow = collateralValue * collateralFactor;
    return Math.max(0, maxBorrow - currentBorrowValue);
}

/**
 * Calculate liquidation penalty
 */
export function calculateLiquidationPenalty(
    repayAmount: number,
    penaltyRate: number
): number {
    return repayAmount * penaltyRate;
}

/**
 * Get risk level based on health factor
 */
export function getRiskLevel(healthFactor: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (healthFactor >= 1.5) return "LOW";
    if (healthFactor >= 1.2) return "MEDIUM";
    if (healthFactor >= 1.0) return "HIGH";
    return "CRITICAL";
}

