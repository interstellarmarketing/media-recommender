'use client';

import React from 'react';
import { CatalogGrid } from '@/components/CatalogGrid';
import { MediaDetailModal } from '@/components/MediaDetailModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StarRating } from '@/components/StarRating';
import type { MediaItem } from '@/types';

interface PersonalCatalogItem extends MediaItem {
  rating?: number;
}

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default function SharedCatalogPage({ params }: PageProps) {
  const [items, setItems] = React.useState<PersonalCatalogItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();
  const [selectedItem, setSelectedItem] = React.useState<PersonalCatalogItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [userName, setUserName] = React.useState<string>('');
  const [userId, setUserId] = React.useState<string>('');

  // Handle params resolution
  React.useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setUserId(resolvedParams.userId);
    };
    resolveParams();
  }, [params]);

  const fetchItems = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      
      const response = await fetch(`/api/catalog/${userId}/items`);
      if (!response.ok) {
        throw new Error('Failed to fetch catalog');
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setItems(data.items);
      setUserName(data.userName || 'User');
    } catch (error) {
      console.error('Error fetching items:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch catalog data
  React.useEffect(() => {
    if (userId) {
      fetchItems();
    }
  }, [userId, fetchItems]);

  // Handle item click
  const handleItemClick = React.useCallback((item: MediaItem) => {
    setSelectedItem(item as PersonalCatalogItem);
    setIsDetailModalOpen(true);
  }, []);

  return (
    <ErrorBoundary>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{userName}&apos;s Media Catalog</h1>
          <p className="mt-2 text-gray-600">
            Browse through {userName}&apos;s personal collection of movies and TV shows
          </p>
        </div>

        {/* Catalog Grid */}
        <CatalogGrid
          items={items}
          loading={loading}
          onItemClick={handleItemClick}
          error={error}
          renderItemExtra={(item) => (
            <div className="mt-2">
              <StarRating
                rating={item.rating}
                readonly
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
              <h3 className="mb-2 text-lg font-semibold">{userName}&apos;s Rating</h3>
              <StarRating
                rating={selectedItem.rating}
                readonly
                size="lg"
              />
            </div>
          )}
        />
      </main>
    </ErrorBoundary>
  );
} 