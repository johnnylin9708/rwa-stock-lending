"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWeb3 } from "@/context/web3-provider";

export default function Header() {
  const { address, connectWallet, disconnectWallet } = useWeb3();

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
      <Link href="/" className="text-xl font-semibold text-gray-900 hover:text-gray-600 transition-colors">
        RWA Lending
      </Link>
      <nav className="flex items-center gap-6">
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
          Dashboard
        </Link>
        <Link href="/lending" className="text-sm text-gray-700 hover:text-gray-900 transition-colors">
          Lending
        </Link>
        {/* <Link href="/trade" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
          Trade
        </Link> */}
        <Link href="/history" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
          History
        </Link>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Admin
        </Link>

        {address ? (
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-3 py-1.5 bg-gray-50 text-gray-700 rounded border border-gray-200">
              {truncateAddress(address)}
            </span>
            <button 
              onClick={disconnectWallet}
              className="text-sm px-4 py-1.5 text-gray-600 hover:text-gray-900 border border-gray-200 rounded hover:border-gray-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button 
            onClick={connectWallet}
            className="text-sm px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </nav>
    </header>
  );
}
