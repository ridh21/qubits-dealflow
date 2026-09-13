import localFont from "next/font/local";
export const openRunde = localFont({
  src: [
    { path: "../../public/fonts/open-runde/regular.otf", weight: "400" },
    { path: "../../public/fonts/open-runde/medium.otf", weight: "500" },
    { path: "../../public/fonts/open-runde/semibold.otf", weight: "600" },
    { path: "../../public/fonts/open-runde/bold.otf", weight: "700" },
  ],
  variable: "--font-open-runde",
  display: "swap",
});

export const inter = localFont({
  src: "../../public/fonts/Inter-Variable.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});
