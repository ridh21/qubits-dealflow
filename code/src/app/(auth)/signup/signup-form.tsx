"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signupAction } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WarningCircle } from "@/components/icons";

export function SignupForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(signupAction, null);

  useEffect(() => {
    if (state?.ok) {
      router.replace(state.data.role === "ADMIN" ? "/login?bootstrap=1" : "/pending");
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      {state && !state.ok ? (
        <Alert variant="destructive">
          <WarningCircle className="size-4" />
          <AlertDescription>{state.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-muted-foreground text-xs">At least 8 characters.</p>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Request access"}
      </Button>
    </form>
  );
}
