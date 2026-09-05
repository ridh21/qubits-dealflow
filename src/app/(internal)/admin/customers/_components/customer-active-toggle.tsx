"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { setCustomerActiveAction } from "@/server/actions/admin";

export function CustomerActiveToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setCustomerActiveAction(id, !isActive);
      if (result.ok) {
        toast.success(isActive ? "Customer deactivated." : "Customer reactivated.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Button variant="outline" onClick={toggle} disabled={pending}>
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
