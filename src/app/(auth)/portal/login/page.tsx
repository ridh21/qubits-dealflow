import { PortalLoginForm } from "./portal-login-form";

export const metadata = { title: "Customer portal · DealFlow360" };

export default function PortalLoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold">Customer portal</h1>
        <p className="text-muted-foreground text-sm">
          Enter the email your quotation was sent to and we will email you a sign-in link. No
          password needed.
        </p>
      </div>
      <PortalLoginForm />
    </div>
  );
}
