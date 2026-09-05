"use client";
import { useTransition } from "react";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { runBillingAction } from "@/server/actions/subscriptions";
import { WorkspaceActions } from "@/components/layout/workspace-actions";
import { Button } from "@/components/ui/button";
import { Repeat } from "@/components/icons";
export function BillingAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <WorkspaceActions>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const result = await runBillingAction();
              if (!result.ok) {
                toast.error(result.error.message);
                return;
              }
              const { invoices, transitions, failed } = result.data;
              if (failed.length)
                toast.warning(
                  `${invoices} invoices, ${transitions} transitions; ${failed.length} subscriptions failed. Run again to retry.`,
                );
              else
                toast.success(
                  `Billing complete · ${invoices} invoices · ${transitions} transitions`,
                );
              router.refresh();
            } catch {
              toast.error("Billing could not finish. Please retry.");
            }
          })
        }
      >
        <Repeat />
        {pending ? "Running billing…" : "Run billing now"}
      </Button>
    </WorkspaceActions>
  );
}
