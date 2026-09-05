"use client";

import { useActionState } from "react";
import { requestPortalLinkAction } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, WarningCircle } from "@/components/icons";

export function PortalLoginForm() {
  const [state, action, pending] = useActionState(requestPortalLinkAction, null);

  return (
    <form action={action} className="space-y-4">
      {state?.ok ? (
        <Alert>
          <CheckCircle className="size-4" />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If that address has portal access, a sign-in link is on its way. It expires in 15
            minutes.
            {state.data.devLink ? (
              <a href={state.data.devLink} className="text-primary-700 mt-2 block break-all underline">
                Dev link: open portal
              </a>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {state && !state.ok ? (
        <Alert variant="destructive">
          <WarningCircle className="size-4" />
          <AlertDescription>{state.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
