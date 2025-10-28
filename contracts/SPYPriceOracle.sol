// contracts/SPYPriceOracle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title SPYPriceOracle
 * @dev SPY 價格預言機，整合 Chainlink 價格餵送
 */
contract SPYPriceOracle {
    AggregatorV3Interface public immutable spyPriceFeed;
    
    // 價格更新事件
    event PriceUpdated(uint256 price, uint256 timestamp);
    
    constructor(address _spyPriceFeed) {
        spyPriceFeed = AggregatorV3Interface(_spyPriceFeed);
    }
    
    /**
     * @dev 獲取 SPY 當前價格 (8 decimals)
     */
    function getPrice() external view returns (uint256) {
        (, int256 price, , , ) = spyPriceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price);
    }
    
    /**
     * @dev 獲取 SPY 價格並轉換為 18 decimals
     */
    function getPriceWithDecimals() external view returns (uint256) {
        (, int256 price, , , ) = spyPriceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price) * 1e10; // Chainlink 8 decimals -> 18 decimals
    }
    
    /**
     * @dev 獲取價格和時間戳
     */
    function getPriceAndTimestamp() external view returns (uint256 price, uint256 timestamp) {
        (, int256 rawPrice, , uint256 updatedAt, ) = spyPriceFeed.latestRoundData();
        require(rawPrice > 0, "Invalid price");
        return (uint256(rawPrice), updatedAt);
    }
    
    /**
     * @dev 檢查價格是否在合理範圍內
     */
    function isPriceValid() external view returns (bool) {
        try spyPriceFeed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256,
            uint80
        ) {
            return price > 0 && price < 10000 * 1e8; // 價格在 0-10000 美元之間
        } catch {
            return false;
        }
    }
    
    /**
     * @dev 獲取價格預言機資訊
     */
    function getPriceFeedInfo() external view returns (
        address feedAddress,
        uint8 decimals,
        string memory description
    ) {
        return (
            address(spyPriceFeed),
            spyPriceFeed.decimals(),
            spyPriceFeed.description()
        );
    }
}
