'use client';

import React, { useState } from 'react';
import { Plus, X, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/SupabaseProvider';
import { useLists, type MediaList } from '@/components/providers/ListsProvider';
import type { MediaItem } from '@/types';
import Image from 'next/image';

interface RecommendationResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  media_type: 'movie' | 'tv';
  thematicSimilarity: number;
  count: number;
  genres?: Array<{ id: number; name: string; }>;
}

export function MediaLists() {
  const { user } = useAuth();
  const { lists, loading, error: listsError, updateList } = useLists();
  const [activeList, setActiveList] = useState<MediaList | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [error, setError] = useState('');

  const removeFromList = async (listId: string, itemId: number) => {
    try {
      const list = lists.find(l => l.id === listId);
      if (!list) return;

      const updatedItems = list.items.filter((item: MediaItem) => item.id !== itemId);

      const response = await fetch(`/api/lists/${listId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: updatedItems,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update list');
      }

      const updatedList = await response.json();
      updateList(listId, updatedList);
      
      // Update active list if it's the one being modified
      if (activeList?.id === listId) {
        setActiveList(updatedList);
      }
    } catch (error) {
      console.error('Failed to remove item from list:', error);
    }
  };

  const getRecommendationsForList = async (list: MediaList) => {
    if (list.items.length === 0) {
      setError('This list is empty');
      return;
    }

    try {
      setIsLoadingRecommendations(true);
      setError('');
      
      // Get recommendations for each item in the list
      const recommendations = await Promise.all(
        list.items.map(item => 
          fetch(`/api/recommendations?id=${item.id}&type=${item.type}`)
            .then(res => res.json())
        )
      );
      
      // Merge and deduplicate recommendations
      const merged = recommendations
        .flatMap(r => r.results || [])
        .reduce((acc: RecommendationResult[], curr) => {
          const existing = acc.find(item => item.id === curr.id);
          if (existing) {
            existing.thematicSimilarity = (existing.thematicSimilarity + curr.thematicSimilarity) / 2;
            existing.count++;
          } else {
            // Don't recommend items that are already in the list
            if (!list.items.some(item => item.id === curr.id)) {
              acc.push({
                ...curr,
                count: 1
              });
            }
          }
          return acc;
        }, [])
        .sort((a, b) => {
          // Sort by combination of thematic similarity and how many list items recommended it
          const aScore = (a.thematicSimilarity * 0.7) + (a.count / list.items.length * 0.3);
          const bScore = (b.thematicSimilarity * 0.7) + (b.count / list.items.length * 0.3);
          return bScore - aScore;
        });

      setRecommendations(merged);
    } catch (err) {
      setError('Failed to fetch recommendations');
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const closeModal = () => {
    setActiveList(null);
    setRecommendations([]);
    setError('');
  };

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Media Lists</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : listsError ? (
          <div className="text-red-500 text-center py-4">{listsError}</div>
        ) : lists.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            You haven&apos;t created any lists yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <Card 
                key={list.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setActiveList(list)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{list.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    {list.description || 'No description'}
                  </p>
                  <div className="mt-2 text-sm text-gray-500">
                    <p>{list.items?.length || 0} items</p>
                    <p>
                      Last updated:{' '}
                      {new Date(list.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* List View Modal */}
        {activeList && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row justify-between items-center sticky top-0 bg-white z-10">
                <div>
                  <CardTitle>{activeList.name}</CardTitle>
                  {activeList.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {activeList.description}
                    </p>
                  )}
                  {activeList.items.length > 0 && (
                    <button
                      onClick={() => getRecommendationsForList(activeList)}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors"
                      disabled={isLoadingRecommendations}
                    >
                      <Search size={16} />
                      {isLoadingRecommendations ? 'Getting Recommendations...' : 'Get Recommendations'}
                    </button>
                  )}
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <X size={20} />
                </button>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* List Items Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">List Items</h3>
                    {activeList.items.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        This list is empty. Search for movies or TV shows to add them to this list.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {activeList.items.map((item) => (
                          <div key={item.id} className="relative group">
                            {item.posterPath ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                                alt={item.title || 'Media poster'}
                                width={200}
                                height={300}
                                className="w-full rounded-lg"
                                priority={false}
                              />
                            ) : (
                              <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                                No Image
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromList(activeList.id, item.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-opacity"
                                title="Remove from List"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <p className="mt-2 text-center font-medium truncate">
                              {item.title}
                            </p>
                            <p className="text-center text-sm text-gray-500">
                              {item.type === 'movie' ? 'Movie' : 'TV Show'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recommendations Section */}
                  {recommendations.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Recommendations Based on This List</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {recommendations.map((rec) => (
                          <div key={rec.id} className="relative">
                            {rec.poster_path ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w200${rec.poster_path}`}
                                alt={rec.title || rec.name || 'Media poster'}
                                width={200}
                                height={300}
                                className="w-full rounded-lg"
                                priority={false}
                              />
                            ) : (
                              <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                                No Image
                              </div>
                            )}
                            <div className="mt-2">
                              <p className="font-medium text-center truncate">
                                {rec.title || rec.name}
                              </p>
                              <p className="text-sm text-center text-gray-600">
                                Match: {(rec.thematicSimilarity * 100).toFixed(0)}%
                              </p>
                              <p className="text-xs text-center text-gray-500">
                                {rec.genres?.slice(0, 2).map(g => g.name).join(', ')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 