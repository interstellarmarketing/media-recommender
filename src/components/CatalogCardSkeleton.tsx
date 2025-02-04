import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function CatalogCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Poster Skeleton */}
        <div className="relative aspect-[2/3] w-full animate-pulse bg-gray-200 dark:bg-gray-800">
          {/* Provider Icons Skeleton */}
          <div className="absolute left-2 top-2 flex gap-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-700"
              />
            ))}
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="p-3 space-y-3">
          {/* Title Skeleton */}
          <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />

          {/* Rating Skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </div>

          {/* Genre Tags Skeleton */}
          <div className="flex gap-1">
            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 