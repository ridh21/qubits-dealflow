import type { Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import type { ReportFilterValues } from "@/lib/zod-schemas/reports";
import type { Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";

export interface AnalyticsContext {
  db: Tx;
  actor: SessionUser;
  filters: ReportFilterValues;
  scope: Prisma.QuotationWhereInput;
  period: { from: Date; to: Date };
  now: Date;
}
// Buckets are labeled on the IST wall clock (the platform's display timezone).
export const month = (date: Date) =>
  formatInTimeZone(date, "Asia/Kolkata", "yyyy-MM");
export const day = (date: Date) =>
  formatInTimeZone(date, "Asia/Kolkata", "yyyy-MM-dd");
