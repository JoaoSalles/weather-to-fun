import { Skeleton } from '~/components/ui/skeleton';

export function RankingSkeleton() {
  return (
    <div className="mt-6 space-y-3" role="status" aria-label="Loading rankings">
      <Skeleton className="h-6 w-40 bg-neutral-300" />
      <Skeleton className="h-20 w-full bg-neutral-300" />
      <Skeleton className="h-20 w-full bg-neutral-300" />
    </div>
  );
}
