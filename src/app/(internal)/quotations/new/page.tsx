import { PageHeader } from "@/components/layout/page-header";
import { quotationCustomers } from "@/server/queries/quotations";
import { requireRole } from "@/server/auth/guards";
import { SALES_ROLES } from "@/server/services/quotation.service";
import { CreateQuote } from "../_components/create-quote";
export default async function NewQuotationPage() {
  await requireRole(SALES_ROLES);
  return (
    <>
      <PageHeader
        title="New quotation"
        description="Start with a customer, then build the terms."
      />
      <CreateQuote customers={await quotationCustomers()} />
    </>
  );
}
