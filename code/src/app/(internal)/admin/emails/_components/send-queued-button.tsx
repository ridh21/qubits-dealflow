"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaperPlaneTilt } from "@/components/icons";
import { sendQueuedEmailsAction } from "@/server/actions/admin";

export function SendQueuedButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await sendQueuedEmailsAction();
      if (result.ok) {
        toast.success(
          `${result.data.sent} sent${result.data.failed ? `, ${result.data.failed} failed` : ""}.`,
        );
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Button onClick={send} disabled={pending}>
      <PaperPlaneTilt className="size-4" /> {pending ? "Sending…" : "Send queued now"}
    </Button>
  );
}
