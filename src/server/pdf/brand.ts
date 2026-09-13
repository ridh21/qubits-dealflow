import { Font } from "@react-pdf/renderer";
import path from "node:path";

/**
 * react-pdf cannot parse oklch(), so the light-theme tokens from
 * src/app/globals.css are mirrored here in hex. Converted 1:1; if a token
 * changes in the theme, change it here too.
 */
export const brand = {
  fg: "#18181b",
  primary: "#357dff",
  primary50: "#f0f5ff",
  primary100: "#e8f0ff",
  muted: "#f7fafc",
  mutedFg: "#64646c",
  border: "#e5e5e8",
  success: "#16804a",
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

export const dateLong = (d: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
