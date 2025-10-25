// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TokenizedAsset
 * @dev ERC20 token representing tokenized stocks or bonds (RWA)
 * Each token represents ownership of real-world assets like AAPL, GOOGL, etc.
 */
contract TokenizedAsset is ERC20, Ownable {
    // Asset metadata
    string public assetSymbol;      // Original asset symbol (e.g., "AAPL")
    string public assetType;        // "STOCK" or "BOND"
    uint256 public lastUpdateTime;
    uint256 public currentPrice;    // Price in USD with 8 decimals
    
    // Authorized minters and burners (e.g., the lending platform)
    mapping(address => bool) public authorizedMinters;
    
    event PriceUpdated(uint256 newPrice, uint256 timestamp);
    event AssetMinted(address indexed to, uint256 amount);
    event AssetBurned(address indexed from, uint256 amount);
    
    constructor(
        string memory name,
        string memory symbol,
        string memory _assetSymbol,
        string memory _assetType,
        uint256 initialPrice
    ) ERC20(name, symbol) Ownable(msg.sender) {
        assetSymbol = _assetSymbol;
        assetType = _assetType;
        currentPrice = initialPrice;
        lastUpdateTime = block.timestamp;
    }
    
    /**
     * @dev Update the asset price from oracle
     */
    function updatePrice(uint256 newPrice) external onlyOwner {
        currentPrice = newPrice;
        lastUpdateTime = block.timestamp;
        emit PriceUpdated(newPrice, block.timestamp);
    }
    
    /**
     * @dev Authorize an address to mint/burn tokens (e.g., lending contract)
     */
    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        authorizedMinters[minter] = authorized;
    }
    
    /**
     * @dev Mint tokenized assets (only authorized)
     */
    function mint(address to, uint256 amount) external {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _mint(to, amount);
        emit AssetMinted(to, amount);
    }
    
    /**
     * @dev Burn tokenized assets (only authorized)
     */
    function burn(address from, uint256 amount) external {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to burn");
        _burn(from, amount);
        emit AssetBurned(from, amount);
    }
    
    /**
     * @dev Get the current price in USD (8 decimals)
     */
    function getPrice() external view returns (uint256) {
        return currentPrice;
    }
}

