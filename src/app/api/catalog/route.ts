import { NextResponse } from 'next/server';
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/redis';
import type { MediaItem } from '@/types';

const ITEMS_PER_PAGE = 20;
const CACHE_TTL = 3600; // 1 hour

async function fetchTMDBData(endpoint: string) {
  const tmdbAccessToken = process.env.TMDB_ACCESS_TOKEN;
  if (!tmdbAccessToken) {
    throw new Error('TMDB access token is not configured');
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3${endpoint}`,
      {
        headers: {
          Authorization: `Bearer ${tmdbAccessToken}`,
          accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.status_message || 
        `TMDB API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching TMDB data for ${endpoint}:`, error);
    throw error;
  }
}

async function fetchWatchProviders(items: any[]) {
  const providers = await Promise.all(
    items.map(async (item) => {
      const cacheKey = generateCacheKey(`providers-${item.media_type}-${item.id}`);
      const cached = await getCachedData(cacheKey);
      
      if (cached) {
        return { id: item.id, providers: cached };
      }

      try {
        const data = await fetchTMDBData(
          `/${item.media_type}/${item.id}/watch/providers`
        );
        const usProviders = data.results?.US?.flatrate || [];
        const providers = usProviders.map((provider: any) => ({
          id: provider.provider_id,
          name: provider.provider_name,
          logo_path: provider.logo_path,
        }));

        // Cache the providers
        await setCachedData(cacheKey, providers, CACHE_TTL * 24); // Cache for 24 hours
        return { id: item.id, providers };
      } catch (error) {
        console.error(`Error fetching providers for ${item.id}:`, error);
        return { id: item.id, providers: [] };
      }
    })
  );

  return providers.reduce((acc, { id, providers }) => {
    acc[id] = providers;
    return acc;
  }, {} as Record<number, Array<{ id: number; name: string; logo_path: string }>>);
}

async function fetchCatalogPage(page: number, searchTerm?: string) {
  try {
    if (searchTerm) {
      // Search for movies and TV shows
      const data = await fetchTMDBData(
        `/search/multi?query=${encodeURIComponent(searchTerm)}&page=${page}`
      );
      return {
        results: data.results || [],
        total_pages: data.total_pages || 1,
        page: data.page || 1,
      };
    }

    // Fetch popular movies and TV shows
    const [moviesResponse, tvResponse] = await Promise.all([
      fetchTMDBData(`/movie/popular?page=${page}`),
      fetchTMDBData(`/tv/popular?page=${page}`),
    ]);

    const moviesData = moviesResponse.results || [];
    const tvData = tvResponse.results || [];

    // Combine and sort by popularity
    const combined = [
      ...moviesData.map((item: any) => ({ ...item, media_type: 'movie' })),
      ...tvData.map((item: any) => ({ ...item, media_type: 'tv' })),
    ].sort((a, b) => b.popularity - a.popularity);

    return {
      results: combined.slice(0, ITEMS_PER_PAGE),
      total_pages: Math.max(moviesResponse.total_pages || 1, tvResponse.total_pages || 1),
      page,
    };
  } catch (error) {
    console.error('Error fetching catalog page:', error);
    throw error;
  }
}

async function getRecommendedIds(): Promise<Set<number>> {
  try {
    const cacheKey = generateCacheKey('recommended-ids');
    const cached = await getCachedData<number[]>(cacheKey);
    if (cached && Array.isArray(cached)) {
      return new Set(cached);
    }

    // TODO: Implement logic to fetch recommended IDs from your recommendation system
    return new Set<number>();
  } catch (error) {
    console.error('Error fetching recommended IDs:', error);
    return new Set<number>();
  }
}

async function getRatings(ids: number[]): Promise<Record<number, number>> {
  try {
    const cacheKey = generateCacheKey(`ratings-${ids.join('-')}`);
    const cached = await getCachedData<Record<number, number>>(cacheKey);
    if (cached && typeof cached === 'object') {
      return cached as Record<number, number>;
    }

    // TODO: Implement logic to fetch ratings for the given IDs
    return {} as Record<number, number>;
  } catch (error) {
    console.error('Error fetching ratings:', error);
    return {} as Record<number, number>;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const searchTerm = searchParams.get('search') || '';
    const genres = searchParams.get('genres')?.split(',').filter(Boolean) || [];
    const recommendedOnly = searchParams.get('recommended') === 'true';

    // Generate cache key based on parameters
    const cacheKey = generateCacheKey(`catalog-${page}-${searchTerm}-${genres.join('-')}-${recommendedOnly}`);
    
    // Try to get cached data
    const cached = await getCachedData(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch data from TMDB
    const data = await fetchCatalogPage(page, searchTerm);
    
    if (!data || !data.results) {
      throw new Error('Invalid response from TMDB API');
    }

    // Get recommended IDs and ratings
    const recommendedIds = await getRecommendedIds();
    const itemIds = data.results.map((item: any) => item.id);
    const ratings = await getRatings(itemIds);

    // Fetch watch providers for all items
    const watchProviders = await fetchWatchProviders(data.results);

    // Transform the results
    const items = data.results
      .filter((item: any) => 
        // Filter by media type and recommended status
        (item.media_type === 'movie' || item.media_type === 'tv') &&
        (!recommendedOnly || recommendedIds.has(item.id))
      )
      .map((item: any) => ({
        id: item.id,
        title: item.title || item.name,
        type: item.media_type,
        posterPath: item.poster_path,
        genres: item.genre_ids?.map((id: number) => ({ id, name: 'Unknown' })),
        rating: ratings[item.id] || item.vote_average,
        isRecommended: recommendedIds.has(item.id),
        watchProviders: watchProviders[item.id] || [],
      }));

    const response = {
      items,
      hasMore: page < data.total_pages,
      totalPages: data.total_pages,
      currentPage: page,
    };

    // Cache the response
    await setCachedData(cacheKey, response, CACHE_TTL);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in catalog API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch catalog data' },
      { status: 500 }
    );
  }
} 