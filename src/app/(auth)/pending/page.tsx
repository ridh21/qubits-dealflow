import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClockCounterClockwise } from "@/components/icons";

export const metadata = { title: "Awaiting approval · DealFlow360" };

export default function PendingPage() {
  return (
    <div className="space-y-6">
      <div className="bg-primary-50 text-primary-700 grid size-11 place-items-center rounded-xl">
        <ClockCounterClockwise className="size-5" weight="duotone" />
      </div>
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold">Account awaiting approval</h1>
        <p className="text-muted-foreground text-sm">
          An admin needs to assign your role before you can sign in. You will get an email as soon
          as that happens.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  );
}
