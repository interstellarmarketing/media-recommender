import React from 'react';
import { Library, Check, Loader2 } from 'lucide-react';
import { useAuth } from './providers/SupabaseProvider';
import type { MediaItem, PersonalCatalogItem } from '@/types';

interface AddToPersonalCatalogButtonProps {
  item: MediaItem;
  className?: string;
}

export function AddToPersonalCatalogButton({ item, className = '' }: AddToPersonalCatalogButtonProps) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [added, setAdded] = React.useState(false);

  const addToCatalog = React.useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);

      // Create personal catalog item
      const personalItem: PersonalCatalogItem = {
        ...item,
        user_id: user.id,
        added_at: new Date().toISOString(),
      };

      const response = await fetch('/api/personal-catalog/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(personalItem),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 400 && data.error === 'Item already in personal catalog') {
          setAdded(true);
          alert(`${item.title} is already in your personal catalog`);
          return;
        }
        throw new Error(data.error || 'Failed to add to personal catalog');
      }

      setAdded(true);
      alert(`${item.title} has been added to your personal catalog`);
    } catch (error) {
      console.error('Failed to add to personal catalog:', error);
      alert(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [user, item]);

  if (!user) return null;

  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 ${className}`}
      onClick={addToCatalog}
      disabled={loading || added}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : added ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Library className="h-4 w-4" />
      )}
      {added ? 'In Catalog' : 'Add to Catalog'}
    </button>
  );
} 