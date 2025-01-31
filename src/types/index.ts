export interface MediaItem {
  id: number;
  title: string;
  type: 'movie' | 'tv';
  posterPath?: string;
  genres?: Array<{ id: number; name: string; }>;
}

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