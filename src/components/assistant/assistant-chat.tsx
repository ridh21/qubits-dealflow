"use client";

import { useEffect, useRef, useState } from "react";
import { PaperPlaneTilt } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/** The whole assistant: a question in, an answer and its SQL back. */

const SUGGESTIONS = [
  "How many quotations are pending approval?",
  "Total outstanding receivables",
  "Top 5 customers by confirmed quote value",
];

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** The SELECTs behind an answer, revealed on demand. */
  sql?: string[];
}

let counter = 0;
const nextId = () => `t${++counter}`;

export function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

  async function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    setTurns((current) => [
      ...current,
      { id: nextId(), role: "user", text: trimmed },
    ]);
    setDraft("");
    setPending(true);

    try {
      const response = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = (await response.json()) as {
        answer?: string;
        sql?: string[];
        error?: string;
      };
      setTurns((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          text:
            data.answer ??
            data.error ??
            "I could not answer that one — try rephrasing it.",
          sql: data.sql,
        },
      ]);
    } catch {
      setTurns((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          text: "I could not reach the assistant service.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-col">
      <ScrollArea className="min-h-0 flex-1 px-4">
        <div className="space-y-3 py-4">
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Ask about quotations, orders, invoices, subscriptions or stock.
              </p>
              <div className="flex flex-col items-start gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="hover:bg-accent rounded-lg border px-3 py-1.5 text-start text-xs transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <div
              key={turn.id}
              className={cn(
                "flex",
                turn.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  turn.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                <p className="whitespace-pre-wrap">{turn.text}</p>
                {turn.sql && turn.sql.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-muted-foreground cursor-pointer text-xs">
                      Show the query
                    </summary>
                    <pre className="text-muted-foreground mt-1 overflow-x-auto text-[11px] leading-relaxed">
                      {turn.sql.join(";\n\n")}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}

          {pending && (
            <p className="text-muted-foreground text-sm" aria-live="polite">
              Looking that up…
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question…"
          aria-label="Ask the assistant a question"
          maxLength={500}
          disabled={pending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending || draft.trim().length === 0}
          aria-label="Send"
        >
          <PaperPlaneTilt className="size-4" />
        </Button>
      </form>
    </div>
  );
}
