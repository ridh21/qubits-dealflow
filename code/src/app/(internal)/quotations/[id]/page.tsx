import { CustomerProposals } from "../_components/customer-proposals";
import { suggestionsFor } from "@/server/services/upsell.service";
import { UpsellPanel } from "../_components/upsell-panel";
import { getQuotation, quotationCatalogue } from "@/server/queries/quotations";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteBuilder } from "../_components/quote-builder";
export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getQuotation(id);
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
      <QuoteBuilder key={data.quote.version} data={data} products={products} />
      <CustomerProposals
        id={id}
        version={data.quote.version}
        status={data.quote.status}
        messages={data.quote.messages}
        canRespond={data.actor.role !== "FINANCE"}
      />
      {["DRAFT", "REVISION_REQUESTED"].includes(data.quote.status) &&
        data.actor.role !== "FINANCE" && (
          <UpsellPanel
            key={data.quote.version}
            items={suggestions}
            id={id}
            version={data.quote.version}
            currency={data.quote.currency}
          />
        )}
    </>
  );
}
