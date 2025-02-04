import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`,
      { 
        next: { 
          revalidate: 3600, // Cache for 1 hour
          tags: [`search-${query}`] // Tag for selective revalidation
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from TMDB');
    }

    const data = await response.json();
    
    // Log search results for debugging
    console.log('Search Results:', data.results.map((result: any) => ({
      id: result.id,
      title: result.title || result.name,
      type: result.media_type,
      poster_path: result.poster_path,
      has_poster: !!result.poster_path
    })));

    // Add cache control headers for browser caching
    const headers = new Headers({
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    });

    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json(
      { error: 'Failed to search media' },
      { status: 500 }
    );
  }
} 