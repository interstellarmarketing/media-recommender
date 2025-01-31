import { NextResponse } from 'next/server';

interface TMDBReview {
  content: string;
  id: string;
  author: string;
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
  recommendations: {
    results: TMDBRecommendation[];
  };
}

interface MediaItem {
  id: string;
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
  recommendations?: {
    results: TMDBRecommendation[];
  };
}

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Fetch detailed metadata including genres, keywords, and credits
async function fetchMediaDetails(type: string, id: string, depth: number = 0) {
  // Base URLs for different data types
  const urls = {
    details: `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=keywords,credits,reviews`,
    similar: `${TMDB_BASE_URL}/${type}/${id}/similar?api_key=${TMDB_API_KEY}`,
    recommendations: `${TMDB_BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}`,
    reviews: `${TMDB_BASE_URL}/${type}/${id}/reviews?api_key=${TMDB_API_KEY}`,
    translations: `${TMDB_BASE_URL}/${type}/${id}/translations?api_key=${TMDB_API_KEY}` // For international descriptions
  };

  try {
    const [detailsRes, similarRes, recommendationsRes, reviewsRes, translationsRes] = await Promise.all([
      fetch(urls.details),
      fetch(urls.similar),
      fetch(urls.recommendations),
      fetch(urls.reviews),
      fetch(urls.translations)
    ]);

    const [details, similar, recommendations, reviews, translations] = await Promise.all([
      detailsRes.json(),
      similarRes.json(),
      recommendationsRes.json(),
      reviewsRes.json(),
      translationsRes.json()
    ]);

    // Combine all text content for pattern analysis
    const textContent = [
      details.overview,
      details.tagline,
      ...(reviews.results || []).map((review: TMDBReview) => review.content),
      ...(translations.translations || [])
        .filter((t: TMDBTranslation) => Boolean(t.data?.overview))
        .map((t: TMDBTranslation) => t.data!.overview!)
    ].filter(Boolean).join(' ');

    // Extract potential patterns from text content
    const patterns = analyzePatterns(textContent);

    const baseDetails = {
      ...details,
      keywords: details.keywords?.keywords || details.keywords?.results || [],
      similar: similar.results || [],
      recommendations: recommendations.results || [],
      cast: details.credits?.cast || [],
      crew: details.credits?.crew || [],
      reviews: reviews.results || [],
      patterns,
      vote_count: details.vote_count,
      popularity: details.popularity,
      textContent
    };

    // If we haven't reached max depth, fetch next level of recommendations
    if (depth < 2) {
      const nextLevelRecommendations = await Promise.all(
        [...baseDetails.recommendations, ...baseDetails.similar]
          .slice(0, 3) // Limit to top 3 from each to manage API calls
          .map(async rec => {
            try {
              return await fetchMediaDetails(type, rec.id, depth + 1);
            } catch (e) {
              console.error(`Failed to fetch details for ${rec.id}:`, e);
              return null;
            }
          })
      );

      baseDetails.deepRecommendations = nextLevelRecommendations.filter(Boolean);
    }

    return baseDetails;
  } catch (error) {
    console.error(`Error fetching details for ${type}/${id}:`, error);
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
function calculateSimilarity(item1: MediaItem, item2: MediaItem) {
  let score = 0;
  let weights = 0;
  let matchDetails = {
    matchedKeywords: [] as Array<{ id: number; name: string; }>,
    matchedGenres: [] as Array<{ id: number; name: string; }>,
    matchedPatterns: [] as string[],
    yearDiff: 0,
    ratingDiff: 0,
    popularityFactor: 0
  };
  
  // Pattern similarity (40%) - This is now our primary factor
  if (item1.patterns && item2.patterns) {
    const patterns2 = item2.patterns; // Create a local reference
    const matchedPatterns = item1.patterns.filter((p: string) => patterns2.includes(p));
    const patternScore = matchedPatterns.length / Math.max(item1.patterns.length, patterns2.length);
    score += patternScore * 0.4;
    weights += 0.4;
    matchDetails.matchedPatterns = matchedPatterns;
  }

  // Genre similarity (20%)
  if (item1.genres && item2.genres) {
    const genres2 = item2.genres; // Create a local reference
    const matchedGenres = item1.genres.filter(g1 => 
      genres2.some(g2 => g1.id === g2.id)
    );
    const genreScore = matchedGenres.length / Math.max(item1.genres.length, genres2.length);
    score += genreScore * 0.2;
    weights += 0.2;
    matchDetails.matchedGenres = matchedGenres;
  }

  // Keyword similarity (15%)
  if (item1.keywords && item2.keywords) {
    const keywords2 = item2.keywords; // Create a local reference
    const matchedKeywords = item1.keywords.filter(k1 =>
      keywords2.some(k2 => k1.id === k2.id)
    );
    const keywordScore = matchedKeywords.length / Math.max(1, Math.min(item1.keywords.length, 20));
    score += keywordScore * 0.15;
    weights += 0.15;
    matchDetails.matchedKeywords = matchedKeywords;
  }

  // Era similarity (15%)
  const year1 = new Date(item1.first_air_date || item1.release_date || 0).getFullYear();
  const year2 = new Date(item2.first_air_date || item2.release_date || 0).getFullYear();
  if (year1 && year2) {
    const yearDiff = Math.abs(year1 - year2);
    const yearScore = 1 - Math.min(yearDiff / 20, 1); // 20 years difference = 0 score
    score += yearScore * 0.15;
    weights += 0.15;
    matchDetails.yearDiff = yearDiff;
  }

  // Rating similarity (10%)
  if (item1.vote_average && item2.vote_average) {
    const ratingDiff = Math.abs(item1.vote_average - item2.vote_average);
    const ratingScore = 1 - (ratingDiff / 10);
    score += ratingScore * 0.1;
    weights += 0.1;
    matchDetails.ratingDiff = ratingDiff;
  }

  // Popularity adjustment (favor less popular but well-rated shows)
  if (item2.vote_count && item2.popularity) {
    const popularityScore = Math.min(item2.vote_count / 1000, 1); // Normalize vote count
    const qualityScore = (item2.vote_average || 0) / 10;
    const popularityFactor = (popularityScore * qualityScore) * 
      (1 - Math.min(item2.popularity / 1000, 0.9)); // Reduce score for very popular shows
    
    matchDetails.popularityFactor = popularityFactor;
    // Apply popularity adjustment (can reduce score by up to 20% for very popular shows)
    score = score * (0.8 + (popularityFactor * 0.2));
  }

  return {
    score: weights > 0 ? score / weights : 0,
    matchDetails
  };
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

    // Fetch source item details
    const sourceDetails = await fetchMediaDetails(type, id);

    // Combine direct recommendations and similar items
    const initialRecommendations = [
      ...sourceDetails.recommendations,
      ...sourceDetails.similar
    ];

    // Remove duplicates
    const uniqueRecommendations = Array.from(
      new Map(initialRecommendations.map(item => [item.id, item])).values()
    );

    // For highly similar items, fetch their recommendations too (recommendation chain)
    const expandedRecommendations = await Promise.all(
      uniqueRecommendations.slice(0, 5).map(async (rec: TMDBRecommendation) => {
        const details = await fetchMediaDetails(type, rec.id);
        return details.recommendations.map((subRec: TMDBRecommendation) => ({
          ...subRec,
          viaTitle: rec.title || rec.name
        }));
      })
    );

    // Combine all recommendations
    const allRecommendations = [
      ...uniqueRecommendations,
      ...expandedRecommendations.flat()
    ];

    // Remove duplicates and calculate similarity scores
    const processedRecommendations = await Promise.all(
      Array.from(new Map(allRecommendations.map(item => [item.id, item])).values())
        .map(async rec => {
          const details = await fetchMediaDetails(type, rec.id);
          const { score: similarityScore, matchDetails } = calculateSimilarity(sourceDetails, details);
          return {
            ...rec,
            ...details,
            thematicSimilarity: similarityScore,
            matchDetails
          };
        })
    );

    // Sort by thematic similarity
    const sortedRecommendations = processedRecommendations
      .sort((a, b) => b.thematicSimilarity - a.thematicSimilarity)
      .slice(0, 20); // Limit to top 20 recommendations

    return NextResponse.json({
      results: sortedRecommendations,
      sourceMetadata: {
        genres: sourceDetails.genres,
        keywords: sourceDetails.keywords,
        title: sourceDetails.title || sourceDetails.name
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
} 