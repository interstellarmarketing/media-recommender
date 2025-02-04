import { NextResponse } from 'next/server';
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/redis';

interface TMDBGenre {
  id: number;
  name: string;
}

interface TMDBKeyword {
  id: number;
  name: string;
}

interface TMDBCastMember {
  name: string;
  character: string;
  order: number;
}

interface TMDBCrewMember {
  name: string;
  job: string;
  department: string;
}

interface TMDBReview {
  author: string;
  content: string;
}

interface TMDBTranslation {
  data?: {
    overview?: string;
  };
}

interface TMDBRecommendation {
  id: string;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string;
  source?: string;
  vote_average?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  recommendations?: {
    results: TMDBRecommendation[];
  };
}

interface MediaItem {
  id: number | string;  // Allow both number and string since TMDB uses numbers but we sometimes use strings
  patterns?: string[];
  genres?: Array<{ id: number; name: string; }>;
  keywords?: Array<{ id: number; name: string; }>;
  first_air_date?: string;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  title?: string;
  name?: string;
  poster_path?: string;
  overview?: string;
  tagline?: string;
  recommendations?: {
    results: TMDBRecommendation[];
  };
  similar?: {
    results: TMDBRecommendation[];
  };
}

interface RecommendationResult extends TMDBRecommendation {
  genres?: Array<{ id: number; name: string; }>;
  keywords?: Array<{ id: number; name: string; }>;
  thematicSimilarity: number;
  recommendationSource: string;
  recommendationDetails: {
    source: string;
    weightedScore: number;
    totalWeight: number;
    normalizedScore: number;
  };
}

const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Validate access token is configured
if (!TMDB_ACCESS_TOKEN) {
  console.error('TMDB_ACCESS_TOKEN is not configured in environment variables');
  throw new Error('TMDB access token is required');
}

// Add fetch options for the new authentication method
const FETCH_OPTIONS = {
  headers: {
    'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
    'accept': 'application/json',
    'Content-Type': 'application/json'
  }
} as const;

const FETCH_OPTIONS_NO_CACHE = {
  ...FETCH_OPTIONS,
  cache: 'no-store' as RequestCache
};

// Cache TTL for media details (7 days since TMDB data doesn't change often)
const MEDIA_CACHE_TTL = 7 * 24 * 60 * 60;
// Cache TTL for processed recommendations (24 hours)
const RECOMMENDATIONS_CACHE_TTL = 24 * 60 * 60;

// Define scoring weights - weights are relative importance, will be normalized in calculation
const SCORING_WEIGHTS = {
  directRecommendation: 0.60,  // TMDB's direct recommendations (highest weight)
  similar: 0.20,               // TMDB's similar items
  genreMatch: 0.10,           // Genre matching
  thematicPattern: 0.05,      // Our custom thematic pattern matching
  voteAverage: 0.03,          // Rating factor
  popularity: 0.01,           // Popularity factor
  yearProximity: 0.01         // Release year proximity (lowest weight)
};

// Ensure weights sum to 1
const TOTAL_WEIGHT = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(TOTAL_WEIGHT - 1) > 0.001) {
  console.warn(`Warning: Scoring weights sum to ${TOTAL_WEIGHT}, not 1.0`);
}

// Fetch detailed metadata including genres, keywords, and credits
async function fetchMediaDetails(type: string, id: string, depth: number = 0) {
  try {
    console.log(`\n🔍 DEBUG: Fetching TMDB data for ${type}/${id}`);
    
    // Validate media type
    if (!['movie', 'tv'].includes(type)) {
      throw new Error(`Invalid media type: ${type}. Must be 'movie' or 'tv'`);
    }

    // Construct base URL based on media type
    const detailsUrl = `${TMDB_BASE_URL}/${type}/${id}?language=en-US`;
    
    // Fetch base details first
    console.log('Making TMDB API call for base details:', detailsUrl);
    const detailsRes = await fetch(detailsUrl, FETCH_OPTIONS);
    
    if (!detailsRes.ok) {
      console.error('\n=== TMDB API ERROR - Base Details ===');
      const errorText = await detailsRes.text();
      console.error(`Status: ${detailsRes.status} - ${errorText}`);
      throw new Error(`TMDB API request failed: ${errorText}`);
    }

    const details = await detailsRes.json();

    // Fetch recommendations separately for TV shows
    let recommendations = { results: [] };
    let similar = { results: [] };

    if (type === 'tv') {
      // Fetch TV recommendations
      const recommendationsUrl = `${TMDB_BASE_URL}/tv/${id}/recommendations?language=en-US&page=1`;
      console.log('Making TMDB API call for TV recommendations:', recommendationsUrl);
      
      const recommendationsRes = await fetch(recommendationsUrl, {
        ...FETCH_OPTIONS_NO_CACHE,
        method: 'GET'
      });
      if (recommendationsRes.ok) {
        recommendations = await recommendationsRes.json();
        console.log(`Found ${recommendations.results.length} TV recommendations`);
        console.log('Raw recommendations response:', JSON.stringify(recommendations, null, 2));
      } else {
        const errorText = await recommendationsRes.text();
        console.warn(`Failed to fetch TV recommendations: ${recommendationsRes.status} - ${errorText}`);
      }

      // Fetch TV similar shows
      const similarUrl = `${TMDB_BASE_URL}/tv/${id}/similar?language=en-US&page=1`;
      console.log('Making TMDB API call for similar TV shows:', similarUrl);
      
      const similarRes = await fetch(similarUrl, {
        ...FETCH_OPTIONS_NO_CACHE,
        method: 'GET'
      });
      if (similarRes.ok) {
        similar = await similarRes.json();
        console.log(`Found ${similar.results.length} similar TV shows`);
        console.log('Raw similar shows response:', JSON.stringify(similar, null, 2));
      } else {
        const errorText = await similarRes.text();
        console.warn(`Failed to fetch similar TV shows: ${similarRes.status} - ${errorText}`);
      }
    } else {
      // For movies, use the append_to_response approach
      const fullDetailsUrl = `${detailsUrl}&append_to_response=recommendations,similar`;
      console.log('Making TMDB API call for movie details:', fullDetailsUrl);
      
      const fullDetailsRes = await fetch(fullDetailsUrl, FETCH_OPTIONS);
      if (fullDetailsRes.ok) {
        const fullDetails = await fullDetailsRes.json();
        recommendations = fullDetails.recommendations || { results: [] };
        similar = fullDetails.similar || { results: [] };
      } else {
        const errorText = await fullDetailsRes.text();
        console.warn(`Failed to fetch movie details: ${fullDetailsRes.status} - ${errorText}`);
      }
    }

    // Log the complete response for debugging
    console.log('\n=== COMPLETE TMDB API RESPONSE ===');
    console.log(JSON.stringify({
      id: details.id,
      name: details.name || details.title,
      type: type,
      has_recommendations: recommendations.results.length > 0,
      recommendations_count: recommendations.results.length,
      has_similar: similar.results.length > 0,
      similar_count: similar.results.length,
      first_recommendation: recommendations.results[0] ? (recommendations.results[0] as TMDBRecommendation).title || (recommendations.results[0] as TMDBRecommendation).name : undefined,
      first_similar: similar.results[0] ? (similar.results[0] as TMDBRecommendation).title || (similar.results[0] as TMDBRecommendation).name : undefined
    }, null, 2));

    // Store only essential data needed for recommendations
    const baseDetails = {
      id: details.id,
      title: details.title || details.name,
      name: details.name,
      overview: details.overview,
      tagline: details.tagline,
      genres: details.genres || [],
      keywords: details.keywords?.keywords || details.keywords?.results || [],
      vote_count: details.vote_count,
      vote_average: details.vote_average,
      popularity: details.popularity,
      first_air_date: details.first_air_date,
      release_date: details.release_date,
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      recommendations: recommendations,
      similar: similar,
      media_type: type
    };

    return baseDetails;
  } catch (error) {
    console.error('Error fetching media details:', error);
    // Add more context to the error
    if (error instanceof Error) {
      throw new Error(`Failed to fetch ${type}/${id}: ${error.message}`);
    }
    throw error;
  }
}

// Pattern detection in text content
function analyzePatterns(text: string): string[] {
  const patterns = [];
  
  // Define pattern markers with their associated keywords/phrases
  const patternMarkers = {
    'Unreliable Reality': [
      'reality', 'dream', 'memory', 'consciousness', 'perception',
      'truth', 'illusion', 'simulation', 'alternate reality'
    ],
    'Corporate Dystopia': [
      'corporation', 'company', 'workplace', 'corporate', 'dystopia',
      'control', 'surveillance', 'bureaucracy', 'system'
    ],
    'Existential Mystery': [
      'existence', 'purpose', 'meaning', 'identity', 'philosophical',
      'mystery', 'truth', 'quest', 'journey', 'discovery'
    ],
    'Hidden World': [
      'secret', 'conspiracy', 'underground', 'beneath', 'hidden',
      'truth', 'discover', 'uncover', 'reveal', 'world within'
    ],
    'Psychological Thriller': [
      'psychological', 'mind', 'paranoia', 'suspense', 'tension',
      'mental', 'thriller', 'sanity', 'reality'
    ],
    'Complex Narrative': [
      'timeline', 'parallel', 'interconnected', 'mystery box',
      'puzzle', 'complex', 'layers', 'revelation'
    ]
  };

  // Check for each pattern
  for (const [pattern, markers] of Object.entries(patternMarkers)) {
    const matchCount = markers.reduce((count, marker) => {
      const regex = new RegExp(`\\b${marker}\\b`, 'gi');
      const matches = (text.match(regex) || []).length;
      return count + matches;
    }, 0);

    // If we find enough markers, consider it a match
    if (matchCount >= 3) {
      patterns.push(pattern);
    }
  }

  return patterns;
}

// Calculate similarity score between two items based on their metadata
function calculateSimilarity(item1: MediaItem, item2: MediaItem, source: 'direct' | 'similar' = 'direct') {
  let totalScore = 0;
  
  // Base score from recommendation source (always applied)
  const sourceWeight = source === 'direct' ? SCORING_WEIGHTS.directRecommendation : SCORING_WEIGHTS.similar;
  totalScore += sourceWeight;

  // Genre matching (high priority)
  if (item1.genres && item2.genres) {
    const matchedGenres = item1.genres.filter(g1 => 
      item2.genres?.some(g2 => g1.id === g2.id)
    );
    const genreScore = matchedGenres.length / Math.max(item1.genres.length, item2.genres.length);
    totalScore += genreScore * SCORING_WEIGHTS.genreMatch;
  }

  // Thematic pattern matching
  if (item1.patterns && item2.patterns) {
    const matchedPatterns = item1.patterns.filter(p => item2.patterns?.includes(p));
    const patternScore = matchedPatterns.length / Math.max(item1.patterns.length, item2.patterns?.length || 1);
    totalScore += patternScore * SCORING_WEIGHTS.thematicPattern;
  }

  // Vote average
  if (item2.vote_average && item2.vote_count) {
    const minVotes = 1000;
    const meanRating = 7.0;
    const weightedRating = (item2.vote_count * (item2.vote_average / 10) + minVotes * meanRating) / 
                          (item2.vote_count + minVotes);
    
    totalScore += weightedRating * SCORING_WEIGHTS.voteAverage;

    // Popularity (favor less mainstream but well-rated content)
    if (item2.popularity) {
      const popularityScore = Math.min(item2.vote_count / minVotes, 1) * 
        weightedRating * 
        (1 - Math.min(item2.popularity / 1000, 0.5));
      
      totalScore += popularityScore * SCORING_WEIGHTS.popularity;
    }
  }

  // Year proximity (lowest priority)
  const year1 = new Date(item1.first_air_date || item1.release_date || 0).getFullYear();
  const year2 = new Date(item2.first_air_date || item2.release_date || 0).getFullYear();
  if (year1 && year2) {
    const yearDiff = Math.abs(year1 - year2);
    const yearScore = Math.max(0, 1 - yearDiff / 10);
    totalScore += yearScore * SCORING_WEIGHTS.yearProximity;
  }

  // Ensure final score is between 0 and 1
  const normalizedScore = Math.min(Math.max(totalScore, 0), 1);

  return {
    score: normalizedScore,
    details: {
      source,
      weightedScore: totalScore,
      totalWeight: TOTAL_WEIGHT,
      normalizedScore
    }
  };
}

// Fetch recommendations with content ratings
async function fetchRecommendationsWithDetails(id: string, type: string) {
  const response = await fetch(
    `${TMDB_BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_ACCESS_TOKEN}`,
    FETCH_OPTIONS
  );

  if (!response.ok) {
    throw new Error('TMDB API error');
  }

  const data = await response.json();
  
  // Fetch content ratings for each recommendation
  const recommendationsWithRatings = await Promise.all(
    data.results.map(async (rec: any) => {
      const details = await fetch(
        `${TMDB_BASE_URL}/${type}/${rec.id}?api_key=${TMDB_ACCESS_TOKEN}&append_to_response=release_dates,content_ratings`,
        FETCH_OPTIONS
      ).then(res => res.json());

      // Get content rating based on media type
      let contentRating = '';
      if (type === 'movie') {
        const usRating = details.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
        contentRating = usRating?.release_dates?.[0]?.certification || '';
      } else {
        const usRating = details.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US');
        contentRating = usRating?.rating || '';
      }

      return {
        ...rec,
        contentRating
      };
    })
  );

  return {
    ...data,
    results: recommendationsWithRatings
  };
}

// Fetch content rating for a single item
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
    const skipCache = searchParams.get('skipCache') === 'true';  // Add cache-busting parameter

    if (!id || !type) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('\n========== RECOMMENDATION REQUEST ==========');
    console.log(`Getting recommendations for ${type}/${id} (Skip Cache: ${skipCache})`);

    // Try to get recommendations from cache first (unless skipCache is true)
    const recommendationsCacheKey = generateCacheKey('recommendations', type, id);
    const cachedRecommendations = skipCache ? null : await getCachedData<{
      results: RecommendationResult[];
      sourceMetadata: {
        genres: Array<{ id: number; name: string; }>;
        keywords: Array<{ id: number; name: string; }>;
        title: string;
      };
    }>(recommendationsCacheKey);

    // If not in cache, fetch media details (possibly from cache)
    const mediaCacheKey = generateCacheKey('media', type, id);
    let mediaDetails = skipCache ? null : await getCachedData<MediaItem>(mediaCacheKey);
    
    if (!mediaDetails) {
      console.log('Fetching fresh media details from TMDB');
      mediaDetails = await fetchMediaDetails(type, id);
      // Cache the media details
      if (!skipCache) {
        await setCachedData(mediaCacheKey, mediaDetails, MEDIA_CACHE_TTL);
      }
    } else {
      console.log('Using cached media details');
    }

    // Return early if we still don't have media details
    if (!mediaDetails) {
      return NextResponse.json(
        { error: 'Failed to fetch media details' },
        { status: 404 }
      );
    }

    // If we have cached recommendations and not skipping cache, add the debug data and return
    if (cachedRecommendations && !skipCache) {
      console.log('Using cached recommendations');
      return NextResponse.json({
        ...cachedRecommendations,
        debug: {
          sourceDetails: {
            id: mediaDetails.id,
            title: mediaDetails.title || mediaDetails.name,
            overview: mediaDetails.overview,
            tagline: mediaDetails.tagline,
            genres: mediaDetails.genres?.map(g => g.name),
            vote_average: mediaDetails.vote_average,
            vote_count: mediaDetails.vote_count,
            popularity: mediaDetails.popularity,
            release_date: mediaDetails.release_date || mediaDetails.first_air_date,
            cached: true
          },
          tmdbData: {
            directRecommendations: {
              count: mediaDetails.recommendations?.results?.length || 0,
              items: mediaDetails.recommendations?.results?.map(r => ({
                id: r.id,
                title: r.title || r.name,
                vote_average: r.vote_average,
                popularity: r.popularity
              }))
            },
            similarItems: {
              count: mediaDetails.similar?.results?.length || 0,
              items: mediaDetails.similar?.results?.map(r => ({
                id: r.id,
                title: r.title || r.name,
                vote_average: r.vote_average,
                popularity: r.popularity
              }))
            }
          }
        }
      });
    }

    // Get recommendations with proper null checking
    const allRecommendations = [
      ...(mediaDetails.recommendations?.results || []).map((item: TMDBRecommendation) => ({ ...item, source: 'direct' })),
      ...(mediaDetails.similar?.results || []).map((item: TMDBRecommendation) => ({ ...item, source: 'similar' }))
    ];

    console.log('\n=== PROCESSING RECOMMENDATIONS ===');
    console.log(`Total recommendations to process: ${allRecommendations.length}`);
    console.log('Breakdown:');
    console.log(`- Direct recommendations: ${mediaDetails.recommendations?.results?.length || 0}`);
    console.log(`- Similar items: ${mediaDetails.similar?.results?.length || 0}`);

    // Process recommendations
    const recommendations = await Promise.all(allRecommendations.map(async (rec: TMDBRecommendation) => {
      // Try to get recommendation details from cache
      const recCacheKey = generateCacheKey('media', type, rec.id.toString());
      let recDetails = await getCachedData<MediaItem>(recCacheKey);
      
      if (!recDetails) {
        recDetails = await fetchMediaDetails(type, rec.id.toString());
        // Cache the recommendation details
        if (recDetails) {  // Only cache if we got valid details
          await setCachedData(recCacheKey, recDetails, MEDIA_CACHE_TTL);
        }
      }

      // Skip this recommendation if we couldn't get its details
      if (!recDetails) {
        console.warn(`Could not fetch details for recommendation ${rec.id}`);
        return null;
      }

      // At this point, TypeScript knows mediaDetails and recDetails are not null
      const contentRating = await fetchContentRating(type, rec.id.toString());

      // We know mediaDetails is not null due to the early return above
      const similarity = calculateSimilarity(
        mediaDetails as MediaItem,  // Assert type since we checked for null earlier
        recDetails,
        rec.source as 'direct' | 'similar'
      );
      
      return {
        ...rec,
        genres: recDetails.genres || [],
        keywords: recDetails.keywords || [],
        thematicSimilarity: similarity.score,
        recommendationSource: rec.source === 'direct' ? 'direct' : 'similar',
        recommendationDetails: similarity.details,
        contentRating
      } as RecommendationResult;
    }));

    // Filter out null recommendations and sort by similarity score
    const sortedRecommendations = recommendations
      .filter((rec): rec is RecommendationResult => rec !== null)
      .reduce((acc: RecommendationResult[], curr: RecommendationResult) => {
        const existing = acc.find(item => item.id === curr.id);
        if (!existing || existing.thematicSimilarity < curr.thematicSimilarity) {
          if (existing) {
            acc = acc.filter(item => item.id !== curr.id);
          }
          acc.push(curr);
        }
        return acc;
      }, [])
      .sort((a, b) => b.thematicSimilarity - a.thematicSimilarity)
      .slice(0, 20);

    const responseData = {
      results: sortedRecommendations,
      sourceMetadata: {
        genres: mediaDetails.genres || [],
        keywords: mediaDetails.keywords || [],
        title: mediaDetails.title || mediaDetails.name || ''
      }
    };

    // Cache the final recommendations
    await setCachedData(recommendationsCacheKey, responseData, RECOMMENDATIONS_CACHE_TTL);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
} 