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
import { formatMinor } from "@/domain/money/money";
import { brand, dateLong } from "./brand";

export interface InvoiceDocumentData {
  number: string;
  currency: string;
  customer: { name: string; billingAddress?: string | null };
  issuedAt: Date;
  dueAt: Date;
  totalMinor: number;
  paidMinor: number;
  creditAppliedMinor: number;
  status: string;
  lines: {
    id: string;
    description: string;
    qty: number;
    amountMinor: number;
    taxMinor: number;
  }[];
}

const LOGO_PATH = path.join(process.cwd(), "public", "brand", "dealflow-mark.png");

// Pill treatment per invoice state: settled invoices read green, void ones
// read red, everything in between stays on the terracotta tint.
function statusStyle(status: string) {
  if (status === "PAID") return { backgroundColor: brand.success, color: "#ffffff" };
  if (status === "VOID") return { backgroundColor: brand.destructive, color: "#ffffff" };
  return { backgroundColor: brand.primary100, color: brand.fg };
}

const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
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
  invoiceTitle: { fontSize: 18, fontWeight: 700, color: brand.primary, letterSpacing: 1.2, textAlign: "right" },
  invoiceCode: { fontSize: 11, fontWeight: 700, marginTop: 2, textAlign: "right" },
  metaLine: { fontSize: 9, color: brand.mutedFg, marginTop: 2, textAlign: "right" },
  statusPill: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    alignSelf: "flex-end",
  },

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
  blockMain: { fontWeight: 700, fontSize: 11 },
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
    fontSize: 9,
    borderTopWidth: 0.5,
    borderTopColor: brand.border,
    backgroundColor: "#ffffff",
  },
  tableRowAlt: { backgroundColor: brand.muted },
  cDescription: { flex: 4, paddingRight: 8 },
  cQty: { flex: 1, textAlign: "right" },
  cNet: { flex: 2, textAlign: "right" },
  cTax: { flex: 2, textAlign: "right" },
  cTotal: { flex: 2, textAlign: "right", fontWeight: 700 },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totalsBox: { width: 250 },
  totalRow: { flexDirection: "row", paddingVertical: 3, fontSize: 9 },
  totalLabel: { flex: 1, textAlign: "right", marginRight: 10, color: brand.mutedFg },
  totalValue: { width: 120, textAlign: "right" },
  totalRule: { borderTopWidth: 1, borderTopColor: brand.border, marginVertical: 4 },
  totalStrong: { fontWeight: 700, fontSize: 10 },
  balanceBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brand.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  balanceLabel: { flex: 1, textAlign: "right", marginRight: 10, color: "#ffffff", fontWeight: 700, fontSize: 10 },
  balanceValue: { width: 120, textAlign: "right", color: "#ffffff", fontWeight: 700, fontSize: 12 },

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

export async function invoicePdf(invoice: InvoiceDocumentData) {
  const subtotalMinor = invoice.lines.reduce((sum, l) => sum + l.amountMinor, 0);
  const taxMinor = invoice.lines.reduce((sum, l) => sum + l.taxMinor, 0);
  const balanceMinor =
    invoice.status === "VOID"
      ? 0
      : invoice.totalMinor - invoice.paidMinor - invoice.creditAppliedMinor;
  const money = (minor: number) => formatMinor(minor, invoice.currency);

  return new Uint8Array(
    await renderToBuffer(
      <Document title={invoice.number}>
        <Page size="A4" style={s.page}>
          <View style={s.brandBar} fixed />

          <View style={s.header}>
            <View style={s.brandWrap}>
              <Image src={LOGO_PATH} style={s.logo} />
              <View>
                <Text style={s.brandName}>DealFlow360</Text>
                <Text style={s.brandTagline}>Sales, fulfillment &amp; subscription billing</Text>
              </View>
            </View>
            <View>
              <Text style={s.invoiceTitle}>INVOICE</Text>
              <Text style={s.invoiceCode}>{invoice.number}</Text>
              <Text style={s.metaLine}>Issued {dateLong(invoice.issuedAt)}</Text>
              <Text style={[s.statusPill, statusStyle(invoice.status)]}>
                {invoice.status.replace(/_/g, " ")}
              </Text>
            </View>
          </View>

          <View style={s.body}>
            <View style={s.blocksRow}>
              <View style={s.block}>
                <Text style={s.blockTitle}>Bill to</Text>
                <Text style={s.blockMain}>{invoice.customer.name}</Text>
                {invoice.customer.billingAddress && (
                  <Text style={s.blockMuted}>{invoice.customer.billingAddress}</Text>
                )}
              </View>
              <View style={s.block}>
                <Text style={s.blockTitle}>Summary</Text>
                <Text style={s.blockLine}>Issued: {dateLong(invoice.issuedAt)}</Text>
                <Text style={s.blockLine}>Due: {dateLong(invoice.dueAt)}</Text>
                <Text style={s.blockMuted}>Currency: {invoice.currency}</Text>
              </View>
            </View>

            <Text style={s.sectionTitle}>Items</Text>
            <View style={s.table}>
              <View style={s.tableHead} wrap={false}>
                <Text style={s.cDescription}>Description</Text>
                <Text style={s.cQty}>Qty</Text>
                <Text style={s.cNet}>Net</Text>
                <Text style={s.cTax}>Tax</Text>
                <Text style={s.cTotal}>Total</Text>
              </View>
              {invoice.lines.map((l, index) => (
                <View key={l.id} style={[s.tableRow, index % 2 === 1 && s.tableRowAlt]} wrap={false}>
                  <Text style={s.cDescription}>{l.description}</Text>
                  <Text style={s.cQty}>{l.qty}</Text>
                  <Text style={s.cNet}>{money(l.amountMinor)}</Text>
                  <Text style={s.cTax}>{money(l.taxMinor)}</Text>
                  <Text style={s.cTotal}>{money(l.amountMinor + l.taxMinor)}</Text>
                </View>
              ))}
            </View>

            <View style={s.totalsWrap}>
              <View style={s.totalsBox} wrap={false}>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Subtotal</Text>
                  <Text style={s.totalValue}>{money(subtotalMinor)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Tax</Text>
                  <Text style={s.totalValue}>{money(taxMinor)}</Text>
                </View>
                <View style={s.totalRule} />
                <View style={s.totalRow}>
                  <Text style={[s.totalLabel, { color: brand.fg, fontWeight: 700 }]}>Total</Text>
                  <Text style={[s.totalValue, s.totalStrong]}>{money(invoice.totalMinor)}</Text>
                </View>
                {invoice.creditAppliedMinor > 0 && (
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Credits applied</Text>
                    <Text style={s.totalValue}>-{money(invoice.creditAppliedMinor)}</Text>
                  </View>
                )}
                {invoice.paidMinor > 0 && (
                  <View style={s.totalRow}>
                    <Text style={s.totalLabel}>Paid</Text>
                    <Text style={s.totalValue}>-{money(invoice.paidMinor)}</Text>
                  </View>
                )}
                <View style={s.balanceBar}>
                  <Text style={s.balanceLabel}>
                    {invoice.status === "VOID" ? "Balance due (void)" : "Balance due"}
                  </Text>
                  <Text style={s.balanceValue}>{money(balanceMinor)}</Text>
                </View>
              </View>
            </View>

            <Text style={s.notes}>
              Goods are billed on dispatch, services on completion, subscriptions
              at period start. Payment is due by the date above. For billing
              queries, reach out to your account contact.
            </Text>
          </View>

          <View style={s.footer} fixed>
            <Text>DealFlow360 — Sales, fulfillment &amp; subscription billing</Text>
            <Text
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </Page>
      </Document>,
    ),
  );
}
