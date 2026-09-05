import type { Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import type { ReportFilterValues } from "@/lib/zod-schemas/reports";
import type { Prisma } from "@prisma/client";
export interface AnalyticsContext {
  db: Tx;
  actor: SessionUser;
  filters: ReportFilterValues;
  scope: Prisma.QuotationWhereInput;
  period: { from: Date; to: Date };
  now: Date;
}
export const month = (date: Date) => date.toISOString().slice(0, 7);
export const day = (date: Date) => date.toISOString().slice(0, 10);
