import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/redis';
import { fetchTMDBData, transformTMDBData } from '@/lib/tmdb';
import type { MediaItem } from '@/types';

const CACHE_TTL = 3600; // 1 hour
const BATCH_SIZE = 10;
const BATCH_DELAY = 100;

async function enrichItemWithTMDBData(item: any): Promise<MediaItem> {
  const cacheKey = generateCacheKey(`personal-${item.type}-${item.media_id}`);
  const cached = await getCachedData(cacheKey) as MediaItem | null;
  
  if (cached) {
    return {
      ...cached,
      rating: item.rating,
      added_at: item.added_at,
    };
  }

  const tmdbData = await fetchTMDBData(item.type, item.media_id);
  const enrichedItem = transformTMDBData(tmdbData, {
    type: item.type,
    rating: item.rating,
    added_at: item.added_at
  });

  await setCachedData(cacheKey, enrichedItem, CACHE_TTL);
  return enrichedItem;
}

type Context = {
  params: Promise<{ userId: string }>;
};

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    const params = await context.params;
    const userId = params.userId;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get catalog items
    const { data: items, error: itemsError } = await supabase
      .from('personal_catalog')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (itemsError) {
      throw itemsError;
    }

    // Enrich items with TMDB data in batches
    const enrichedItems: MediaItem[] = [];
    const failedItems: { title: string; error: string }[] = [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(item => enrichItemWithTMDBData(item))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          enrichedItems.push(result.value);
        } else {
          failedItems.push({
            title: batch[index].title,
            error: result.reason?.message || 'Failed to fetch media details'
          });
        }
      });

      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return NextResponse.json({
      items: enrichedItems,
      failedItems,
      userName: profile.full_name || 'User',
    });
  } catch (error) {
    console.error('Error fetching shared catalog:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog' },
      { status: 500 }
    );
  }
} 