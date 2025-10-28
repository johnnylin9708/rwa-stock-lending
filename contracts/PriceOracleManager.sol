// contracts/PriceOracleManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SPYPriceOracle.sol";

/**
 * @title PriceOracleManager
 * @dev 價格預言機管理器，統一管理多個價格預言機
 */
contract PriceOracleManager {
    // 價格預言機映射
    mapping(string => address) public oracles;
    
    // 事件
    event OracleRegistered(string indexed symbol, address indexed oracle);
    event OracleUpdated(string indexed symbol, address indexed oldOracle, address indexed newOracle);
    
    /**
     * @dev 註冊價格預言機
     */
    function registerOracle(string memory symbol, address oracle) external {
        require(oracles[symbol] == address(0), "Oracle already registered");
        require(oracle != address(0), "Invalid oracle address");
        
        oracles[symbol] = oracle;
        emit OracleRegistered(symbol, oracle);
    }
    
    /**
     * @dev 更新價格預言機
     */
    function updateOracle(string memory symbol, address newOracle) external {
        require(oracles[symbol] != address(0), "Oracle not registered");
        require(newOracle != address(0), "Invalid oracle address");
        
        address oldOracle = oracles[symbol];
        oracles[symbol] = newOracle;
        emit OracleUpdated(symbol, oldOracle, newOracle);
    }
    
    /**
     * @dev 獲取價格
     */
    function getPrice(string memory symbol) external view returns (uint256) {
        address oracle = oracles[symbol];
        require(oracle != address(0), "Oracle not found");
        
        return SPYPriceOracle(oracle).getPrice();
    }
    
    /**
     * @dev 獲取價格 (18 decimals)
     */
    function getPriceWithDecimals(string memory symbol) external view returns (uint256) {
        address oracle = oracles[symbol];
        require(oracle != address(0), "Oracle not found");
        
        return SPYPriceOracle(oracle).getPriceWithDecimals();
    }
    
    /**
     * @dev 獲取價格和時間戳
     */
    function getPriceAndTimestamp(string memory symbol) external view returns (uint256 price, uint256 timestamp) {
        address oracle = oracles[symbol];
        require(oracle != address(0), "Oracle not found");
        
        return SPYPriceOracle(oracle).getPriceAndTimestamp();
    }
    
    /**
     * @dev 檢查價格是否有效
     */
    function isPriceValid(string memory symbol) external view returns (bool) {
        address oracle = oracles[symbol];
        require(oracle != address(0), "Oracle not found");
        
        return SPYPriceOracle(oracle).isPriceValid();
    }
    
    /**
     * @dev 獲取價格預言機地址
     */
    function getOracle(string memory symbol) external view returns (address) {
        return oracles[symbol];
    }
    
    /**
     * @dev 檢查價格預言機是否已註冊
     */
    function isOracleRegistered(string memory symbol) external view returns (bool) {
        return oracles[symbol] != address(0);
    }
}
