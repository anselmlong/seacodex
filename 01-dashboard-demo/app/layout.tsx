import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WLIAS Dashboard Demo",
  description: "Singapore social chatter simulation for Shopee-style product listings."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
