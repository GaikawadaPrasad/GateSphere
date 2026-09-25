import { PageSkeleton } from "@/components/common/LoadingSkeleton";

/** Route transition placeholder shaped like the page about to render (see `PageSkeleton`). */
export default function FacilityManagerLoading() {
  return <PageSkeleton variant="list" />;
}
