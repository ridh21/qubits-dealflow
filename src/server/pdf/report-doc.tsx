import path from "node:path";
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReportData } from "@/server/queries/reports";
import { reportSections } from "@/server/reports/sections";
import { formatMinor } from "@/domain/money/money";
import { brand, dateLong } from "./brand";

const LOGO_PATH = path.join(process.cwd(), "public", "brand", "dealflow-mark.png");

// Filter strings are plain YYYY-MM-DD; parse at UTC midnight so the displayed
// date cannot shift a day depending on the server's timezone.
function reportDate(value: string) {
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return dateLong(new Date(dayOnly ? `${value}T00:00:00Z` : value), dayOnly ? "UTC" : undefined);
}

const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: "Noto Sans",
    color: brand.fg,
  },
  brandBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: brand.primary },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 30,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
  },
  brandWrap: { flexDirection: "row", alignItems: "center" },
  logo: { width: 40, height: 40, objectFit: "contain" },
  brandName: { fontSize: 15, fontWeight: 700, marginLeft: 10, color: brand.fg },
  brandTagline: { fontSize: 8, color: brand.mutedFg, marginTop: 2, marginLeft: 10 },
  reportTitle: { fontSize: 18, fontWeight: 700, color: brand.primary, letterSpacing: 1.2, textAlign: "right" },
  reportRange: { fontSize: 10, fontWeight: 700, marginTop: 2, textAlign: "right" },
  metaLine: { fontSize: 9, color: brand.mutedFg, marginTop: 2, textAlign: "right" },

  body: { paddingTop: 20 },
  blocksRow: { flexDirection: "row", gap: 14 },
  block: {
    flex: 1,
    backgroundColor: brand.muted,
    padding: 12,
    borderRadius: 6,
  },
  blockTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: brand.mutedFg,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  blockLine: { fontSize: 9, marginTop: 2 },
  blockMuted: { fontSize: 9, marginTop: 2, color: brand.mutedFg },

  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: brand.mutedFg,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 20,
  },

  table: { borderRadius: 6, borderWidth: 1, borderColor: brand.border, overflow: "hidden" },
  tableHead: {
    flexDirection: "row",
    backgroundColor: brand.fg,
    padding: 8,
    fontSize: 8.5,
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    fontSize: 8.5,
    borderTopWidth: 0.5,
    borderTopColor: brand.border,
    backgroundColor: "#ffffff",
  },
  tableRowAlt: { backgroundColor: brand.muted },
  cell: { flex: 1, paddingRight: 8 },
  cellMoney: { flex: 1, textAlign: "right", paddingRight: 0 },

  notes: {
    marginTop: 24,
    padding: 12,
    backgroundColor: brand.muted,
    borderRadius: 6,
    fontSize: 8.5,
    color: brand.mutedFg,
    lineHeight: 1.5,
  },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: brand.border,
    paddingTop: 8,
    fontSize: 8,
    color: brand.mutedFg,
  },
});

export function ReportDocument({ data }: { data: ReportData }) {
  const { from, to, ...restFilters } = data.filters as Record<string, unknown> & {
    from: string;
    to: string;
  };
  const range =
    from === to
      ? reportDate(String(from))
      : `${reportDate(String(from))} – ${reportDate(String(to))}`;
  const approval = data.summary.approvalHours.overall?.toFixed(1) ?? "No completed approvals";
  const extraFilters = Object.entries(restFilters).filter(([, value]) => value);

  return (
    <Document title="DealFlow360 report">
      <Page size="A4" style={s.page}>
        <View style={s.brandBar} fixed />

        <View style={s.header}>
          <View style={s.brandWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image is a PDF primitive, not an <img> */}
            <Image src={LOGO_PATH} style={s.logo} />
            <View>
              <Text style={s.brandName}>DealFlow360</Text>
              <Text style={s.brandTagline}>Sales, fulfillment &amp; subscription billing</Text>
            </View>
          </View>
          <View>
            <Text style={s.reportTitle}>REPORT</Text>
            <Text style={s.reportRange}>{range}</Text>
            <Text style={s.metaLine}>Generated {dateLong(data.generatedAt)}</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.blocksRow}>
            <View style={s.block}>
              <Text style={s.blockTitle}>Summary</Text>
              <Text style={s.blockLine}>Quotations: {data.summary.total}</Text>
              <Text style={s.blockLine}>
                Conversion: {(data.summary.rate * 100).toFixed(1)}%
              </Text>
              <Text style={s.blockLine}>Open alerts: {data.summary.openAlerts}</Text>
              <Text style={s.blockLine}>
                Average completed approval time: {approval}
                {data.summary.approvalHours.overall != null ? " hours" : ""}
              </Text>
            </View>
            <View style={s.block}>
              <Text style={s.blockTitle}>Filters</Text>
              {extraFilters.length > 0 ? (
                extraFilters.map(([key, value]) => (
                  <Text key={key} style={s.blockLine}>
                    {key}: {String(value)}
                  </Text>
                ))
              ) : (
                <Text style={s.blockMuted}>No additional filters</Text>
              )}
            </View>
          </View>

          {data.currencies.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Currency totals</Text>
              <View style={s.table}>
                <View style={s.tableHead} wrap={false}>
                  <Text style={s.cell}>Currency</Text>
                  <Text style={s.cellMoney}>Invoiced</Text>
                  <Text style={s.cellMoney}>Discount</Text>
                  <Text style={s.cellMoney}>Normalized MRR</Text>
                </View>
                {data.currencies.map((c) => (
                  <View key={c.currency} style={s.tableRow} wrap={false}>
                    <Text style={s.cell}>{c.currency}</Text>
                    <Text style={s.cellMoney}>{formatMinor(c.revenueMinor, c.currency)}</Text>
                    <Text style={s.cellMoney}>{formatMinor(c.discountMinor, c.currency)}</Text>
                    <Text style={s.cellMoney}>{formatMinor(c.normalisedMrrMinor, c.currency)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {reportSections(data).map((section) => (
            <View key={section.title}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              <View style={s.table}>
                <View style={s.tableHead} wrap={false}>
                  {section.columns.map((c) => (
                    <Text key={c.key} style={c.money ? s.cellMoney : s.cell}>
                      {c.label}
                    </Text>
                  ))}
                </View>
                {section.rows.map((row, index) => (
                  <View key={index} style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
                    {section.columns.map((c) => (
                      <Text key={c.key} style={c.money ? s.cellMoney : s.cell}>
                        {c.money && typeof row[c.key] === "number"
                          ? formatMinor(row[c.key] as number, String(row.currency))
                          : String(row[c.key] ?? "—")}
                      </Text>
                    ))}
                  </View>
                ))}
                {!section.rows.length && (
                  <View style={s.tableRow}>
                    <Text style={s.cell}>No matching records.</Text>
                  </View>
                )}
              </View>
            </View>
          ))}

          <Text style={s.notes}>
            Whole quotations matching the chosen filters. Invoice revenue uses
            issue dates. Currency totals are separate. MRR is normalized from
            current active plans.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text>DealFlow360 — Sales, fulfillment &amp; subscription billing</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
export async function reportPdf(data: ReportData) {
  return new Uint8Array(await renderToBuffer(<ReportDocument data={data} />));
}
