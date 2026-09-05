"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { setProductStatusAction } from "@/server/actions/admin";

export function ProductStatusToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const archived = status === "ARCHIVED";

  function toggle() {
    startTransition(async () => {
      const result = await setProductStatusAction(id, archived ? "ACTIVE" : "ARCHIVED");
      if (result.ok) {
        toast.success(
          archived
            ? "Product restored — reps can quote it again."
            : "Product archived — it stays on existing quotes but cannot be added to new ones.",
        );
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Button variant="outline" onClick={toggle} disabled={pending}>
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
