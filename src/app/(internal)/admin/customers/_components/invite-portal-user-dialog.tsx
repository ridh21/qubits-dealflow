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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaperPlaneTilt } from "@/components/icons";
import { invitePortalUserAction } from "@/server/actions/admin";

export function InvitePortalUserDialog({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function invite() {
    startTransition(async () => {
      const result = await invitePortalUserAction({ customerId, name, email });
      if (result.ok) {
        toast.success("Invitation sent.", {
          description: result.data.devLink ? "Dev sign-in link logged in the outbox." : undefined,
        });
        setName("");
        setEmail("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PaperPlaneTilt className="size-4" /> Invite portal user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a portal user</DialogTitle>
          <DialogDescription>
            They receive a magic-link email — no password to manage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pu-name">Name</Label>
            <Input id="pu-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pu-email">Email</Label>
            <Input
              id="pu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={invite} disabled={pending || !email || name.trim().length < 2}>
            {pending ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
