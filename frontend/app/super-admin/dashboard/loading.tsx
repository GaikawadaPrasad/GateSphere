import { PageSkeleton } from "@/components/common/LoadingSkeleton";

/** Route transition placeholder shaped like the page about to render (see `PageSkeleton`). */
export default function SuperAdminDashboardLoading() {
  return <PageSkeleton variant="dashboard" />;
}
