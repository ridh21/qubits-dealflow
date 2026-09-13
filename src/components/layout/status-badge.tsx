import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  info: "bg-lilac text-[#59419b] border-transparent",
  success: "bg-mint text-success border-transparent",
  warning: "bg-warning/18 text-warning-foreground border-warning/35",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  primary: "bg-primary-50 text-primary-700 border-primary-100",
};

/** Every enum in the app maps to a label + tone here, so status reads the same on every screen. */
const MAP: Record<string, { label: string; tone: Tone }> = {
  // Users
  PENDING: { label: "Pending approval", tone: "warning" },
  ADMIN: { label: "Admin", tone: "primary" },
  SALES_REP: { label: "Sales rep", tone: "info" },
  SALES_MANAGER: { label: "Sales manager", tone: "info" },
  FINANCE: { label: "Finance", tone: "info" },
  CUSTOMER: { label: "Customer", tone: "neutral" },
  // Generic
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
  // Tiers
  BRONZE: { label: "Bronze", tone: "neutral" },
  SILVER: { label: "Silver", tone: "info" },
  GOLD: { label: "Gold", tone: "primary" },
  // Products
  PHYSICAL: { label: "Physical", tone: "neutral" },
  SERVICE: { label: "Service", tone: "info" },
  SUBSCRIPTION: { label: "Subscription", tone: "primary" },
  // Quotation
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warning" },
  REVISION_REQUESTED: { label: "Revision requested", tone: "warning" },
  REJECTED: { label: "Rejected", tone: "danger" },
  APPROVED: { label: "Approved", tone: "success" },
  SENT: { label: "Sent", tone: "info" },
  UNDER_NEGOTIATION: { label: "Under negotiation", tone: "info" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  // Risk
  LOW: { label: "Low risk", tone: "success" },
  MEDIUM: { label: "Medium risk", tone: "warning" },
  HIGH: { label: "High risk", tone: "danger" },
  // Stock / replenishment
  PLANNED: { label: "Planned", tone: "info" },
  RECEIVED: { label: "Received", tone: "success" },
  RECEIPT: { label: "Receipt", tone: "success" },
  RESERVE: { label: "Reserve", tone: "info" },
  RELEASE: { label: "Release", tone: "neutral" },
  SHIP: { label: "Ship", tone: "primary" },
  ADJUST: { label: "Adjust", tone: "warning" },
  // Subscriptions
  SCHEDULED: { label: "Scheduled", tone: "info" },
  PAUSE_SCHEDULED: { label: "Pause scheduled", tone: "warning" },
  PAUSED: { label: "Paused", tone: "warning" },
  // Orders / fulfillment
  OPEN: { label: "Open", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  UNALLOCATED: { label: "Unallocated", tone: "neutral" },
  RESERVED: { label: "Reserved", tone: "info" },
  PARTIALLY_FULFILLED: { label: "Partially fulfilled", tone: "warning" },
  BACKORDERED: { label: "Backordered", tone: "danger" },
  FULFILLED: { label: "Fulfilled", tone: "success" },
  RETURNED: { label: "Returned", tone: "warning" },
  SUPERSEDED: { label: "Superseded", tone: "neutral" },
  WAITING: { label: "Waiting", tone: "neutral" },
  // Invoices / payments
  UNPAID: { label: "Unpaid", tone: "warning" },
  PARTIALLY_PAID: { label: "Partially paid", tone: "info" },
  PAID: { label: "Paid", tone: "success" },
  OVERDUE: { label: "Overdue", tone: "danger" },
  ISSUED: { label: "Issued", tone: "info" },
  ONE_TIME: { label: "One-time", tone: "neutral" },
  RECURRING: { label: "Recurring", tone: "primary" },
  PRORATION: { label: "Proration", tone: "info" },
  VOID: { label: "Void", tone: "neutral" },
  // Email
  QUEUED: { label: "Queued", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
  // Price rules
  NO_ADJUSTMENT: { label: "No adjustment", tone: "neutral" },
  PERCENT_OFF_BASE: { label: "% off base", tone: "info" },
  FIXED_ITEMS: { label: "Fixed prices", tone: "primary" },
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const entry = MAP[value] ?? { label: value.replace(/_/g, " ").toLowerCase(), tone: "neutral" as Tone };
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", TONE_CLASS[entry.tone], className)}
    >
      {entry.label}
    </Badge>
  );
}

export function BoolBadge({ value, trueLabel = "Active", falseLabel = "Inactive" }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return <StatusBadge value={value ? trueLabel.toUpperCase() : falseLabel.toUpperCase()} />;
}
