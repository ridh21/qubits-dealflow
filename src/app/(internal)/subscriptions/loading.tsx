import { PageLoader } from "@/components/layout/loader";

export default function Loading() {
  return (
    <PageLoader
      label="Loading subscriptions"
      description="Reading billing cycles and entitlements."
    />
  );
}
