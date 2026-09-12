"use client";

import { useEffect, useRef, useState } from "react";
import { PaperPlaneTilt } from "@/components/icons";
import { LoadingState } from "@/components/spectrumui/blocks/ai-assistants/loading-state";
import { AssistantMarkdown } from "./assistant-markdown";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** The whole assistant: a question in, an answer back. */

const SUGGESTIONS = [
  "How many quotations are pending approval?",
  "Total outstanding receivables",
  "Top 5 customers by confirmed quote value",
];

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
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
    // flex-1 pins the input bar to the bottom of the panel and lets the
    // message list actually scroll instead of stretching the panel.
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-4 pt-4 pb-5">
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
                {turn.role === "assistant" ? (
                  <AssistantMarkdown text={turn.text} />
                ) : (
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                )}
              </div>
            </div>
          ))}

          {pending && (
            <div aria-live="polite">
              <LoadingState label="Looking that up" />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(draft);
        }}
      >
        {/* Enter drops a line (default textarea behaviour); only the button
            sends, so multi-line questions stay multi-line. */}
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question…"
          aria-label="Ask the assistant a question"
          maxLength={500}
          disabled={pending}
          rows={1}
          className="max-h-32 min-h-10 resize-none overflow-y-auto py-2"
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending || draft.trim().length === 0}
          aria-label="Send"
          className="mb-0.5 shrink-0"
        >
          <PaperPlaneTilt className="size-4" />
        </Button>
      </form>
    </div>
  );
}
