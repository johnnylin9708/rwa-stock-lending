import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import { Web3Provider } from "@/context/web3-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RWA Stock Stacking Platform",
  description: "A platform for lending and borrowing tokenized stocks and bonds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Web3Provider>
          <Header />
          <main>{children}</main>
        </Web3Provider>
      </body>
    </html>
  );
}
