import { CustomerProposals } from "../_components/customer-proposals";
import { suggestionsFor } from "@/server/services/upsell.service";
import { UpsellPanel } from "../_components/upsell-panel";
import {
  getQuotation,
  quotationCatalogue,
  quotationCustomers,
} from "@/server/queries/quotations";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteBuilder } from "../_components/quote-builder";
import { canEditQuotation } from "../_components/quotation-access";
export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getQuotation(id);
  const [products, suggestions, customers] = await Promise.all([
    quotationCatalogue(),
    suggestionsFor(id),
    canEditQuotation(data.quote, data.actor)
      ? quotationCustomers()
      : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader
        title={`${data.quote.number} · v${data.quote.version}`}
        description="Quotation workspace"
      />
      <QuoteBuilder
        key={`${id}:${data.quote.version}`}
        data={data}
        products={products}
        customers={customers}
      />
      <CustomerProposals
        id={id}
        version={data.quote.version}
        status={data.quote.status}
        messages={data.quote.messages}
        canRespond={data.actor.role !== "FINANCE"}
      />
      {canEditQuotation(data.quote, data.actor) && (
        <UpsellPanel
          key={`${id}:${data.quote.version}`}
          items={suggestions}
          id={id}
          version={data.quote.version}
          currency={data.quote.currency}
        />
      )}
    </>
  );
}
