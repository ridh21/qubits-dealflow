import { getInvoice } from "@/server/queries/invoices";
import { invoicePdf } from "@/server/pdf/invoice-doc";
import { attachment, exportError } from "@/server/exports/response";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { invoice } = await getInvoice(id);
    return attachment(
      await invoicePdf(invoice),
      "application/pdf",
      `${invoice.number.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`,
    );
  } catch (error) {
    return exportError(error);
  }
}
