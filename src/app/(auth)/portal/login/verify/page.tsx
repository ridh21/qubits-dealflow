import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyPortalTokenAction } from "@/server/actions/auth.actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WarningCircle } from "@/components/icons";

export const metadata = { title: "Signing you in · DealFlow360" };

export default async function PortalVerifyPage({
  searchParams,
}: PageProps<"/portal/login/verify">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  const result = token
    ? await verifyPortalTokenAction(token)
    : ({ ok: false, error: { code: "VALIDATION", message: "That link is missing its token." } } as const);

  if (result.ok) redirect("/portal");

  return (
    <div className="space-y-5">
      <Alert variant="destructive">
        <WarningCircle className="size-4" />
        <AlertDescription>{result.error.message}</AlertDescription>
      </Alert>
      <Button asChild>
        <Link href="/portal/login">Request a new link</Link>
      </Button>
    </div>
  );
}
