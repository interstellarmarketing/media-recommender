import React from 'react';
import { X, Star, ExternalLink, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { isRecommendedItem, type MediaItem } from '@/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { AddToListButton } from './AddToListButton';
import { AddToPersonalCatalogButton } from './AddToPersonalCatalogButton';

interface MediaDetailModalProps {
  item: MediaItem | null;
  isOpen: boolean;
  onClose: () => void;
  extraContent?: React.ReactNode;
}

interface DetailData extends MediaItem {
  overview?: string;
  releaseDate?: string;
  runtime?: number;
  cast?: Array<{ id: number; name: string; character: string }>;
  watchProviders?: Array<{ id: number; name: string; logo_path: string }>;
  trailerKey?: string;
  genres?: Array<{ id: number; name: string }>;
}

export function MediaDetailModal({ item, isOpen, onClose, extraContent }: MediaDetailModalProps) {
  const [detailData, setDetailData] = React.useState<DetailData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasDetails = React.useMemo(() => {
    return !!(
      item &&
      item.overview &&
      item.genres &&
      item.watchProviders
    );
  }, [item]);

  const fetchDetails = React.useCallback(async () => {
    if (!item) return;

    // If the item already has all the necessary data, use it directly
    if (hasDetails) {
      setDetailData({
        ...item,
        watchProviders: item.watchProviders
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/details/${item.type}/${item.id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch details (${response.status})`);
      }

      const data = await response.json();
      setDetailData({ ...item, ...data });
    } catch (error) {
      console.error('Error fetching details:', error);
      setError(error instanceof Error ? error.message : 'Failed to load details');
    } finally {
      setLoading(false);
    }
  }, [item, hasDetails]);

  // Fetch additional details when item changes
  React.useEffect(() => {
    if (item) {
      fetchDetails();
    } else {
      setDetailData(null);
      setError(null);
    }
  }, [item, fetchDetails]);

  if (!item) return null;

  const recommendationInfo = isRecommendedItem(item) ? (
    <div className="mb-4 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
      <h4 className="mb-2 font-medium text-green-900 dark:text-green-100">
        Recommendation Details
      </h4>
      <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
        <p>Score: {Math.round(item.recommendationScore * 100)}%</p>
        {item.thematicSimilarity && (
          <p>Thematic Similarity: {Math.round(item.thematicSimilarity * 100)}%</p>
        )}
        <p>Source: {item.recommendationSource}</p>
      </div>
    </div>
  ) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{item.title}</DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="mt-4">
            <div className="grid gap-6 sm:grid-cols-[200px,1fr]">
              {/* Poster */}
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg sm:max-w-[200px]">
                <ImageWithFallback
                  src={item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : '/placeholder.png'}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Details */}
              <div className="space-y-4">
                {recommendationInfo}

                {/* Genres */}
                {detailData?.genres && detailData.genres.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-medium">Genres</h4>
                    <div className="flex flex-wrap gap-2">
                      {detailData.genres.map((genre) => (
                        <Badge
                          key={genre.id}
                          variant="secondary"
                          className="rounded-full"
                        >
                          {genre.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overview */}
                {detailData?.overview && (
                  <div>
                    <h4 className="mb-2 font-medium">Overview</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {detailData.overview}
                    </p>
                  </div>
                )}

                {/* Watch Providers */}
                {detailData?.watchProviders && detailData.watchProviders.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-medium">Available on</h4>
                    <div className="flex flex-wrap gap-2">
                      {detailData.watchProviders.map((provider) => (
                        <div
                          key={provider.id}
                          className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800"
                        >
                          <div className="h-6 w-6 overflow-hidden rounded-full bg-white">
                            <ImageWithFallback
                              src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                              alt={provider.name}
                              width={24}
                              height={24}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span>{provider.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cast */}
                {detailData?.cast && detailData.cast.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-medium">Cast</h4>
                    <div className="flex flex-wrap gap-2">
                      {detailData.cast.slice(0, 5).map((person) => (
                        <span
                          key={person.id}
                          className="rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800"
                        >
                          {person.name} as {person.character}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra Content */}
                {extraContent && (
                  <div className="mt-6 border-t pt-4 dark:border-gray-800">
                    {extraContent}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 