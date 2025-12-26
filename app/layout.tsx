import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/AppShell";
import { FeedbackProvider } from "@/components/feedback-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Think",
  description: "AI coding assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${inter.className} antialiased`}
      >
        <AppShell>
          <FeedbackProvider />
          {children}
        </AppShell>
      </body>
    </html>
  );
}
