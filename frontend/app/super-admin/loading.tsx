import { PageSkeleton } from "@/components/common/LoadingSkeleton";

/** Route transition placeholder shaped like the page about to render (see `PageSkeleton`). */
export default function SuperAdminLoading() {
  return <PageSkeleton variant="list" />;
}
