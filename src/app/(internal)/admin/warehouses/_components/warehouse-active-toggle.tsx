"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setWarehouseActiveAction } from "@/server/actions/admin";

export function WarehouseActiveToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setWarehouseActiveAction(id, !isActive);
      if (result.ok) {
        toast.success(isActive ? "Warehouse deactivated." : "Warehouse reactivated.");
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
