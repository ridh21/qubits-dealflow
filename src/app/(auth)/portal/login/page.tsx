import { PortalLoginForm } from "./portal-login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WarningCircle } from "@/components/icons";

export const metadata = { title: "Customer portal · DealFlow360" };

/** Set by the verify route handler when a magic link could not be used. */
const LINK_PROBLEMS: Record<string, string> = {
  expired: "That sign-in link has expired. Request a new one below.",
  unknown: "That sign-in link has already been used. Request a new one below.",
  malformed: "That sign-in link is not valid. Request a new one below.",
  failed: "We could not complete that sign-in. Request a new link below.",
};

export default async function PortalLoginPage({
  searchParams,
}: PageProps<"/portal/login">) {
  const sp = await searchParams;
  const reason = typeof sp.reason === "string" ? LINK_PROBLEMS[sp.reason] : undefined;
  const shared = sp.shared === "1";

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold">Customer portal</h1>
        <p className="text-muted-foreground text-sm">
          Enter the email your quotation was sent to and we will email you a sign-in link. No
          password needed.
        </p>
      </div>

      {reason ? (
        <Alert variant="destructive">
          <WarningCircle className="size-4" />
          <AlertDescription>{reason}</AlertDescription>
        </Alert>
      ) : null}

      {shared ? (
        <Alert>
          <WarningCircle className="size-4" />
          <AlertDescription>
            That shared quotation is private. We have emailed a sign-in link to the contacts on the
            account.
          </AlertDescription>
        </Alert>
      ) : null}

      <PortalLoginForm />
    </div>
  );
}
