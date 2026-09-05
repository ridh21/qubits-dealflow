import { notFound } from "next/navigation";
import { NotFound } from "@/domain/errors";
import {
  getPlanEditorData,
  listPlanNoticeHistory,
} from "@/server/queries/plans";
import { PlanEditor } from "../_components/plan-editor";

export const metadata = { title: "Plan catalogue · Admin" };

export default async function ProductPlansPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const [data, history] = await Promise.all([
    getPlanEditorData(productId),
    listPlanNoticeHistory(productId),
  ]).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  return <PlanEditor data={data} history={history} />;
}
