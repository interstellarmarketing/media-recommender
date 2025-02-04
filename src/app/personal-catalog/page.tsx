'use client';

import React from 'react';
import { AlertCircle, Share2 } from 'lucide-react';
import { CatalogGrid } from '@/components/CatalogGrid';
import { MediaDetailModal } from '@/components/MediaDetailModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StarRating } from '@/components/StarRating';
import { useAuth } from '@/components/providers/SupabaseProvider';
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { FilterMenu, type FilterState } from '@/components/FilterMenu';
import { filterItems, sortItems, getAvailableGenres } from '@/lib/filter-utils';
import type { MediaItem } from '@/types';

interface PersonalCatalogItem extends MediaItem {
  rating?: number;
}

interface FailedItem {
  title: string;
  error: string;
}

export default function PersonalCatalogPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = React.useState<PersonalCatalogItem[]>([]);
  const [failedItems, setFailedItems] = React.useState<FailedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();
  const [selectedItem, setSelectedItem] = React.useState<PersonalCatalogItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [showFailedItems, setShowFailedItems] = React.useState(false);
  const [deletingItems, setDeletingItems] = React.useState<Set<number>>(new Set());
  
  // Filter state
  const [filters, setFilters] = React.useState<FilterState>({
    sortBy: 'date-desc',
    genres: [],
    mediaType: 'all',
    minRating: null,
    contentRating: null
  });

  // Fetch personal catalog data
  React.useEffect(() => {
    if (user) {
      fetchItems();
    }
  }, [user]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(undefined);
      setFailedItems([]);
      
      const response = await fetch('/api/personal-catalog/items');
      if (!response.ok) {
        throw new Error('Failed to fetch personal catalog');
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setItems(data.items);
    } catch (error) {
      console.error('Error fetching items:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and sorting
  const filteredAndSortedItems = React.useMemo(() => {
    const filtered = filterItems(items, filters);
    return sortItems(filtered, filters.sortBy);
  }, [items, filters]);

  // Get available genres
  const availableGenres = React.useMemo(() => 
    getAvailableGenres(items),
    [items]
  );

  const handleDelete = async (item: MediaItem) => {
    try {
      setDeletingItems(prev => new Set([...prev, item.id]));
      
      const response = await fetch(`/api/personal-catalog/items?mediaId=${item.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      setItems(prev => prev.filter(i => i.id !== item.id));

      toast({
        title: "Item removed",
        description: `${item.title} has been removed from your catalog`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndoDelete(item)}>
            Undo
          </ToastAction>
        ),
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to remove item from catalog",
        variant: "destructive",
      });
    } finally {
      setDeletingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleUndoDelete = async (item: MediaItem) => {
    try {
      setDeletingItems(prev => new Set([...prev, item.id]));
      
      const response = await fetch(`/api/personal-catalog/items?mediaId=${item.id}`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to restore item');
      }

      setItems(prev => [...prev, item as PersonalCatalogItem]);

      toast({
        title: "Item restored",
        description: `${item.title} has been restored to your catalog`,
      });
    } catch (error) {
      console.error('Error restoring item:', error);
      toast({
        title: "Error",
        description: "Failed to restore item to catalog",
        variant: "destructive",
      });
    } finally {
      setDeletingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleRate = async (itemId: string, rating: number) => {
    try {
      const response = await fetch(`/api/personal-catalog/items/${itemId}/rate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating }),
      });

      if (!response.ok) {
        throw new Error('Failed to update rating');
      }

      const updatedItem = await response.json();
      setItems(prev => prev.map(item => 
        item.id === updatedItem.id ? { ...item, rating: updatedItem.rating } : item
      ));
    } catch (error) {
      console.error('Error updating rating:', error);
      toast({
        title: "Error",
        description: "Failed to update rating",
        variant: "destructive",
      });
    }
  };

  const handleItemClick = (item: MediaItem) => {
    setSelectedItem(item as PersonalCatalogItem);
    setIsDetailModalOpen(true);
  };

  const handleShare = async () => {
    if (!user) return;

    const shareUrl = `${window.location.origin}/catalog/${user.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Media Catalog',
          text: 'Check out my personal media catalog!',
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Success",
        description: "Share link copied to clipboard!",
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error",
        description: "Failed to copy share link",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-900" />
            <p className="text-sm text-yellow-900">
              Please sign in to view your personal catalog.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">My Media Catalog</h1>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Share2 className="h-4 w-4" />
              Share Catalog
            </button>
          </div>
          <p className="mt-2 text-muted-foreground">
            Manage and organize your personal collection of movies and TV shows
          </p>
        </div>

        {/* Filter Menu */}
        <FilterMenu
          filters={filters}
          onFilterChange={setFilters}
          availableGenres={availableGenres}
        />

        {/* Failed Items Warning */}
        {failedItems.length > 0 && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-900" />
                <p className="text-sm text-yellow-900">
                  {failedItems.length} items failed to load
                </p>
              </div>
              <button
                onClick={() => setShowFailedItems(!showFailedItems)}
                className="text-sm text-yellow-900 hover:underline"
              >
                {showFailedItems ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            {showFailedItems && (
              <ul className="mt-2 list-inside list-disc space-y-1">
                {failedItems.map((item, index) => (
                  <li key={index} className="text-sm text-yellow-900">
                    {item.title}: {item.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Catalog Grid */}
        <CatalogGrid
          items={filteredAndSortedItems}
          loading={loading}
          error={error}
          onItemClick={handleItemClick}
          isPersonalCatalog={true}
          onDelete={handleDelete}
          deletingItems={deletingItems}
          renderItemExtra={(item) => (
            <div className="mt-2">
              <StarRating
                rating={item.rating}
                onRate={(rating) => handleRate(item.id.toString(), rating)}
                size="sm"
              />
            </div>
          )}
        />

        {/* Detail Modal */}
        <MediaDetailModal
          item={selectedItem}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedItem(null);
          }}
          extraContent={selectedItem?.rating !== undefined && (
            <div className="mt-4">
              <h3 className="mb-2 text-lg font-semibold">Your Rating</h3>
              <StarRating
                rating={selectedItem.rating}
                onRate={(rating) => handleRate(selectedItem.id.toString(), rating)}
                size="lg"
              />
            </div>
          )}
        />
      </main>
    </ErrorBoundary>
  );
} 