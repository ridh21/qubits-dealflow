import Link from "next/link";
import { Section } from "./rails";
import { Wordmark } from "./wordmark";
export function SiteFooter() {
  return (
    <footer>
      <Section innerClassName="pb-8 pt-4">
        <div className="landing-footer-top">
          <div><Wordmark /><p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">One workspace for the path<br />from quotation to revenue.</p><p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-success" /> Built for B2B teams</p></div>
          <nav aria-label="Footer product navigation"><p>Product</p>{[["#product","Product"],["#features","Features"],["#flow","How it works"],["#pricing","Pricing"],["#faq","FAQ"]].map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>
          <nav aria-label="Footer access navigation"><p>Workspace</p><Link href="/login">Team login</Link><Link href="/portal/login">Customer portal</Link><Link href="/signup">Request access</Link></nav>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t pt-6 text-xs text-muted-foreground"><p>© {new Date().getFullYear()} DealFlow360</p><p>Every deal, connected.</p></div>
      </Section>
    </footer>
  );
}
