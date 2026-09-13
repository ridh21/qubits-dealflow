import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toast";
import { openRunde, inter } from "./fonts";
import "./globals.css";
import "./marketing.css";

export const metadata: Metadata = {
  title: "DealFlow360",
  description:
    "Self-governing B2B quotation, approval, fulfillment and billing platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${openRunde.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
