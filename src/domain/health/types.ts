export interface HealthFinding {
  type: "STALLED" | "DISCOUNT_ANOMALY" | "DELIVERY_SLIPPAGE" | "APPROVAL_SLA";
  severity: "MEDIUM" | "HIGH";
  quotationId?: string;
  orderId?: string;
  detail: { label: string; [key: string]: string | number | null };
}
export const DAY_MS = 86_400_000;
