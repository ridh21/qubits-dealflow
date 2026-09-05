"use server";
import { z } from "zod";
import { runAction } from "./run-action";
import {
  AddQuoteLineInput,
  CreateQuoteInput,
  EditQuoteInput,
  QuoteReasonInput,
  QuoteVersionInput,
} from "@/lib/zod-schemas/quotation";
import * as service from "@/server/services/quotation.service";
const roles = service.SALES_ROLES,
  paths = ["/quotations", "/dashboard"];
export async function createQuoteAction(input: unknown) {
  return runAction({
    roles,
    schema: CreateQuoteInput,
    input,
    execute: service.createQuotation,
    paths,
  });
}
export async function addQuoteLineAction(input: unknown) {
  return runAction({
    roles,
    schema: AddQuoteLineInput,
    input,
    execute: service.addLine,
    paths,
  });
}
export async function saveQuoteAction(input: unknown) {
  return runAction({
    roles,
    schema: EditQuoteInput,
    input,
    execute: service.updateQuotation,
    paths,
  });
}
export async function removeQuoteLineAction(input: unknown) {
  return runAction({
    roles,
    schema: QuoteVersionInput.extend({ lineId: z.string().min(1) }),
    input,
    execute: (a, d) => service.removeLine(a, d.id, d.expectedVersion, d.lineId),
    paths,
  });
}
export async function repriceQuoteAction(input: unknown) {
  return runAction({
    roles,
    schema: QuoteVersionInput,
    input,
    execute: (a, d) => service.repriceFromCatalogue(a, d.id, d.expectedVersion),
    paths,
  });
}
export async function reviseQuoteAction(input: unknown) {
  return runAction({
    roles,
    schema: QuoteReasonInput,
    input,
    execute: service.createRevision,
    paths,
  });
}
export async function cancelQuoteAction(input: unknown) {
  return runAction({
    roles,
    schema: QuoteReasonInput,
    input,
    execute: service.cancelQuotation,
    paths,
  });
}
