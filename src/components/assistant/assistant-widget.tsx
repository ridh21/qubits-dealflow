"use client";

import { useEffect, useState } from "react";
import { ChatCircleDots, Sparkle, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssistantChat } from "./assistant-chat";

/**
 * The floating read-only assistant.
 *
 * Ask a question in English; the LangGraph agent in services/assistant turns it
 * into SQL and answers. It cannot change anything — it connects with a
 * SELECT-only database role, so that is a property of the connection rather
 * than something the prompt merely asks for.
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed end-6 bottom-6 z-50 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label="DealFlow assistant"
          className={cn(
            "bg-card text-card-foreground flex h-[min(34rem,calc(100dvh-8rem))] w-[min(23rem,calc(100vw-3rem))]",
            "flex-col overflow-hidden rounded-2xl border shadow-2xl",
          )}
        >
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full">
              <Sparkle className="size-4" weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Assistant</p>
              <p className="text-muted-foreground truncate text-xs">
                Read-only
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X className="size-4" />
            </Button>
          </header>

          <AssistantChat />
        </div>
      )}

      <Button
        size="lg"
        className="size-13 rounded-full shadow-lg"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? <X className="size-5" /> : <ChatCircleDots className="size-5" />}
      </Button>
    </div>
  );
}
