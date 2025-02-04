import { NextResponse } from 'next/server';
import { getPersonalCatalog } from '@/lib/personal-catalog';
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/redis';
import { fetchTMDBData } from '@/lib/tmdb';
import type { MediaItem } from '@/types';

const CACHE_TTL = 604800; // 7 days
const BATCH_SIZE = 25; // Increased batch size
const BATCH_DELAY = 300; // Reduced delay between batches

interface ProcessedResult {
  item: MediaItem | null;
  error?: string;
  originalTitle: string;
}

// Helper function to process items in batches
async function processBatch(items: Array<{ type: 'movie' | 'tv'; id: number; title: string }>, startIdx: number, batchSize: number): Promise<ProcessedResult[]> {
  const batch = items.slice(startIdx, startIdx + batchSize);
  const results = await Promise.all(
    batch.map(async (item) => {
      const cacheKey = generateCacheKey(`personal-${item.type}-${item.id}`);
      const cached = await getCachedData<MediaItem>(cacheKey);
      
      if (cached) {
        return { item: cached, originalTitle: item.title };
      }

      const tmdbData = await fetchTMDBData(item.type, item.id);
      
      if (tmdbData.error) {
        return { 
          item: null, 
          error: tmdbData.error,
          originalTitle: item.title
        };
      }

      if (!tmdbData.id) {
        return {
          item: null,
          error: 'Invalid TMDB response: missing ID',
          originalTitle: item.title
        };
      }

      const mediaItem: MediaItem = {
        id: tmdbData.id,
        title: tmdbData.title || tmdbData.name || item.title, // Fallback to original title if TMDB title is missing
        type: item.type,
        posterPath: tmdbData.poster_path,
        genres: tmdbData.genres,
        rating: tmdbData.vote_average,
        watchProviders: tmdbData['watch/providers']?.results?.US?.flatrate?.map(provider => ({
          id: provider.provider_id,
          name: provider.provider_name,
          logo_path: provider.logo_path
        })) || [],
      };

      await setCachedData(cacheKey, mediaItem, CACHE_TTL);
      return { item: mediaItem, originalTitle: item.title };
    })
  );

  return results;
}

export async function GET(request: Request) {
  try {
    const personalItems = await getPersonalCatalog();
    const enrichedItems: MediaItem[] = [];
    const failedItems: { title: string; error: string }[] = [];
    const totalItems = personalItems.length;
    
    // Process items in batches
    for (let i = 0; i < personalItems.length; i += BATCH_SIZE) {
      const batchResults = await processBatch(personalItems, i, BATCH_SIZE);
      
      batchResults.forEach(result => {
        if (result.item) {
          enrichedItems.push(result.item);
        } else if (result.error) {
          failedItems.push({
            title: result.originalTitle,
            error: result.error
          });
        }
      });
      
      // Calculate progress
      const progress = Math.min(100, Math.round((i + BATCH_SIZE) / totalItems * 100));
      
      if (i + BATCH_SIZE < personalItems.length) {
        // Wait between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return NextResponse.json({
      items: enrichedItems,
      total: enrichedItems.length,
      hasMore: false,
      progress: 100,
      failedItems: failedItems
    });
  } catch (error) {
    console.error('Error in personal catalog API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personal catalog' },
      { status: 500 }
    );
  }
} 