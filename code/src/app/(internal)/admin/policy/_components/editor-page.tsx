import { PageHeader } from "@/components/layout/page-header";
import { getPolicyEditorData } from "@/server/queries/policy";
import {
  POLICY_DEFAULTS,
  POLICY_META,
  canPublishPolicy,
  type PolicyKind,
} from "@/domain/policy/schemas";
import { PolicyEditor } from "./policy-editor";
export async function EditorPage({ kind }: { kind: PolicyKind }) {
  const { actor, active, categories, products, pendingCount } =
    await getPolicyEditorData(kind);
  const initial = active?.payload ?? structuredClone(POLICY_DEFAULTS[kind]);
  return (
    <>
      <PageHeader
        title={POLICY_META[kind].title}
        description={POLICY_META[kind].description}
      />
      <PolicyEditor
        key={active?.id ?? kind}
        kind={kind}
        initial={initial}
        activeId={active?.id ?? null}
        version={active?.version ?? 0}
        editable={canPublishPolicy(actor.role, kind)}
        categories={categories}
        products={products}
        pendingCount={pendingCount}
      />
    </>
  );
}
