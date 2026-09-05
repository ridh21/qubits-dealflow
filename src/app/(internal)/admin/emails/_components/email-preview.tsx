"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function EmailPreview({
  email,
}: {
  email: { subject: string; to: string; text: string; html: string | null };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Preview
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{email.subject}</SheetTitle>
            <SheetDescription>To {email.to}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {email.html ? (
              <iframe
                title="Email preview"
                srcDoc={email.html}
                className="h-[70vh] w-full rounded-lg border"
              />
            ) : (
              <pre className="bg-muted rounded-lg p-4 text-xs whitespace-pre-wrap">{email.text}</pre>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
