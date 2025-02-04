'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/SupabaseProvider';
import { useLists } from '@/components/providers/ListsProvider';
import type { MediaItem, ContentRating } from '@/types';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { AddToListButton } from '@/components/AddToListButton';
import { RatingFilter } from './RatingFilter';
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface SearchResult extends MediaItem {
  media_type: 'movie' | 'tv';
  name?: string;
  poster_path?: string;
}

interface RecommendationResult extends SearchResult {
  thematicSimilarity: number;
  count: number;
  keywords?: Array<{ id: number; name: string; }>;
  recommendationSource: string;
  recommendationDetails: {
    source: string;
    weightedScore: number;
    totalWeight: number;
    normalizedScore: number;
  };
  contentRating?: ContentRating;
}

export function MediaRecommender() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState<Set<ContentRating>>(new Set());
  const [unfilteredRecommendations, setUnfilteredRecommendations] = useState<RecommendationResult[]>([]);
  const { toast } = useToast();
  const [deletingItems, setDeletingItems] = useState<Set<number>>(new Set());

  // Load favorites from localStorage on component mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`/api/search?query=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      setError('Failed to search');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkInput.trim()) return;
    
    try {
      setLoading(true);
      setError('');
      
      // Split input by newlines and filter empty lines
      const titles = bulkInput.split('\n').filter(title => title.trim());
      
      // Search for each title
      const searchPromises = titles.map(title =>
        fetch(`/api/search?query=${encodeURIComponent(title.trim())}`)
          .then(res => res.json())
      );
      
      const searchResults = await Promise.all(searchPromises);
      
      // Get the first result for each search
      const firstResults = searchResults
        .map(result => result.results?.[0])
        .filter((result): result is SearchResult => 
          result !== undefined && !favorites.some(fav => fav.id === result.id)
        );

      // Fetch details for each result
      const detailsPromises = firstResults.map(result =>
        fetch(`/api/details?id=${result.id}&type=${result.media_type}`)
          .then(res => res.json())
      );

      const details = await Promise.all(detailsPromises);
      
      // Create new favorites with genre information
      const newFavorites = firstResults.map((result, index) => ({
        id: result.id,
        title: result.title || result.name || '',
        type: result.media_type,
        posterPath: result.poster_path,
        genres: details[index].genres || []
      }));
      
      setFavorites(prev => [...prev, ...newFavorites]);
      setBulkInput(''); // Clear bulk input
      setIsBulkMode(false); // Exit bulk mode
    } catch (err) {
      setError('Failed to add some titles');
    } finally {
      setLoading(false);
    }
  };

  const addToFavorites = async (result: SearchResult) => {
    try {
      // Fetch detailed information including genres
      const response = await fetch(`/api/details?id=${result.id}&type=${result.media_type}`);
      const details = await response.json();
      
      const newFavorite: MediaItem = {
        id: result.id,
        title: result.title || result.name || '',
        type: result.media_type,
        posterPath: result.poster_path,
        genres: details.genres || []
      };
      
      // Check if already in favorites
      if (!favorites.some(fav => fav.id === newFavorite.id)) {
        setFavorites(prev => [...prev, newFavorite]);
        // Clear search results after adding to favorites
        setSearchResults([]);
        setSearchTerm('');
      }
    } catch (err) {
      setError('Failed to add to favorites');
    }
  };

  const removeFromFavorites = (id: number) => {
    setFavorites(prev => prev.filter(fav => fav.id !== id));
  };

  const getRecommendations = async () => {
    if (favorites.length === 0) {
      setError('Please add some favorites first');
      return;
    }

    try {
      setLoading(true);
      setError('');
      console.log('\n=== FETCHING RECOMMENDATIONS ===');
      console.log('Getting recommendations for favorites:', favorites.map(f => ({
        id: f.id,
        title: f.title,
        type: f.type
      })));

      const recommendations = await Promise.all(
        favorites.map(async favorite => {
          console.log(`\nFetching recommendations for: ${favorite.title}`);
          console.log('Show details:', {
            id: favorite.id,
            type: favorite.type,
            title: favorite.title
          });
          const response = await fetch(`/api/recommendations?id=${favorite.id}&type=${favorite.type}&skipCache=true`);
          const data = await response.json();
          
          // Enhanced TMDB data logging
          console.log('\n==========================================');
          console.log(`🎬 TMDB DATA FOR: ${favorite.title.toUpperCase()} 🎬`);
          console.log('==========================================');
          
          // Log complete API response
          console.log('\n=== COMPLETE API RESPONSE ===');
          console.log(JSON.stringify({
            sourceDetails: data.debug?.sourceDetails,
            tmdbData: data.debug?.tmdbData,
            results: data.results?.length
          }, null, 2));
          
          // Log source details
          if (data.debug?.sourceDetails) {
            console.log('\n=== SOURCE DETAILS ===');
            console.log(JSON.stringify(data.debug.sourceDetails, null, 2));
          }
          
          // Log TMDB recommendations
          if (data.debug?.tmdbData) {
            console.log('\n=== TMDB RECOMMENDATIONS ===');
            console.log(JSON.stringify({
              directRecommendations: data.debug.tmdbData.directRecommendations,
              similarItems: data.debug.tmdbData.similarItems
            }, null, 2));
          }
          
          // Log processed recommendations
          console.log('\n=== PROCESSED RECOMMENDATIONS ===');
          console.log(JSON.stringify({
            totalResults: data.results?.length,
            topScores: data.results?.slice(0, 5).map((r: RecommendationResult) => ({
              title: r.title || r.name,
              score: r.thematicSimilarity,
              source: r.recommendationSource
            }))
          }, null, 2));
          
          return data;
        })
      );
      
      // Fetch missing poster paths
      const allResults = recommendations.flatMap(r => r.results || []);
      console.log('\n=== PROCESSING RESULTS ===');
      console.log('Total recommendations received:', allResults.length);
      
      const resultsWithoutPosters = allResults.filter(r => !r.poster_path);
      console.log('Items missing posters:', resultsWithoutPosters.length);
      
      // Fetch details for items missing posters
      const detailsPromises = resultsWithoutPosters.map(item => 
        fetch(`/api/details?id=${item.id}&type=${item.media_type || 'tv'}`)
          .then(res => res.json())
      );
      
      const details = await Promise.all(detailsPromises);
      
      // Update items with their poster paths
      resultsWithoutPosters.forEach((item, index) => {
        const detail = details[index];
        if (detail && detail.poster_path) {
          item.poster_path = detail.poster_path;
        }
      });
      
      console.log('\n=== MERGING RECOMMENDATIONS ===');
      // Merge and deduplicate recommendations
      const merged = recommendations
        .flatMap(r => r.results || [])
        .reduce<RecommendationResult[]>((acc, curr) => {
          const existing = acc.find(item => item.id === curr.id);
          if (existing) {
            // Average the thematic similarities and increment count
            const newSimilarity = (existing.thematicSimilarity + curr.thematicSimilarity) / 2;
            console.log(`Duplicate found: ${curr.title || curr.name}`, {
              previousScore: existing.thematicSimilarity,
              newScore: curr.thematicSimilarity,
              averagedScore: newSimilarity,
              previousCount: existing.count,
              newCount: existing.count + 1
            });
            existing.thematicSimilarity = newSimilarity;
            existing.count++;
            // Collect genres and keywords for better explanation
            existing.genres = Array.from(new Set([...(existing.genres || []), ...(curr.genres || [])]));
            existing.keywords = Array.from(new Set([...(existing.keywords || []), ...(curr.keywords || [])]));
            // Preserve poster_path if the current item has one
            if (curr.poster_path) {
              existing.poster_path = curr.poster_path;
            }
          } else {
            acc.push({
              ...curr,
              count: 1,
              genres: curr.genres || [],
              keywords: curr.keywords || [],
              recommendationSource: curr.recommendationSource || 'similar',
              recommendationDetails: curr.recommendationDetails || {
                source: curr.recommendationSource || 'similar',
                weightedScore: curr.thematicSimilarity,
                totalWeight: 1,
                normalizedScore: curr.thematicSimilarity
              }
            });
          }
          return acc;
        }, [])
        .sort((a, b) => {
          // Sort by combination of thematic similarity and recommendation count
          const aScore = (a.thematicSimilarity * 0.7) + (a.count / favorites.length * 0.3);
          const bScore = (b.thematicSimilarity * 0.7) + (b.count / favorites.length * 0.3);
          return bScore - aScore;
        });

      console.log('\n=== FINAL MERGED RECOMMENDATIONS ===');
      console.log('Top recommendations:', merged.slice(0, 10).map(rec => ({
        title: rec.title || rec.name,
        finalScore: (rec.thematicSimilarity * 0.7) + (rec.count / favorites.length * 0.3),
        thematicSimilarity: rec.thematicSimilarity,
        count: rec.count,
        source: rec.recommendationSource,
        genres: rec.genres?.map(g => g.name)
      })));

      // Store both filtered and unfiltered recommendations
      setUnfilteredRecommendations(merged);
      setRecommendations(filterRecommendationsByRating(merged, selectedRatings));
    } catch (err) {
      setError('Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  // Filter recommendations when ratings selection changes
  const handleRatingChange = (newSelectedRatings: Set<ContentRating>) => {
    setSelectedRatings(newSelectedRatings);
    setRecommendations(filterRecommendationsByRating(unfilteredRecommendations, newSelectedRatings));
  };

  // Helper function to filter recommendations by rating
  const filterRecommendationsByRating = (recs: RecommendationResult[], ratings: Set<ContentRating>) => {
    if (ratings.size === 0) return recs; // If no ratings selected, show all
    return recs.filter(rec => rec.contentRating && ratings.has(rec.contentRating as ContentRating));
  };

  const clearCache = async () => {
    try {
      setIsClearing(true);
      const response = await fetch('/api/clear-cache', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setRecommendations([]);  // Clear current recommendations
        alert('Cache cleared successfully');
      } else {
        throw new Error(data.error || 'Failed to clear cache');
      }
    } catch (err) {
      console.error('Failed to clear cache:', err);
      alert('Failed to clear cache');
    } finally {
      setIsClearing(false);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    try {
      // Add item to deleting state
      setDeletingItems(prev => new Set([...prev, item.id]));
      
      // Call the delete API
      const response = await fetch(`/api/personal-catalog/items?mediaId=${item.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      // Remove from favorites
      setFavorites(prev => prev.filter(fav => fav.id !== item.id));

      // Show toast with undo option
      toast({
        title: "Item removed",
        description: `${item.title} has been removed from your catalog`,
        action: (
          <ToastAction altText="Undo" onClick={() => handleUndoDelete(item)}>
            Undo
          </ToastAction>
        ),
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to remove item from catalog",
        variant: "destructive",
      });
    } finally {
      // Remove item from deleting state
      setDeletingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleUndoDelete = async (item: MediaItem) => {
    try {
      // Add item back to deleting state while restoring
      setDeletingItems(prev => new Set([...prev, item.id]));
      
      // Call the restore API
      const response = await fetch(`/api/personal-catalog/items?mediaId=${item.id}`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to restore item');
      }

      // Add back to favorites
      setFavorites(prev => [...prev, item]);

      toast({
        title: "Item restored",
        description: `${item.title} has been restored to your catalog`,
      });
    } catch (error) {
      console.error('Error restoring item:', error);
      toast({
        title: "Error",
        description: "Failed to restore item to catalog",
        variant: "destructive",
      });
    } finally {
      // Remove item from deleting state
      setDeletingItems(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Media Recommender</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <button
              className="px-4 py-2 bg-gray-500 text-white rounded"
              onClick={() => setIsBulkMode(!isBulkMode)}
            >
              {isBulkMode ? 'Single Search' : 'Bulk Add'}
            </button>
            <button
              className="px-4 py-2 bg-red-500 text-white rounded flex items-center gap-2 hover:bg-red-600"
              onClick={clearCache}
              disabled={isClearing}
            >
              {isClearing ? 'Clearing...' : 'Clear Cache'}
            </button>
            {isBulkMode ? (
              <div className="flex-1 flex gap-4">
                <textarea
                  className="flex-1 p-2 border rounded"
                  placeholder="Enter multiple titles (one per line)..."
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  rows={4}
                />
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded flex items-center gap-2"
                  onClick={handleBulkAdd}
                  disabled={loading}
                >
                  <Plus size={20} />
                  Add All
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="flex-1 p-2 border rounded"
                  placeholder="Search for a movie or TV show..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded flex items-center gap-2"
                  onClick={handleSearch}
                  disabled={loading}
                >
                  <Search size={20} />
                  Search
                </button>
              </>
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Search Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {searchResults.map(result => (
                  <div key={result.id} className="p-2 border rounded relative">
                    {result.poster_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w200${result.poster_path}`}
                        alt={result.title || result.name || 'Media poster'}
                        width={200}
                        height={300}
                        className="w-full rounded"
                        priority={false}
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center">
                        No Image
                      </div>
                    )}
                    <p className="mt-2 text-center font-medium">{result.title || result.name}</p>
                    <button
                      onClick={() => addToFavorites(result)}
                      className="absolute top-2 right-2 p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                      title="Add to Favorites"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Favorites Section */}
          {favorites.length > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">My Favorites</h3>
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded flex items-center gap-2"
                  onClick={getRecommendations}
                  disabled={loading}
                >
                  <Search size={20} />
                  Get Recommendations
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {favorites.map((item) => (
                  <Card key={item.id} className="relative group">
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg flex justify-between items-start">
                        <span>{item.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item);
                          }}
                          disabled={deletingItems.has(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {item.posterPath ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w200${item.posterPath}`}
                          alt={item.title || 'Media poster'}
                          width={200}
                          height={300}
                          className="w-full rounded"
                          priority={false}
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center">
                          No Image
                        </div>
                      )}
                      <p className="text-xs mt-1 text-center text-gray-600">
                        {item.genres?.slice(0, 2).map(g => g.name).join(', ')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations Section */}
          {recommendations.length > 0 && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
                <RatingFilter onRatingChange={handleRatingChange} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {recommendations.map(rec => (
                  <div key={rec.id} className="p-4 border rounded-lg hover:shadow-lg transition-shadow bg-white">
                    <div className="flex gap-4">
                      {/* Poster Image */}
                      <div className="w-32 flex-shrink-0">
                        {rec.poster_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w200${rec.poster_path}`}
                            alt={rec.title || rec.name || 'Media poster'}
                            width={128}
                            height={192}
                            className="rounded-md"
                            priority={false}
                          />
                        ) : (
                          <div className="w-32 h-48 bg-gray-200 rounded-md flex items-center justify-center">
                            No Image
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h4 className="font-medium text-lg truncate">
                              {rec.title || rec.name}
                            </h4>
                            {rec.contentRating && (
                              <span className="inline-block px-2 py-0.5 text-sm font-medium bg-gray-100 text-gray-800 rounded mt-1">
                                {rec.contentRating}
                              </span>
                            )}
                            <div className="text-sm text-gray-600 mt-1">
                              {rec.genres?.slice(0, 2).map(g => g.name).join(', ')}
                            </div>
                          </div>
                          <AddToListButton
                            item={{
                              id: rec.id,
                              title: rec.title || rec.name || '',
                              type: rec.media_type,
                              posterPath: rec.poster_path,
                              genres: rec.genres
                            }}
                          />
                        </div>

                        {/* Scoring Details */}
                        <div className="mt-3 space-y-2">
                          {/* Overall Score */}
                          <div className="flex items-center">
                            <div className="w-24 text-sm font-medium">Match Score:</div>
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${(rec.thematicSimilarity * 100).toFixed(0)}%` }}
                              />
                            </div>
                            <span className="ml-2 text-sm font-semibold">
                              {(rec.thematicSimilarity * 100).toFixed(0)}%
                            </span>
                          </div>

                          {/* Recommendation Source */}
                          <div className="flex items-center text-sm">
                            <div className="w-24 font-medium">Source:</div>
                            <span className={`px-2 py-0.5 rounded ${
                              rec.recommendationSource === 'similar' 
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {rec.recommendationSource === 'similar' ? 'Content Similarity' : 'TMDB Algorithm'}
                            </span>
                            {rec.count > 1 && (
                              <span className="ml-2 text-gray-600">
                                ({rec.count} favorites match)
                              </span>
                            )}
                          </div>

                          {/* Scoring Details Button */}
                          <details className="text-sm">
                            <summary className="cursor-pointer hover:text-blue-600 font-medium">
                              View Scoring Details
                            </summary>
                            <div className="mt-2 space-y-1 pl-2 text-gray-600 text-xs">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <div>Base Score:</div>
                                <div>{(rec.recommendationDetails.weightedScore / rec.recommendationDetails.totalWeight * 100).toFixed(1)}%</div>
                                <div>Total Weight:</div>
                                <div>{rec.recommendationDetails.totalWeight.toFixed(2)}</div>
                                <div>Normalized Score:</div>
                                <div>{(rec.recommendationDetails.normalizedScore * 100).toFixed(1)}%</div>
                              </div>
                            </div>
                          </details>

                          {/* Keywords */}
                          {rec.keywords && rec.keywords.length > 0 && (
                            <div className="text-xs text-gray-500">
                              <span className="font-medium">Keywords: </span>
                              {rec.keywords.slice(0, 5).map(k => k.name).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && <p className="text-center">Loading...</p>}
          {error && <p className="text-center text-red-500">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
} 