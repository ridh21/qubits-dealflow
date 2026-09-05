import { describe, expect, it } from "vitest";
import {
  parseQuotationListParams as parse,
  quotationListHref,
  quotationPipeline,
  quotationStatuses,
} from "./list-params";

describe("quotation list URLs", () => {
  it("accepts repeated and comma-separated statuses without duplicates", () => {
    expect(
      parse({ status: ["SENT,UNDER_NEGOTIATION", "SENT"] }).status,
    ).toEqual(["SENT", "UNDER_NEGOTIATION"]);
  });
  it("parses exact decimal amounts, including zero and cents", () => {
    expect(parse({ minAmount: "0", maxAmount: "1.15" })).toMatchObject({
      minAmount: 0,
      maxAmount: 115,
      issues: [],
    });
  });
  it.each(["-1", "1e3", "1.001", "21474836.48", "NaN"])(
    "rejects unsafe amount %s",
    (minAmount) => {
      expect(parse({ minAmount, ownerId: "owner" })).toMatchObject({
        ownerId: "owner",
        issues: ["Invalid minAmount."],
      });
    },
  );
  it.each(["2026-02-29", "2026-04-31", "bad"])(
    "rejects impossible date %s",
    (createdFrom) => {
      expect(parse({ createdFrom }).issues).not.toHaveLength(0);
    },
  );
  it("rejects reversed ranges and accepts leap days", () => {
    expect(
      parse({
        minAmount: "2",
        maxAmount: "1",
        createdFrom: "2026-09-05",
        createdTo: "2026-09-04",
      }).issues,
    ).toHaveLength(2);
    expect(parse({ createdFrom: "2024-02-29" }).issues).toEqual([]);
  });
  it("does not discard valid filters when a sibling or pagination is invalid", () => {
    expect(
      parse({
        status: "BOGUS",
        customerId: "customer",
        riskBand: "HIGH",
        page: "-5",
        pageSize: "Infinity",
        sort: "portalToken",
        dir: "sql",
      }),
    ).toMatchObject({
      customerId: "customer",
      riskBand: "HIGH",
      issues: ["Invalid status."],
      page: 1,
      pageSize: 25,
      sort: "updatedAt",
      dir: "desc",
    });
  });
  it("preserves repeated status filters and other filters when switching views", () => {
    const url = new URL(
      quotationListHref(
        { status: ["DRAFT", "SENT"], ownerId: "a", page: "3" },
        { view: "board", page: "1" },
      ),
      "http://localhost",
    );
    expect(url.searchParams.getAll("status")).toEqual(["DRAFT", "SENT"]);
    expect(url.searchParams.get("ownerId")).toBe("a");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("view")).toBe("board");
  });
  it("places every status once, combining sent/negotiation without hiding closed quotes", () => {
    const statuses = quotationPipeline.flatMap((c) => c.statuses);
    expect(statuses.sort()).toEqual([...quotationStatuses].sort());
    expect(quotationPipeline[4].statuses).toEqual([
      "SENT",
      "UNDER_NEGOTIATION",
    ]);
  });
});
