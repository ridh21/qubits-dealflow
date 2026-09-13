import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section } from "./rails";

export function Cta() {
  return (
    <Section innerClassName="pb-16">
      <div className="landing-cta">
        <p className="landing-pill">Start with your next deal</p>
        <h2>A clearer path<br />from quote to revenue.</h2>
        <p>Bring your team, your customers, and your next steps<br className="hidden sm:block" /> into one connected workspace.</p>
        <Button asChild size="lg"><Link href="/signup">Get started</Link></Button>
      </div>
    </Section>
  );
}
