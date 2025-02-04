'use client';

import React from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { useAuth } from './providers/SupabaseProvider';
import { useLists } from './providers/ListsProvider';
import type { MediaItem, ListItem } from '@/types';

interface AddToListButtonProps {
  item: MediaItem;
  className?: string;
}

export function AddToListButton({ item, className = '' }: AddToListButtonProps) {
  const { user } = useAuth();
  const { lists, updateList } = useLists();
  const [isOpen, setIsOpen] = React.useState(false);
  const [loading, setLoading] = React.useState<string | null>(null);

  const addToList = React.useCallback(async (listId: string) => {
    if (!user) return;
    
    try {
      setLoading(listId);
      // Find the list
      const list = lists.find(l => l.id === listId);
      if (!list) {
        throw new Error('List not found');
      }

      // Don't add if already in list
      if (list.items.some(existing => existing.id === item.id)) {
        alert(`${item.title} is already in ${list.name}`);
        return;
      }

      // Create new list item
      const listItem: ListItem = {
        ...item,
        list_id: listId,
        added_at: new Date().toISOString(),
      };

      // Update the list in the database
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [...list.items, listItem],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update list');
      }

      // Update local state
      updateList(listId, {
        ...list,
        items: [...list.items, listItem],
      });

      alert(`${item.title} has been added to ${list.name}`);
    } catch (error) {
      console.error('Failed to add to list:', error);
      alert(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(null);
      setIsOpen(false);
    }
  }, [user, lists, item, updateList]);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 ${className}`}
      >
        <Plus className="h-4 w-4" />
        Add to List
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="p-1">
            {lists.length === 0 ? (
              <div className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400">
                No lists available
              </div>
            ) : (
              lists.map((list) => {
                const isInList = list.items.some(existing => existing.id === item.id);
                const isLoading = loading === list.id;
                
                return (
                  <button
                    key={list.id}
                    disabled={isInList || isLoading}
                    onClick={() => addToList(list.id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
                  >
                    <span className="truncate">{list.name}</span>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isInList ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
} 