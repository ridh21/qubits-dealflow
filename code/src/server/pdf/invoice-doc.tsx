import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatMinor } from "@/domain/money/money";
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
const s = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#292524",
  },
  title: { fontSize: 25, color: "#9a3412", marginBottom: 20 },
  row: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e7e5e4",
  },
  description: { width: "55%" },
  number: { width: "15%", textAlign: "right", paddingLeft: 9 },
  summary: { marginTop: 20, alignItems: "flex-end", gap: 8 },
  muted: { color: "#78716c", marginBottom: 8 },
});
export async function invoicePdf(invoice: InvoiceDocumentData) {
  return new Uint8Array(
    await renderToBuffer(
      <Document title={invoice.number}>
        <Page size="A4" style={s.page}>
          <Text style={s.title}>{invoice.number}</Text>
          <Text>{invoice.customer.name}</Text>
          {invoice.customer.billingAddress && (
            <Text>{invoice.customer.billingAddress}</Text>
          )}
          <Text style={s.muted}>
            Issued {invoice.issuedAt.toISOString().slice(0, 10)} · Due{" "}
            {invoice.dueAt.toISOString().slice(0, 10)} · {invoice.status}
          </Text>
          <View style={s.row}>
            <Text style={s.description}>Description</Text>
            <Text style={s.number}>Quantity</Text>
            <Text style={s.number}>Net</Text>
            <Text style={s.number}>Tax</Text>
          </View>
          {invoice.lines.map((l) => (
            <View key={l.id} style={s.row} wrap={false}>
              <Text style={s.description}>{l.description}</Text>
              <Text style={s.number}>{l.qty}</Text>
              <Text style={s.number}>
                {formatMinor(l.amountMinor, invoice.currency)}
              </Text>
              <Text style={s.number}>
                {formatMinor(l.taxMinor, invoice.currency)}
              </Text>
            </View>
          ))}
          <View style={s.summary}>
            <Text>
              Total: {formatMinor(invoice.totalMinor, invoice.currency)}
            </Text>
            <Text>
              Credits applied:{" "}
              {formatMinor(invoice.creditAppliedMinor, invoice.currency)}
            </Text>
            <Text>
              Paid: {formatMinor(invoice.paidMinor, invoice.currency)}
            </Text>
            <Text>
              Balance:{" "}
              {formatMinor(
                invoice.status === "VOID"
                  ? 0
                  : invoice.totalMinor -
                      invoice.paidMinor -
                      invoice.creditAppliedMinor,
                invoice.currency,
              )}
            </Text>
          </View>
          <Text style={{ marginTop: 30, color: "#78716c", fontSize: 9 }}>
            Goods are billed on dispatch, services on completion, subscriptions
            at period start.
          </Text>
        </Page>
      </Document>,
    ),
  );
}
