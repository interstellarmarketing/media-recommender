'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './SupabaseProvider';

export interface MediaList {
  id: string;
  name: string;
  description: string | null;
  items: any[];
  createdAt: string;
  updatedAt: string;
}

interface ListsContextType {
  lists: MediaList[];
  loading: boolean;
  error: string | null;
  refreshLists: () => Promise<void>;
  updateList: (listId: string, updatedList: MediaList) => void;
}

const ListsContext = createContext<ListsContextType | undefined>(undefined);

export function ListsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [lists, setLists] = useState<MediaList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 30000; // 30 seconds cache

  const fetchLists = useCallback(async (force: boolean = false) => {
    // If not forced and within cache duration, skip fetch
    if (!force && Date.now() - lastFetchTime < CACHE_DURATION) {
      return;
    }

    if (!user?.id) {
      setLists([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/lists');
      if (!response.ok) {
        throw new Error('Failed to fetch lists');
      }
      const data = await response.json();
      setLists(data);
      setLastFetchTime(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lists');
    } finally {
      setLoading(false);
    }
  }, [user?.id, lastFetchTime]);

  // Fetch lists when user changes or force refresh
  useEffect(() => {
    fetchLists();
  }, [user?.id, fetchLists]);

  const refreshLists = useCallback(async () => {
    await fetchLists(true);
  }, [fetchLists]);

  const updateList = useCallback((listId: string, updatedList: MediaList) => {
    setLists(prev => prev.map(list => list.id === listId ? updatedList : list));
  }, []);

  const value = {
    lists,
    loading,
    error,
    refreshLists,
    updateList,
  };

  return (
    <ListsContext.Provider value={value}>
      {children}
    </ListsContext.Provider>
  );
}

export function useLists() {
  const context = useContext(ListsContext);
  if (context === undefined) {
    throw new Error('useLists must be used within a ListsProvider');
  }
  return context;
} 