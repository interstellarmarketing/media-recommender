import { NextResponse } from 'next/server';
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/redis';

const CACHE_TTL = 3600 * 24; // 24 hours
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_ACCESS_TOKEN) {
  throw new Error('TMDB_ACCESS_TOKEN is not configured');
}

const FETCH_OPTIONS = {
  headers: {
    'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
    'accept': 'application/json'
  }
} as const;

type Params = { type: string; id: string };
type Context = { params: Promise<Params> };

export async function GET(
  request: Request,
  context: Context
) {
  try {
    const params = await context.params;
    const mediaType = params.type;
    const mediaId = params.id;

    if (!mediaType || !mediaId || !['movie', 'tv'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'Invalid type or id parameter' },
        { status: 400 }
      );
    }

    // Try to get cached data first
    const cacheKey = generateCacheKey(`details-${mediaType}-${mediaId}`);
    const cached = await getCachedData(cacheKey);
    
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch details from TMDB
    const response = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${mediaId}?append_to_response=credits,videos,watch/providers`,
      FETCH_OPTIONS
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('TMDB API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      return NextResponse.json(
        { error: errorData?.status_message || 'Failed to fetch media details' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform the response
    const transformedData = {
      id: data.id,
      title: data.title || data.name,
      overview: data.overview,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      releaseDate: data.release_date || data.first_air_date,
      genres: data.genres,
      runtime: data.runtime || data.episode_run_time?.[0],
      voteAverage: data.vote_average,
      voteCount: data.vote_count,
      status: data.status,
      videos: data.videos?.results || [],
      credits: {
        cast: data.credits?.cast || [],
        crew: data.credits?.crew || []
      },
      watchProviders: data['watch/providers']?.results?.US || null
    };

    // Cache the transformed data
    await setCachedData(cacheKey, transformedData, CACHE_TTL);

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error in details API:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching media details' },
      { status: 500 }
    );
  }
} 