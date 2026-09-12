"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Markdown for assistant replies, styled to fit the chat bubble.
 *
 * The agent answers with bold lead-ins, bullet lists, tables and inline code,
 * so plain <p> rendering shows raw `**` markers. GFM covers the tables the
 * agent emits for top-N style answers. User turns stay plain text — only the
 * model writes markdown.
 */
export const AssistantMarkdown = memo(function AssistantMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "assistant-markdown space-y-2 text-sm leading-relaxed break-words",
        "[&_p]:m-0",
        "[&_strong]:font-semibold",
        "[&_ul]:m-0 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-5",
        "[&_ol]:m-0 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:ps-5",
        "[&_li]:m-0 [&_li>p]:m-0",
        "[&_h1]:text-sm [&_h1]:font-semibold [&_h1]:m-0",
        "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:m-0",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:m-0",
        "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:m-0",
        "[&_code]:bg-background/60 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8em]",
        "[&_pre]:bg-background/60 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-2",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.85em]",
        "[&_th]:border-b [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border-b [&_td]:px-2 [&_td]:py-1 [&_td]:align-top",
        "[&_tr:last-child_td]:border-b-0",
        "[&_a]:underline [&_a]:underline-offset-2",
        "[&_hr]:border-border",
        "[&_blockquote]:border-l-2 [&_blockquote]:ps-2 [&_blockquote]:opacity-80",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
});
