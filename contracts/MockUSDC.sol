// contracts/MockUSDC.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing purposes
 * This is a simplified version of USDC for development and testing
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant _decimals = 6;
    
    constructor() ERC20("Mock USD Coin", "mUSDC") Ownable(msg.sender) {
        // 初始鑄造 1,000,000 USDC
        _mint(msg.sender, 1000000 * 10**_decimals);
    }
    
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev 鑄造 USDC tokens (僅 owner 可調用)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev 銷毀 USDC tokens (僅 owner 可調用)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
    
    /**
     * @dev 獲取總供應量
     */
    function totalSupply() public view override returns (uint256) {
        return super.totalSupply();
    }
}
