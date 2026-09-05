import { CustomerProposals } from "../_components/customer-proposals";
import { suggestionsFor } from "@/server/services/upsell.service";
import { UpsellPanel } from "../_components/upsell-panel";
import {
  getQuotation,
  quotationCatalogue,
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
  // The customer picker searches on demand, so no customer list is shipped
  // with the page.
  const [products, suggestions] = await Promise.all([
    quotationCatalogue(),
    suggestionsFor(id),
  ]);
  return (
    <>
      <PageHeader
        title={`${data.quote.number} · v${data.quote.version}`}
        description="Quotation workspace"
      />
      {/* Keyed on the version so a new revision remounts the editor and drops
          local draft state. Siblings need distinct keys, hence the prefixes. */}
      <QuoteBuilder
        key={`builder:${id}:${data.quote.version}`}
        data={data}
        products={products}
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
          key={`upsell:${id}:${data.quote.version}`}
          items={suggestions}
          id={id}
          version={data.quote.version}
          currency={data.quote.currency}
        />
      )}
    </>
  );
}
