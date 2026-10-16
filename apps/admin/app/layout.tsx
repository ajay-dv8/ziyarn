import type { Metadata } from "next";
import React from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ziyarn Admin",
  description: "Admin dashboard for Ziyarn",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
