import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import clsx from "clsx";
import "./globals.css";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Voicy",
  description:
    "A fast, open-source voice assistant powered by Groq, Cartesia, and Vercel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={clsx(
          GeistSans.variable,
          GeistMono.variable,
          "h-screen w-screen flex flex-col dark:text-white bg-white dark:bg-black antialiased font-sans select-none"
        )}
      >
        {/* The main content is set to grow and fill the rest of the available space */}
        <main className="flex-grow flex flex-col items-center justify-center w-full">
          {children}
        </main>

        <Toaster richColors theme="system" />
        <Analytics />
      </body>
    </html>
  );
}
