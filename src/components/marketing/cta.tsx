import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "@/components/icons";
import { Section } from "./rails";

/**
 * The closing call to action.
 *
 * This is where the page's grid becomes the design rather than the scaffolding:
 * the outer rails continue through, and the panel repeats them inside itself as
 * inset hairlines, so the motif reads as deliberate at both scales.
 */
export function Cta() {
  return (
    <Section className="bg-primary-50/40" innerClassName="py-16 sm:py-20">
      <div className="bg-primary relative overflow-hidden rounded-2xl">
        {/* The lining, echoed inside the panel. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-[min(100%-3rem,44rem)] -translate-x-1/2 border-x border-white/15"
        />
        {/* A warm bloom so the flat brand colour has some depth under the type. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative px-6 py-16 text-center sm:px-12 sm:py-20">
          <p className="text-primary-foreground/70 text-[11px] font-medium tracking-[0.16em] uppercase">
            Quote to cash, accounted for
          </p>
          <h2 className="font-display text-primary-foreground mx-auto mt-5 max-w-2xl text-3xl leading-[1.12] font-semibold text-balance sm:text-4xl">
            Run one deal end to end and see where it stops drifting.
          </h2>
          <p className="text-primary-foreground/80 mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-pretty">
            Internal teams sign in with a password. Customers get a magic link to their
            own portal — nothing to install on either side.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 w-full sm:w-auto"
            >
              <Link href="/signup">
                Request access
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="text-primary-foreground w-full border-white/30 bg-transparent hover:bg-white/10 hover:text-primary-foreground sm:w-auto"
            >
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
