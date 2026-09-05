import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Request access · DealFlow360" };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold">Request access</h1>
        <p className="text-muted-foreground text-sm">
          Your account is created straight away, but an admin assigns your role before you can sign
          in.
        </p>
      </div>

      <SignupForm />

      <p className="text-muted-foreground text-sm">
        Already approved?{" "}
        <Link href="/login" className="text-primary-700 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
