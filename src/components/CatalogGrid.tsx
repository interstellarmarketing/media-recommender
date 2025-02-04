import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { CatalogCard } from './CatalogCard';
import { CatalogCardSkeleton } from './CatalogCardSkeleton';
import { ErrorBoundary } from './ErrorBoundary';
import { isMediaItem, type MediaItem } from '@/types';

interface CatalogGridProps {
  items: MediaItem[];
  recommendedIds?: Set<number>;
  ratings?: Record<number, number>;
  onItemClick?: (item: MediaItem) => void;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  error?: string;
  onRetry?: () => void;
  renderItemExtra?: (item: MediaItem) => React.ReactNode;
  isPersonalCatalog?: boolean;
  onDelete?: (item: MediaItem) => void;
  deletingItems?: Set<number>;
}

function GridError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="col-span-full flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/20 dark:bg-red-900/10">
      <AlertCircle className="mb-2 h-8 w-8 text-red-500" />
      <h3 className="mb-1 text-lg font-semibold text-red-900 dark:text-red-200">
        Failed to load media
      </h3>
      <p className="mb-4 text-sm text-red-600 dark:text-red-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-200 dark:hover:bg-red-900/30"
        >
          <RefreshCcw className="h-4 w-4" />
          Try Again
        </button>
      )}
    </div>
  );
}

export function CatalogGrid({
  items,
  recommendedIds = new Set(),
  ratings = {},
  onItemClick,
  loading = false,
  onLoadMore,
  hasMore = false,
  error,
  onRetry,
  renderItemExtra,
  isPersonalCatalog = false,
  onDelete,
  deletingItems = new Set()
}: CatalogGridProps) {
  const isItemRecommended = React.useCallback(
    (item: MediaItem) => recommendedIds.has(item.id),
    [recommendedIds]
  );

  // Validate items before rendering
  const validItems = React.useMemo(() => 
    items.filter(isMediaItem),
    [items]
  );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {validItems.map((item) => (
        <CatalogCard
          key={item.id}
          item={item}
          isRecommended={isItemRecommended(item)}
          rating={ratings[item.id]}
          onDetailsClick={() => onItemClick?.(item)}
          extra={renderItemExtra?.(item)}
          isPersonalCatalog={isPersonalCatalog}
          onDelete={onDelete ? () => onDelete(item) : undefined}
          disabled={deletingItems?.has(item.id)}
        />
      ))}
      
      {loading && Array.from({ length: 5 }).map((_, i) => (
        <CatalogCardSkeleton key={i} />
      ))}
      
      {error && (
        <GridError message={error} onRetry={onRetry} />
      )}
      
      {hasMore && !loading && !error && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="col-span-full mt-4 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/30"
        >
          Load More
        </button>
      )}
    </div>
  );
} 