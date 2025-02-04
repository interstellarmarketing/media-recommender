import type { MediaItem } from '@/types';
import type { FilterState } from '@/components/FilterMenu';

export function sortItems(items: MediaItem[], sortBy: FilterState['sortBy']): MediaItem[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'rating-desc':
        return ((b.rating ?? 0) - (a.rating ?? 0));
      case 'rating-asc':
        return ((a.rating ?? 0) - (b.rating ?? 0));
      case 'title-asc':
        return a.title.localeCompare(b.title);
      case 'title-desc':
        return b.title.localeCompare(a.title);
      case 'date-desc':
        const dateA = a.added_at ? new Date(a.added_at).getTime() : 0;
        const dateB = b.added_at ? new Date(b.added_at).getTime() : 0;
        return dateB - dateA;
      default:
        return 0;
    }
  });
}

export function filterItems(items: MediaItem[], filters: FilterState): MediaItem[] {
  return items.filter(item => {
    // Filter by media type
    if (filters.mediaType !== 'all' && item.type !== filters.mediaType) {
      return false;
    }

    // Filter by minimum rating
    if (filters.minRating !== null && (item.rating ?? 0) < filters.minRating) {
      return false;
    }

    // Filter by genres
    if (filters.genres.length > 0) {
      const itemGenres = item.genres?.map(g => g.name) ?? [];
      if (!filters.genres.some(genre => itemGenres.includes(genre))) {
        return false;
      }
    }

    // Filter by content rating
    if (filters.contentRating !== null && item.contentRating !== filters.contentRating) {
      return false;
    }

    return true;
  });
}

export function getAvailableGenres(items: MediaItem[]): string[] {
  const genreSet = new Set<string>();
  
  items.forEach(item => {
    item.genres?.forEach(genre => {
      genreSet.add(genre.name);
    });
  });

  return Array.from(genreSet).sort();
} 