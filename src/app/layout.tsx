import type { Metadata } from "next";

import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Helloview Studio OS",
  description: "Next.js 16 frontend for user management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-white font-sans text-zinc-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
