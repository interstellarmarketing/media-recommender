'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, List, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MediaList, MediaItem } from '@/types';

export function MediaLists() {
  const [lists, setLists] = useState<MediaList[]>([]);
  const [activeList, setActiveList] = useState<MediaList | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  // Load lists from localStorage on mount
  useEffect(() => {
    const savedLists = localStorage.getItem('mediaLists');
    if (savedLists) {
      setLists(JSON.parse(savedLists));
    }
  }, []);

  // Save lists to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('mediaLists', JSON.stringify(lists));
  }, [lists]);

  const createNewList = () => {
    if (!newListName.trim()) return;

    const newList: MediaList = {
      id: Date.now().toString(),
      name: newListName.trim(),
      description: newListDescription.trim() || undefined,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setLists(prev => [...prev, newList]);
    setNewListName('');
    setNewListDescription('');
    setIsCreating(false);
  };

  const deleteList = (listId: string) => {
    setLists(prev => prev.filter(list => list.id !== listId));
    if (activeList?.id === listId) {
      setActiveList(null);
    }
  };

  const addToList = (listId: string, item: MediaItem) => {
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        // Don't add if already in list
        if (list.items.some(existing => existing.id === item.id)) {
          return list;
        }
        return {
          ...list,
          items: [...list.items, item],
          updatedAt: new Date().toISOString()
        };
      }
      return list;
    }));
  };

  const removeFromList = (listId: string, itemId: number) => {
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          items: list.items.filter(item => item.id !== itemId),
          updatedAt: new Date().toISOString()
        };
      }
      return list;
    }));
  };

  const getRecommendationsForList = async (list: MediaList) => {
    if (list.items.length === 0) {
      setError('This list is empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
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
        .reduce((acc, curr) => {
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
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Lists</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded flex items-center gap-2"
        >
          <Plus size={20} />
          Create New List
        </button>
      </div>

      {isCreating && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">List Name</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="e.g., Mystery Shows"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <textarea
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={3}
                  placeholder="What kind of shows/movies belong in this list?"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewList}
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  Create List
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.map(list => (
          <Card key={list.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row justify-between items-start space-y-0 pb-2">
              <CardTitle className="text-xl font-semibold">{list.name}</CardTitle>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveList(list)}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="View List"
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => deleteList(list.id)}
                  className="p-1 hover:bg-gray-100 rounded text-red-500"
                  title="Delete List"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {list.description && (
                <p className="text-sm text-gray-600 mb-2">{list.description}</p>
              )}
              <div className="text-sm text-gray-500">
                <p>{list.items.length} items</p>
                <p>Last updated: {new Date(list.updatedAt).toLocaleDateString()}</p>
              </div>
              {list.items.length > 0 && (
                <button
                  onClick={() => getRecommendationsForList(list)}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded flex items-center gap-2 w-full justify-center"
                  disabled={loading}
                >
                  <Search size={16} />
                  Get Recommendations
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active List Modal */}
      {activeList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader className="flex flex-row justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <CardTitle>{activeList.name}</CardTitle>
                {activeList.items.length > 0 && (
                  <button
                    onClick={() => getRecommendationsForList(activeList)}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded flex items-center gap-2"
                    disabled={loading}
                  >
                    <Search size={16} />
                    Get Recommendations
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setActiveList(null);
                  setRecommendations([]);
                }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                ×
              </button>
            </CardHeader>
            <CardContent>
              {activeList.description && (
                <p className="text-gray-600 mb-4">{activeList.description}</p>
              )}
              
              {/* List Items */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {activeList.items.map(item => (
                  <div key={item.id} className="relative">
                    {item.posterPath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                        alt={item.title}
                        className="w-full rounded"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center">
                        No Image
                      </div>
                    )}
                    <button
                      onClick={() => removeFromList(activeList.id, item.id)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      title="Remove from List"
                    >
                      <Trash2 size={16} />
                    </button>
                    <p className="mt-2 text-center font-medium">{item.title}</p>
                  </div>
                ))}
              </div>

              {/* Recommendations Section */}
              {recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Recommendations Based on This List</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommendations.slice(0, 10).map(rec => (
                      <div key={rec.id} className="flex gap-4 p-4 border rounded">
                        {rec.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w200${rec.poster_path}`}
                            alt={rec.title || rec.name}
                            className="w-24 rounded"
                          />
                        ) : (
                          <div className="w-24 h-36 bg-gray-200 rounded flex items-center justify-center">
                            No Image
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{rec.title || rec.name}</p>
                          <p className="text-sm text-gray-600">
                            Match: {(rec.thematicSimilarity * 100).toFixed(0)}%
                          </p>
                          <p className="text-sm text-gray-600">
                            ({rec.count} items match)
                          </p>
                          {rec.genres && (
                            <p className="text-xs text-gray-600 mt-1">
                              {rec.genres.slice(0, 3).map(g => g.name).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loading && <p className="text-center mt-4">Loading recommendations...</p>}
              {error && <p className="text-center mt-4 text-red-500">{error}</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 