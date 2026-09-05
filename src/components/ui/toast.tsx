"use client";

import hotToast, {
  Toaster as HotToaster,
  type Renderable,
  type Toast,
  type ToastOptions,
  type ValueOrFunction,
} from "react-hot-toast";
import { CheckCircle, Warning, XCircle } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Notifications, top-centre, on react-hot-toast.
 *
 * Two things are wrapped rather than used raw:
 *
 *  - **Icons.** react-hot-toast draws its own animated SVG ticks and crosses,
 *    which are the only icons in the app not from Phosphor. They are replaced
 *    so a toast looks like the rest of the UI.
 *  - **`warning`.** The library ships `success`, `error`, `loading` and a plain
 *    `toast`, but no warning level. Call sites use one, so it is added here
 *    instead of being spelled out at each of them.
 *
 * Everything else on the library's `toast` (dismiss, promise, custom, remove)
 * passes straight through.
 */

/** react-hot-toast's own message type, which it composes but does not export. */
type Message = ValueOrFunction<Renderable, Toast>;

const ICON_CLASS = "size-[18px] shrink-0";

function withIcon(icon: Renderable, options?: ToastOptions): ToastOptions {
  return { icon, ...options };
}

const toast = Object.assign(
  (message: Message, options?: ToastOptions) =>
    hotToast(message, options),
  hotToast,
  {
    success: (message: Message, options?: ToastOptions) =>
      hotToast.success(
        message,
        withIcon(
          <CheckCircle className={cn(ICON_CLASS, "text-success")} weight="fill" />,
          options,
        ),
      ),

    error: (message: Message, options?: ToastOptions) =>
      hotToast.error(
        message,
        withIcon(
          <XCircle className={cn(ICON_CLASS, "text-destructive")} weight="fill" />,
          options,
        ),
      ),

    /** Not a react-hot-toast level; added so call sites can express it. */
    warning: (message: Message, options?: ToastOptions) =>
      hotToast(
        message,
        withIcon(
          <Warning className={cn(ICON_CLASS, "text-warning")} weight="fill" />,
          options,
        ),
      ),
  },
);

export { toast };
export type { Message, Toast, ToastOptions };

export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      gutter={10}
      containerClassName="!top-4"
      toastOptions={{
        duration: 4000,
        // The library sets background, colour, padding and shadow inline, which
        // beats a className. Overriding them here is the only way to reach the
        // design tokens.
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow:
            "0 10px 30px -12px color-mix(in oklch, var(--foreground) 22%, transparent)",
          padding: "10px 14px",
          maxWidth: "26rem",
          fontSize: "0.875rem",
          lineHeight: "1.35rem",
        },
        className: "font-sans",
        error: { duration: 6000 },
      }}
    />
  );
}
