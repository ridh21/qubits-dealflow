"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startDraftQuoteAction } from "@/server/actions/quotations";
import { Button } from "@/components/ui/button";
import { Plus } from "@/components/icons";

/**
 * Creates the draft and goes straight to the builder. The customer is resolved
 * server-side and can be changed in the builder's Terms card, so starting a
 * quotation costs one click instead of a separate page.
 */
export function NewQuotationButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await startDraftQuoteAction();
          if (result.ok) router.push(`/quotations/${result.data.id}`);
          else toast.error(result.error.message);
        })
      }
    >
      <Plus aria-hidden="true" />
      {pending ? "Creating…" : "New quotation"}
    </Button>
  );
}
