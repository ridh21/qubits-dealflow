import { notFound } from "next/navigation";
import { NotFound } from "@/domain/errors";
import { portalActor, getMyQuotation } from "@/server/queries/portal";
import { PageHeader } from "@/components/layout/page-header";
import { PortalQuoteWorkspace } from "../../_components/quote-workspace";
export default async function PortalQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await portalActor();
  const result = await getMyQuotation(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  if (result.kind === "REVISING")
    return (
      <PageHeader
        title={result.quote.number}
        description="Your quotation is being revised. We'll notify you when updated terms are ready."
      />
    );
  return (
    <PortalQuoteWorkspace key={result.quote.version} quote={result.quote} />
  );
}
