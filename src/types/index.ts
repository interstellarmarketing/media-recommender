// Base types for external data
export interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  genres?: Array<{ id: number; name: string }>;
  overview?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

// Core media item type
export interface BaseMediaItem {
  id: number;
  title: string;
  type: 'movie' | 'tv';
  posterPath?: string;
  genres?: Array<{ id: number; name: string }>;
}

// Extended media item with optional fields
export interface MediaItem extends BaseMediaItem {
  contentRating?: string;
  rating?: number;
  isRecommended?: boolean;
  watchProviders?: Array<{
    id: number;
    name: string;
    logo_path: string;
  }>;
  overview?: string;
  voteAverage?: number;
  releaseDate?: string;
  added_at?: string;
}

// Personal catalog specific type
export interface PersonalCatalogItem extends MediaItem {
  user_id: string;
  added_at: string;
  rating?: number;
}

// List specific type
export interface ListItem extends MediaItem {
  list_id: string;
  added_at: string;
}

// Recommendation specific type
export interface RecommendedItem extends MediaItem {
  recommendationSource: string;
  recommendationScore: number;
  thematicSimilarity?: number;
}

// Type guards
export const isMediaItem = (item: any): item is MediaItem => {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof item.id === 'number' &&
    typeof item.title === 'string' &&
    (item.type === 'movie' || item.type === 'tv')
  );
};

export const isRecommendedItem = (item: MediaItem): item is RecommendedItem => {
  return (
    'recommendationSource' in item &&
    'recommendationScore' in item &&
    typeof item.recommendationScore === 'number'
  );
};

export interface MediaList {
  id: string;
  name: string;
  description?: string;
  items: MediaItem[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  lists: MediaList[];
  watchedItems: MediaItem[];
  excludedItems: MediaItem[];
}

export interface ListSummary {
  id: string;
  name: string;
  itemCount: number;
  lastUpdated: string;
}

export interface TMDBRecommendation {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string;
  genres?: Array<{ id: number; name: string; }>;
  keywords?: Array<{ id: number; name: string; }>;
}

export const MOVIE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'] as const;
export const TV_RATINGS = ['TV-Y', 'TV-Y7', 'TV-PG', 'TV-14', 'TV-MA'] as const;

export type ContentRating = typeof MOVIE_RATINGS[number] | typeof TV_RATINGS[number]; 