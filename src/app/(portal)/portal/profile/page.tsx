import { PageHeader } from "@/components/layout/page-header";
import { portalActor, getMyProfile } from "@/server/queries/portal";
export default async function ProfilePage() {
  const profile = await getMyProfile(await portalActor());
  return (
    <>
      <PageHeader
        title="My profile"
        description="Contact your account representative to update your company details."
      />
      <dl className="grid max-w-xl grid-cols-2 gap-4 rounded-xl border p-6">
        <dt>Name</dt>
        <dd>{profile.name}</dd>
        <dt>Email</dt>
        <dd>{profile.email}</dd>
        <dt>Company</dt>
        <dd>{profile.customer.name}</dd>
        <dt>Billing address</dt>
        <dd className="whitespace-pre-wrap">
          {profile.customer.billingAddress ?? "Not provided"}
        </dd>
      </dl>
    </>
  );
}
