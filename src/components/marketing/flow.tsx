import { FileText, ShieldCheck, Truck, Receipt, Repeat, ChartLineUp, CheckCircle, ArrowRight, Package } from "@/components/icons";
import { Section } from "./rails";
import { ProductPreview, MiniBars } from "./product-preview";

const FEATURES = [
  { icon: FileText, label: "QUOTATIONS", title: "Build the right offer", description: "Price products, services, and subscriptions together, with live margins and customer-specific terms.", tone: "blue" },
  { icon: ShieldCheck, label: "APPROVALS", title: "Make every decision clear", description: "Route discounts to the right reviewer and keep every approval linked to its policy version.", tone: "lilac" },
  { icon: Truck, label: "FULFILLMENT", title: "Keep delivery moving", description: "Reserve stock, split across warehouses, and track dispatches and backorders in one place.", tone: "mint" },
  { icon: Receipt, label: "BILLING", title: "Turn delivery into revenue", description: "Issue invoices from fulfillment, record payments, and see what is still outstanding.", tone: "lilac" },
  { icon: Repeat, label: "SUBSCRIPTIONS", title: "Stay on top of renewals", description: "Manage recurring plans, tier changes, proration, and pauses throughout the customer lifecycle.", tone: "mint" },
  { icon: ChartLineUp, label: "DEAL HEALTH", title: "See what needs attention", description: "Spot stalled deals, overdue work, and delivery risks before they become surprises.", tone: "blue" },
];

export function Flow() {
  return (
    <>
      <Section id="flow" innerClassName="landing-section-space">
        <div className="landing-section-heading">
          <p>How it works</p>
          <h2>Go from a first quotation<br />to a completed deal.</h2>
          <p>Build the offer, move it through the right checks, and follow the work<br className="hidden sm:block" /> all the way to delivery and payment.</p>
        </div>
        <div className="flow-grid">
          <article>
            <div className="flow-art flow-art-blue">
              <div className="example-sheet">
                <div className="example-sheet-title"><FileText /><strong>New quotation</strong><span className="sample-badge">Draft</span></div>
                <div className="example-sheet-content">
                  <div className="sample-line"><span>Acme Industries</span><span>Q-2026-0142</span></div>
                  <div className="sample-line"><span>Industrial sensors</span><strong>₹2,40,000</strong></div>
                  <div className="sample-line"><span>Annual support</span><strong>₹48,000</strong></div>
                  <div className="sample-line"><span>Discount</span><span>10%</span></div>
                </div>
                <div className="sample-note"><CheckCircle /> Margin checked <span>32.4%</span></div>
              </div>
            </div>
            <p className="flow-step">Quote</p><h3>Put the offer together</h3><p>Choose the customer, add your lines, and see prices and margins as you build.</p>
          </article>
          <article>
            <div className="flow-art flow-art-lilac">
              <div className="example-sheet">
                <div className="example-sheet-title"><ShieldCheck /><strong>Approval timeline</strong><span className="sample-badge mint">Approved</span></div>
                <div className="example-sheet-content approval-demo">
                  {["Quotation submitted", "Manager reviewed", "Finance approved"].map((label, i) => <div key={label}><span className="approval-check"><CheckCircle /></span><p><strong>{label}</strong><small>{["Sales team · 10:32 AM", "Within discount ceiling · 10:45 AM", "Ready to send · 11:02 AM"][i]}</small></p></div>)}
                </div>
                <div className="sample-note"><ShieldCheck /> Policy version 4 <span>Verified</span></div>
              </div>
            </div>
            <p className="flow-step">Approve</p><h3>Keep decisions connected</h3><p>Follow one policy from the first discount check to the final reviewer.</p>
          </article>
          <article>
            <div className="flow-art flow-art-mint">
              <div className="example-sheet">
                <div className="example-sheet-title"><Package /><strong>Order completed</strong><span className="sample-badge mint">Paid</span></div>
                <div className="example-sheet-content"><p className="text-muted-foreground text-xs">Invoice total</p><p className="font-display mt-2 text-3xl font-semibold">₹3,05,856</p><MiniBars /><div className="sample-line"><span>Delivered</span><strong>60 of 60 items</strong></div></div>
                <div className="sample-note"><CheckCircle /> Payment recorded <span>Complete</span></div>
              </div>
            </div>
            <p className="flow-step">Deliver & bill</p><h3>Close the loop</h3><p>Fulfill the order, issue the invoice, and keep payments and renewals in view.</p>
          </article>
        </div>
      </Section>

      <Section id="features" innerClassName="landing-section-space">
        <div className="landing-section-heading"><p>Product features</p><h2>The whole deal stays together.<br />Every team shares the context.</h2><p>Move from the offer to the order and the invoice,<br className="hidden sm:block" /> without losing the decisions that connect them.</p></div>
        <div className="feature-grid">
          {FEATURES.map(({icon: Icon, ...feature}) => <article key={feature.label}>
            <div className={`feature-art feature-art-${feature.tone}`}><Icon weight="duotone" /><div className="feature-art-lines"><span /><span /><span /></div><span className="feature-art-check"><CheckCircle weight="fill" /></span></div>
            <p className="feature-label">{feature.label}</p><h3>{feature.title}</h3><p>{feature.description}</p>
          </article>)}
        </div>
      </Section>

      <Section id="product" innerClassName="landing-section-space">
        <div className="landing-section-heading"><p>Product walkthrough</p><h2>See the complete picture.<br />Then follow the details.</h2></div>
        <div className="walkthrough">
          <div><p className="flow-step">01 / 02</p><h3>Follow a deal from its first conversation.</h3><p>Keep the customer, quotation versions, approval decisions, and fulfillment status together. The next step is always in view.</p><div className="walkthrough-note"><CheckCircle /> One history, from first offer to final invoice.</div></div>
          <div className="walkthrough-preview"><ProductPreview compact mode="pipeline" /></div>
        </div>
        <div className="walkthrough">
          <div><p className="flow-step">02 / 02</p><h3>Understand the work behind your revenue.</h3><p>Connect invoices to the orders behind them. See what has been paid, what is outstanding, and which subscriptions are renewing.</p><div className="walkthrough-note"><ArrowRight /> From a balance to the deal behind it.</div></div>
          <div className="walkthrough-preview mint"><ProductPreview compact mode="revenue" /></div>
        </div>
      </Section>
    </>
  );
}
