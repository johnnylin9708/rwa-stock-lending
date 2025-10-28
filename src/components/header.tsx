"use client";

import Link from "next/link";
import { useWeb3 } from "@/context/web3-provider";

export default function Header() {
  const { 
    address, 
    isAuthenticated, 
    user, 
    isLoading,
    connectWallet, 
    disconnectWallet 
  } = useWeb3();

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
      <Link href="/" className="text-xl font-semibold text-gray-900 hover:text-gray-600 transition-colors">
        RWA Stock Lending
      </Link>
      <nav className="flex items-center gap-6">
        <Link href="/lending" className="text-sm text-gray-700 hover:text-gray-900 transition-colors">
          Lending
        </Link>
        {/* <Link href="/history" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
          History
        </Link> */}
        {/* <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Admin
        </Link> */}

        {address ? (
          <div className="flex items-center gap-3">
            {/* Wallet Address */}
            <span className="text-xs font-mono px-3 py-1.5 bg-gray-50 text-gray-700 rounded border border-gray-200">
              {truncateAddress(address)}
            </span>
            
            {/* Status Badges */}
            {isAuthenticated && user && (
              <div className="flex items-center gap-2 text-gray-900">
                {user.email}
              </div>
            )}
            
            {/* Action Buttons */}
            {!isAuthenticated ? (
              <button 
                type="button"
                onClick={connectWallet}
                disabled={isLoading}
                className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Signing...' : 'Sign In'}
              </button>
            ) : (
              <>
                {!user?.hasAlpacaAccount && user?.kycStatus === 'not_started' && (
                  <Link 
                    href="/signup"
                    className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Complete Registration
                  </Link>
                )}
                <button 
                  type="button"
                  onClick={disconnectWallet}
                  className="text-sm px-4 py-1.5 text-gray-600 hover:text-gray-900 border border-gray-200 rounded hover:border-gray-300 transition-colors"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link 
              href="/signup"
              className="text-sm px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign Up
            </Link>
            <button 
              type="button"
              onClick={connectWallet}
              disabled={isLoading}
              className="text-sm px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Sign In'}
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
