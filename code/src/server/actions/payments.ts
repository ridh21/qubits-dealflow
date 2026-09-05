"use server";
import { runAction } from "./run-action";
import { PaymentInput, recordPayment } from "@/server/services/payment.service";
export async function recordPaymentAction(input: unknown) {
  return runAction({
    roles: ["ADMIN", "FINANCE"],
    schema: PaymentInput,
    input,
    execute: recordPayment,
    paths: ["/invoices", "/dashboard"],
  });
}
