"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DotsThree } from "@/components/icons";
import { approveUserAction, setUserActiveAction } from "@/server/actions/admin";

const ROLES = [
  { value: "SALES_REP", label: "Sales rep" },
  { value: "SALES_MANAGER", label: "Sales manager" },
  { value: "FINANCE", label: "Finance" },
  { value: "ADMIN", label: "Admin" },
];

const NO_TEAM = "__none__";

export function UserRowActions({
  user,
  teams,
}: {
  user: { id: string; name: string; role: string; isActive: boolean; teamId: string | null };
  teams: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user.role === "PENDING" ? "SALES_REP" : user.role);
  const [teamId, setTeamId] = useState(user.teamId ?? NO_TEAM);
  const [pending, startTransition] = useTransition();

  const isCustomer = user.role === "CUSTOMER";

  function save() {
    startTransition(async () => {
      const result = await approveUserAction({
        userId: user.id,
        role,
        teamId: teamId === NO_TEAM ? null : teamId,
      });
      if (result.ok) {
        toast.success(`${user.name} is now ${role.replace(/_/g, " ").toLowerCase()}.`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const result = await setUserActiveAction(user.id, !user.isActive);
      if (result.ok) {
        toast.success(user.isActive ? "Account deactivated." : "Account reactivated.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${user.name}`}>
            <DotsThree className="size-4" weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={isCustomer} onSelect={() => setOpen(true)}>
            {user.role === "PENDING" ? "Approve & assign role" : "Change role"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleActive}>
            {user.isActive ? "Deactivate" : "Reactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{user.role === "PENDING" ? "Approve account" : "Change role"}</DialogTitle>
            <DialogDescription>
              {user.name} gets access as soon as you save, and receives an email about it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEAM}>No team</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
