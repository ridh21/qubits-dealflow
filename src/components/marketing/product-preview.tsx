import { BrandMark } from "@/components/brand-mark";
import { FileText, Gauge, ShieldCheck, Truck, Receipt, Repeat, Gear, ChartLineUp, CheckCircle } from "@/components/icons";
import { cn } from "@/lib/utils";

const BARS = [27, 39, 35, 48, 44, 60, 55, 68, 63, 76, 71, 84];

/** Static, explicitly labelled example reports; never used for live workspace data. */
export function MiniBars() {
  return <div className="mini-bars" aria-hidden="true">{BARS.map((height, i) => <span key={i} style={{ height: `${height}%` }}><i style={{ height: `${30 + (i % 4) * 5}%` }} /></span>)}</div>;
}

function Ranking({ title, rows, mint = false }: { title: string; rows: [string, string, number][]; mint?: boolean }) {
  return <div className="preview-panel"><div className="preview-panel-label"><span>{title}</span><span>Value</span></div><div className="preview-panel-body ranking-list">{rows.map(([label, value, width]) => <div className="ranking-row" key={label}><span className={cn("ranking-fill", mint && "mint")} style={{width: `${width}%`}} /><span>{label}</span><span>{value}</span></div>)}</div></div>;
}

export function ProductPreview({ compact = false, mode = "overview" }: { compact?: boolean; mode?: "overview" | "pipeline" | "revenue" }) {
  const revenue = mode === "revenue";
  const pipeline = mode === "pipeline";
  return (
    <div className={cn("product-preview", compact && "product-preview-compact")}>
      {!compact && <div className="preview-sidebar" aria-hidden="true">
        <div className="preview-brand"><BrandMark className="size-6" /><strong>Acme</strong></div>
        {[[Gauge,"Overview"],[FileText,"Quotations"],[ShieldCheck,"Approvals"],[Truck,"Fulfillment"],[Receipt,"Invoices"],[Repeat,"Subscriptions"],[ChartLineUp,"Analytics"]].map(([Icon,label],i) => {const I=Icon as typeof Gauge; return <div key={String(label)} className={cn("preview-nav-item",i===0&&"selected")}><I /><span>{String(label)}</span></div>;})}
        <div className="preview-nav-bottom"><div className="preview-nav-item"><Gear />Settings</div><div className="preview-nav-item"><span className="preview-avatar">AM</span>Arjun Malhotra</div></div>
      </div>}
      <div className="preview-main">
        <div className="preview-toolbar"><h3>{revenue ? "Revenue" : pipeline ? "Deal pipeline" : "Overview"}</h3><span>Example report · Last 30 days</span></div>
        <div className="preview-content">
          {pipeline ? <div className="preview-deals">
            <div className="preview-panel-label"><span>Active quotations</span><span>4 of 124</span></div>
            {[["Acme Industries","Q-2026-0142","Approved","₹3,05,856"],["Nova Technologies","Q-2026-0141","In review","₹1,84,500"],["Horizon Retail","Q-2026-0140","Sent","₹96,760"],["Vertex Systems","Q-2026-0139","Confirmed","₹4,12,000"]].map(([name,id,status,total],i)=><div className="preview-deal" key={id}><span className={cn("preview-avatar",i%2===1&&"mint")}>{name.slice(0,2).toUpperCase()}</span><div><strong>{name}</strong><small>{id}</small></div><span className={cn("sample-badge",i%2===0&&"mint")}>{status}</span><strong>{total}</strong></div>)}
            <div className="sample-note"><CheckCircle /> All decisions linked to a policy version</div>
          </div> : <>
            <div className="preview-metrics">
              {(revenue ? [["Invoiced revenue","₹18.94 L","This month"],["Payments received","₹16.28 L","86% collected"],["Outstanding","₹2.66 L","12 invoices"]] : [["Open quotations","124","Across 42 customers"],["Approved deals","86","Ready for next steps"],["Invoiced revenue","₹18.94 L","This month"]]).map(([label,value,change])=><div className="preview-panel" key={label}><div className="preview-panel-label">{label}</div><div className="preview-panel-body"><strong className="preview-metric-value">{value}</strong><span className="preview-metric-hint">{change}</span></div></div>)}
            </div>
            {!revenue && <div className="preview-chart-row"><div className="preview-panel"><div className="preview-panel-label"><span>Quotations and approvals</span><span>Monthly</span></div><div className="preview-panel-body"><MiniBars /><div className="chart-months"><span>Jan</span><span>Apr</span><span>Jul</span><span>Dec</span></div></div></div><Ranking title="Top customers" rows={[["Acme Industries","₹4.28 L",78],["Nova Technologies","₹3.16 L",61],["Horizon Retail","₹2.42 L",49],["Vertex Systems","₹1.87 L",37]]} /></div>}
            <div className="preview-bottom-row"><Ranking title={revenue ? "Revenue by customer" : "Deal stages"} rows={revenue ? [["Acme Industries","₹8.62 L",84],["Nova Technologies","₹4.78 L",63],["Horizon Retail","₹3.12 L",45],["Vertex Systems","₹2.42 L",35]] : [["Draft","24",72],["In review","14",43],["Approved","52",86],["Sent","34",63]]} /><Ranking mint title={revenue ? "Payment status" : "Fulfillment"} rows={revenue ? [["Paid","₹16.28 L",83],["Partially paid","₹1.42 L",53],["Unpaid","₹1.24 L",40]] : [["Delivered","48",82],["Dispatched","26",58],["Reserved","18",42],["Backordered","4",18]]} /></div>
          </>}
        </div>
      </div>
    </div>
  );
}
