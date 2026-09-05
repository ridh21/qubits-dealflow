import { notFound } from "next/navigation";
import { NotFound } from "@/domain/errors";
import { portalActor, getMySubscription } from "@/server/queries/portal";
import { PortalSubscription } from "../../_components/subscription-workspace";
export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await portalActor();
  const data = await getMySubscription(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  return <PortalSubscription data={data} />;
}
