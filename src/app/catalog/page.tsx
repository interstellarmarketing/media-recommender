'use client';

import React from 'react';
import { Search, Filter } from 'lucide-react';
import { CatalogGrid } from '@/components/CatalogGrid';
import { MediaDetailModal } from '@/components/MediaDetailModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AddToPersonalCatalogButton } from '@/components/AddToPersonalCatalogButton';
import { isMediaItem, type MediaItem } from '@/types';

interface CatalogPageState {
  items: MediaItem[];
  recommendedIds: Set<number>;
  ratings: Record<number, number>;
  loading: boolean;
  error?: string;
  hasMore: boolean;
  page: number;
  filters: {
    search: string;
    genres: string[];
    recommendedOnly: boolean;
  };
}

export default function CatalogPage() {
  const [state, setState] = React.useState<CatalogPageState>({
    items: [],
    recommendedIds: new Set<number>(),
    ratings: {},
    loading: true,
    hasMore: true,
    page: 1,
    filters: {
      search: '',
      genres: [],
      recommendedOnly: false
    }
  });

  const [selectedItem, setSelectedItem] = React.useState<MediaItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);

  const updateFilters = React.useCallback((updates: Partial<CatalogPageState['filters']>) => {
    setState(prev => ({
      ...prev,
      page: 1,
      items: [],
      filters: { ...prev.filters, ...updates }
    }));
  }, []);

  const fetchItems = React.useCallback(async (retrying: boolean = false) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const queryParams = new URLSearchParams({
        page: state.page.toString(),
        search: state.filters.search,
        genres: state.filters.genres.join(','),
        recommended: state.filters.recommendedOnly.toString(),
      });

      const response = await fetch(`/api/catalog?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch catalog data (${response.status})`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data.items)) {
        throw new Error('Invalid response format from API');
      }

      const validItems = data.items.filter(isMediaItem);
      
      setState(prev => ({
        ...prev,
        items: state.page === 1 ? validItems : [...prev.items, ...validItems],
        recommendedIds: new Set([
          ...Array.from(prev.recommendedIds),
          ...validItems
            .filter((item: MediaItem) => item.isRecommended)
            .map((item: MediaItem) => item.id)
        ]),
        ratings: {
          ...prev.ratings,
          ...Object.fromEntries(
            validItems
              .filter((item: MediaItem) => typeof item.rating === 'number')
              .map((item: MediaItem) => [item.id, item.rating!])
          )
        },
        hasMore: data.hasMore ?? false,
        loading: false,
        error: undefined
      }));

    } catch (error) {
      console.error('Error fetching items:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }));
    }
  }, [state.page, state.filters]);

  // Effect for initial load and filter changes
  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Effect for search debouncing
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateFilters({ search: state.filters.search });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.filters.search, updateFilters]);

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search media..."
              value={state.filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => updateFilters({ recommendedOnly: !state.filters.recommendedOnly })}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                state.filters.recommendedOnly
                  ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="h-4 w-4" />
              Recommended
            </button>
          </div>
        </div>

        <CatalogGrid
          items={state.items}
          recommendedIds={state.recommendedIds}
          ratings={state.ratings}
          loading={state.loading}
          error={state.error}
          hasMore={state.hasMore}
          onLoadMore={() => setState(prev => ({ ...prev, page: prev.page + 1 }))}
          onRetry={() => fetchItems(true)}
          onItemClick={(item) => {
            setSelectedItem(item);
            setIsDetailModalOpen(true);
          }}
          renderItemExtra={(item) => (
            <AddToPersonalCatalogButton item={item} />
          )}
        />

        <MediaDetailModal
          item={selectedItem}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedItem(null);
          }}
        />
      </div>
    </ErrorBoundary>
  );
} 