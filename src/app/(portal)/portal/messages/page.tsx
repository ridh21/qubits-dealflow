import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { portalActor, listMyMessages } from "@/server/queries/portal";
export default async function MessagesPage() {
  const rows = await listMyMessages(await portalActor());
  return (
    <>
      <PageHeader
        title="Messages"
        description="Your quotation conversations."
      />
      <div className="space-y-4">
        {rows.map((m) => (
          <article key={m.id} className="space-y-2 rounded-lg border p-4">
            <Link
              className="text-primary"
              href={`/portal/quotations/${m.quotationId}`}
            >
              {m.quotation.number} · v{m.quotationVersion}
            </Link>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className="text-xs text-muted-foreground">
              {m.author.toLowerCase()} · {m.status.toLowerCase()}
            </p>
          </article>
        ))}
        {!rows.length && <p>No messages yet.</p>}
      </div>
    </>
  );
}
