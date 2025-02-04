export interface TMDBResponse {
  id?: number;
  title?: string;
  name?: string;
  poster_path?: string;
  genres?: Array<{ id: number; name: string }>;
  overview?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  'watch/providers'?: {
    results?: {
      US?: {
        flatrate?: any[];
      };
    };
  };
  'release_dates'?: {
    results: Array<{
      iso_3166_1: string;
      release_dates: Array<{
        certification: string;
      }>;
    }>;
  };
  'content_ratings'?: {
    results: Array<{
      iso_3166_1: string;
      rating: string;
    }>;
  };
  error?: string;
}

export async function fetchTMDBData(type: string, id: number): Promise<TMDBResponse> {
  const tmdbAccessToken = process.env.TMDB_ACCESS_TOKEN;
  if (!tmdbAccessToken) {
    throw new Error('TMDB access token is not configured');
  }

  try {
    // Add release_dates for movies or content_ratings for TV shows
    const ratingsParam = type === 'movie' ? 'release_dates' : 'content_ratings';
    const response = await fetch(
      `https://api.themoviedb.org/3/${type}/${id}?append_to_response=watch/providers,${ratingsParam}`,
      {
        headers: {
          Authorization: `Bearer ${tmdbAccessToken}`,
          accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limit hit - wait and retry
        const retryAfter = response.headers.get('retry-after') ?? '1';
        await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
        return fetchTMDBData(type, id);
      }
      if (response.status === 404) {
        return { error: 'Not found in TMDB database' };
      }
      throw new Error(`TMDB API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching TMDB data for ${type}/${id}:`, error);
    throw error;
  }
}

// Helper function to get US content rating from TMDB data
function getUSContentRating(tmdbData: TMDBResponse, type: 'movie' | 'tv'): string | undefined {
  if (type === 'movie') {
    const usReleaseInfo = tmdbData.release_dates?.results.find(r => r.iso_3166_1 === 'US');
    return usReleaseInfo?.release_dates[0]?.certification;
  } else {
    const usRating = tmdbData.content_ratings?.results.find(r => r.iso_3166_1 === 'US');
    return usRating?.rating;
  }
}

// Helper function to transform TMDB data into our MediaItem format
export function transformTMDBData(tmdbData: TMDBResponse, additionalData: { type: 'movie' | 'tv'; rating?: number; added_at?: string } = { type: 'movie' }) {
  if ('error' in tmdbData) {
    throw new Error(tmdbData.error || 'Unknown error');
  }

  if (!tmdbData.id) {
    throw new Error('Invalid TMDB response: missing ID');
  }

  return {
    id: tmdbData.id,
    title: tmdbData.title || tmdbData.name || 'Unknown Title',
    type: additionalData.type,
    posterPath: tmdbData.poster_path,
    genres: tmdbData.genres || [],
    overview: tmdbData.overview || '',
    rating: additionalData.rating,
    added_at: additionalData.added_at,
    watchProviders: tmdbData['watch/providers']?.results?.US?.flatrate || [],
    voteAverage: tmdbData.vote_average || 0,
    releaseDate: tmdbData.release_date || tmdbData.first_air_date || '',
    contentRating: getUSContentRating(tmdbData, additionalData.type),
  };
} 