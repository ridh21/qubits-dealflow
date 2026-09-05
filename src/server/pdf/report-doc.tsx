import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReportData } from "@/server/queries/reports";
import { reportSections } from "@/server/reports/sections";
import { formatMinor } from "@/domain/money/money";
import { brand } from "./brand";
const styles = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 52,
    fontSize: 9,
    fontFamily: "Noto Sans",
    color: brand.fg,
  },
  title: { fontSize: 23, marginBottom: 8, color: brand.primary },
  subtitle: { fontSize: 10, color: brand.mutedFg, marginBottom: 18 },
  section: { fontSize: 14, marginTop: 18, marginBottom: 10 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: brand.border,
    paddingVertical: 7,
  },
  head: { backgroundColor: brand.primary50, fontWeight: 700 },
  cell: { flex: 1, paddingHorizontal: 5, fontSize: 8 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: brand.mutedFg,
  },
  metric: { marginBottom: 6 },
});
export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document title="DealFlow360 report">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>DealFlow360 report</Text>
        <Text style={styles.subtitle}>
          {data.filters.from} through {data.filters.to} · Generated{" "}
          {data.generatedAt.toISOString().slice(0, 10)}
        </Text>
        <Text style={styles.metric}>
          Quotations: {data.summary.total} · Conversion:{" "}
          {(data.summary.rate * 100).toFixed(1)}% · Open alerts:{" "}
          {data.summary.openAlerts}
        </Text>
        <Text style={styles.metric}>
          Average completed approval time:{" "}
          {data.summary.approvalHours.overall?.toFixed(1) ??
            "No completed approvals"}{" "}
          hours
        </Text>
        {Object.entries(data.filters)
          .filter(([key, value]) => value && !["from", "to"].includes(key))
          .map(([key, value]) => (
            <Text key={key} style={styles.metric}>
              {key}: {value}
            </Text>
          ))}
        {data.currencies.map((c) => (
          <Text key={c.currency} style={styles.metric}>
            {c.currency}: invoiced {formatMinor(c.revenueMinor, c.currency)},
            discount {formatMinor(c.discountMinor, c.currency)}, normalized MRR{" "}
            {formatMinor(c.normalisedMrrMinor, c.currency)}
          </Text>
        ))}
        <Text style={styles.subtitle}>
          Whole quotations matching the chosen filters. Invoice revenue uses
          issue dates. Currency totals are separate. MRR is normalized from
          current active plans.
        </Text>
        {reportSections(data).map((section) => (
          <View key={section.title}>
            <View wrap={false}>
              <Text style={styles.section}>{section.title}</Text>
              <View style={[styles.row, styles.head]} wrap={false}>
                {section.columns.map((c) => (
                  <Text key={c.key} style={styles.cell}>
                    {c.label}
                  </Text>
                ))}
              </View>
            </View>
            {section.rows.map((row, index) => (
              <View key={index} style={styles.row} wrap={false}>
                {section.columns.map((c) => (
                  <Text key={c.key} style={styles.cell}>
                    {c.money && typeof row[c.key] === "number"
                      ? formatMinor(row[c.key] as number, String(row.currency))
                      : String(row[c.key] ?? "—")}
                  </Text>
                ))}
              </View>
            ))}
            {!section.rows.length && <Text>No matching records.</Text>}
          </View>
        ))}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `DealFlow360 · ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
export async function reportPdf(data: ReportData) {
  return new Uint8Array(await renderToBuffer(<ReportDocument data={data} />));
}
