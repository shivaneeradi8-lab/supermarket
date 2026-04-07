import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GreenCart – Fresh Groceries Delivered Fast",
  description:
    "Order fresh fruits, vegetables, dairy and groceries online. Fast delivery across India. Shop GreenCart for the best quality at the lowest prices.",
  keywords: "groceries, fresh vegetables, fruits, dairy, online grocery, GreenCart, fast delivery India",
  openGraph: {
    title: "GreenCart – Fresh Groceries Delivered Fast",
    description: "Order fresh fruits, vegetables and groceries online. Fast delivery across India.",
    type: "website",
    siteName: "GreenCart",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
