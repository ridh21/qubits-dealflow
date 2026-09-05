import localFont from "next/font/local";
import { Inter } from "next/font/google";

export const goga = localFont({
  src: "../../public/fonts/Goga-VariableVF.woff2",
  variable: "--font-goga",
  weight: "300 800",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
