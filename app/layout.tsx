import type { Metadata, Viewport } from "next";
import "./globals.css";

import { AppShell } from "@/components/AppShell";
import { FeedbackProvider } from "@/components/feedback-provider";

export const metadata: Metadata = {
  title: "Think",
  description: "AI coding assistant",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
        className="font-sans antialiased"
      >
        <main className="h-full" style={{ 
          paddingTop: 'env(safe-area-inset-top)', 
          paddingBottom: 'env(safe-area-inset-bottom)' 
        }}>
          <AppShell>
            <FeedbackProvider />
            {children}
          </AppShell>
        </main>
      </body>
    </html>
  );
}
