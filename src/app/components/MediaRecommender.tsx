'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MediaRecommender = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);

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
      setError(null);
      
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
        .filter(result => result && !favorites.some(fav => fav.id === result.id));

      // Fetch details for each result
      const detailsPromises = firstResults.map(result =>
        fetch(`/api/details?id=${result.id}&type=${result.media_type}`)
          .then(res => res.json())
      );

      const details = await Promise.all(detailsPromises);
      
      // Create new favorites with genre information
      const newFavorites = firstResults.map((result, index) => ({
        id: result.id,
        title: result.title || result.name,
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
      
      // Merge and deduplicate recommendations with thematic scoring
      const merged = recommendations
        .flatMap(r => r.results || [])
        .reduce((acc, curr) => {
          const existing = acc.find(item => item.id === curr.id);
          if (existing) {
            // Average the thematic similarities and increment count
            existing.thematicSimilarity = (existing.thematicSimilarity + curr.thematicSimilarity) / 2;
            existing.count++;
            // Collect genres and keywords for better explanation
            existing.genres = [...new Set([...existing.genres, ...(curr.genres || [])])];
            existing.keywords = [...new Set([...existing.keywords, ...(curr.keywords || [])])];
          } else {
            acc.push({
              ...curr,
              count: 1,
              genres: curr.genres || [],
              keywords: curr.keywords || []
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

      setRecommendations(merged);
    } catch (err) {
      setError('Failed to fetch recommendations');
    } finally {
      setLoading(false);
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
                    <p className="text-xs mt-1 text-center text-gray-600">
                      {favorite.genres?.slice(0, 2).map(g => g.name).join(', ')}
                    </p>
                    <button
                      onClick={() => removeFromFavorites(favorite.id)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      title="Remove from Favorites"
                    >
                      <X size={16} />
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
                        <p className="font-medium text-lg">{rec.title || rec.name}</p>
                        <div className="text-sm text-gray-600">
                          <p className="font-semibold">
                            Match: {(rec.thematicSimilarity * 100).toFixed(0)}%
                          </p>
                          <p>({rec.count} favorites match)</p>
                          
                          {/* Genres */}
                          <p className="mt-2 text-xs">
                            <span className="font-semibold">Genres: </span>
                            {rec.genres?.slice(0, 3).map(g => g.name).join(', ')}
                          </p>

                          {/* Matching Keywords */}
                          {rec.matchDetails?.matchedKeywords?.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-semibold">Matching Themes:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {rec.matchDetails.matchedKeywords.map(keyword => (
                                  <span
                                    key={keyword.id}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                                  >
                                    {keyword.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Year and Rating Info */}
                          <p className="mt-2 text-xs">
                            <span className="font-semibold">Year: </span>
                            {new Date(rec.first_air_date || rec.release_date).getFullYear()}
                            {rec.matchDetails?.yearDiff > 0 && 
                              ` (${rec.matchDetails.yearDiff} years apart)`
                            }
                          </p>
                          
                          {/* If it came through a recommendation chain */}
                          {rec.viaTitle && (
                            <p className="mt-2 text-xs italic">
                              Also recommended for fans of: {rec.viaTitle}
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
    </div>
  );
};

export default MediaRecommender; 