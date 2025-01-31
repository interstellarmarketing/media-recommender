'use client';

import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddToListButton } from './AddToListButton';

export function MediaRecommender() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/search?query=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      setError('Failed to search');
    } finally {
      setLoading(false);
    }
  };

  const addToFavorites = async (result) => {
    try {
      // Fetch detailed information including genres
      const response = await fetch(`/api/details?id=${result.id}&type=${result.media_type}`);
      const details = await response.json();
      
      const newFavorite = {
        id: result.id,
        title: result.title || result.name,
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

  const removeFromFavorites = (id) => {
    setFavorites(prev => prev.filter(fav => fav.id !== id));
  };

  const getRecommendations = async () => {
    if (favorites.length === 0) {
      setError('Please add some favorites first');
      return;
    }

    try {
      setLoading(true);
      const recommendations = await Promise.all(
        favorites.map(favorite => 
          fetch(`/api/recommendations?id=${favorite.id}&type=${favorite.type}`)
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
            acc.push({
              ...curr,
              count: 1
            });
          }
          return acc;
        }, [])
        .sort((a, b) => b.thematicSimilarity - a.thematicSimilarity);

      setRecommendations(merged);
    } catch (err) {
      setError('Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Media Recommender</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            className="flex-1 p-2 border rounded"
            placeholder="Search for a movie or TV show..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded flex items-center gap-2"
            onClick={handleSearch}
            disabled={loading}
          >
            <Search size={20} />
            Search
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Search Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {searchResults.map(result => (
                <div key={result.id} className="p-2 border rounded relative">
                  {result.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${result.poster_path}`}
                      alt={result.title || result.name}
                      className="w-full rounded"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center">
                      No Image
                    </div>
                  )}
                  <p className="mt-2 text-center font-medium">{result.title || result.name}</p>
                  <div className="absolute top-2 right-2 flex gap-2">
                    <AddToListButton
                      item={{
                        id: result.id,
                        title: result.title || result.name,
                        type: result.media_type,
                        posterPath: result.poster_path,
                        genres: result.genres
                      }}
                    />
                    <button
                      onClick={() => addToFavorites(result)}
                      className="p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                      title="Add to Favorites"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
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
              {favorites.map(favorite => (
                <div key={favorite.id} className="p-2 border rounded relative">
                  {favorite.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${favorite.posterPath}`}
                      alt={favorite.title}
                      className="w-full rounded"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 rounded flex items-center justify-center">
                      No Image
                    </div>
                  )}
                  <p className="mt-2 text-center font-medium">{favorite.title}</p>
                  <button
                    onClick={() => removeFromFavorites(favorite.id)}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    title="Remove from Favorites"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations Section */}
        {recommendations.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.map(rec => (
                <div key={rec.id} className="p-4 border rounded hover:shadow-lg transition-shadow">
                  <div className="flex gap-4">
                    {rec.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w200${rec.poster_path}`}
                        alt={rec.title || rec.name}
                        className="w-32 rounded"
                      />
                    ) : (
                      <div className="w-32 h-48 bg-gray-200 rounded flex items-center justify-center">
                        No Image
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-lg">{rec.title || rec.name}</p>
                        <AddToListButton
                          item={{
                            id: rec.id,
                            title: rec.title || rec.name,
                            type: rec.media_type,
                            posterPath: rec.poster_path,
                            genres: rec.genres
                          }}
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        <p className="font-semibold">
                          Match: {(rec.thematicSimilarity * 100).toFixed(0)}%
                        </p>
                        <p>({rec.count} favorites match)</p>
                        {rec.genres && (
                          <p className="mt-2 text-xs">
                            <span className="font-semibold">Genres: </span>
                            {rec.genres.slice(0, 3).map(g => g.name).join(', ')}
                          </p>
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
  );
} 