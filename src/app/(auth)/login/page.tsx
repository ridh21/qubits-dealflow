import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · DealFlow360" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Internal access for sales, finance and admin teams.
        </p>
      </div>

      <LoginForm next={next} />

      <p className="text-muted-foreground text-sm">
        No account yet?{" "}
        <Link href="/signup" className="text-primary-700 font-medium hover:underline">
          Request access
        </Link>
      </p>
      <p className="text-muted-foreground text-sm">
        Customer?{" "}
        <Link href="/portal/login" className="text-primary-700 font-medium hover:underline">
          Use the customer portal
        </Link>
      </p>
    </div>
  );
}
