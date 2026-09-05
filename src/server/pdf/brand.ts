import { Font } from "@react-pdf/renderer";
import path from "node:path";

/**
 * react-pdf cannot parse oklch(), so the light-theme tokens from
 * src/app/globals.css are mirrored here in hex. Converted 1:1; if a token
 * changes in the theme, change it here too.
 */
export const brand = {
  fg: "#1e1a16",
  primary: "#c2460d",
  primary50: "#fff6eb",
  primary100: "#ffe6cf",
  muted: "#f9f6f3",
  mutedFg: "#68625e",
  border: "#e7e4e0",
  success: "#03a14a",
  destructive: "#df2225",
} as const;

// The built-in Helvetica is WinAnsi-encoded and has no ₹ (U+20B9) glyph —
// money printed with it renders as "¹3,94,166.10". Noto Sans (OFL, in
// public/fonts) carries the glyph; public/ is the one directory that ships
// to the deployed runtime, and process.cwd() resolves there in dev too.
const fontDir = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(fontDir, "NotoSans-Regular.ttf") },
    { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});

export const dateLong = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
