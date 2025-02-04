import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const FETCH_OPTIONS = {
  headers: {
    'Accept': 'application/json'
  }
};

async function fetchMediaDetails(type: string, id: string) {
  const response = await fetch(
    `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}`,
    FETCH_OPTIONS
  );

  if (!response.ok) {
    throw new Error('TMDB API error');
  }

  const data = await response.json();
  return data;
}

async function fetchContentRating(type: string, id: string) {
  const endpoint = type === 'movie' 
    ? `${TMDB_BASE_URL}/movie/${id}/release_dates`
    : `${TMDB_BASE_URL}/tv/${id}/content_ratings`;

  try {
    const response = await fetch(endpoint, FETCH_OPTIONS);
    const data = await response.json();
    
    // Get US rating
    const usRating = data.results?.find((r: any) => r.iso_3166_1 === 'US');
    
    if (type === 'movie') {
      return usRating?.release_dates?.[0]?.certification || '';
    } else {
      return usRating?.rating || '';
    }
  } catch (error) {
    console.error('Error fetching content rating:', error);
    return '';
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    
    if (!id || !type) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Fetch both details and content rating
    const [details, contentRating] = await Promise.all([
      fetchMediaDetails(type, id),
      fetchContentRating(type, id)
    ]);

    return NextResponse.json({
      ...details,
      contentRating
    });
  } catch (error) {
    console.error('Error in details API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch details' },
      { status: 500 }
    );
  }
} 