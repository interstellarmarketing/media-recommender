import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { fetchTMDBData, transformTMDBData } from '@/lib/tmdb';
import type { MediaItem } from '@/types';

const BATCH_SIZE = 10;
const BATCH_DELAY = 1000; // 1 second delay between batches to avoid rate limits

interface FailedItem {
  title: string;
  error: string;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value ?? '';
          },
        },
      }
    );

    const { userId } = await request.json();

    // Get all items that need updating
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: items, error } = await supabase
      .from('personal_catalog')
      .select('*')
      .eq('user_id', userId)
      .or(`last_tmdb_update.is.null,last_tmdb_update.lt.${sevenDaysAgo.toISOString()}`);

    if (error) {
      throw error;
    }

    // Update items in batches
    const updatedItems: MediaItem[] = [];
    const failedItems: FailedItem[] = [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          const tmdbData = await fetchTMDBData(item.type, item.media_id);
          if ('error' in tmdbData) {
            throw new Error(tmdbData.error);
          }

          const transformedData = transformTMDBData(tmdbData, {
            type: item.type,
            rating: item.rating,
            added_at: item.added_at
          });

          // Update item in database
          const { error: updateError } = await supabase
            .from('personal_catalog')
            .update({
              title: transformedData.title,
              poster_path: transformedData.posterPath,
              genres: transformedData.genres,
              overview: transformedData.overview,
              vote_average: transformedData.voteAverage,
              release_date: transformedData.releaseDate,
              watch_providers: transformedData.watchProviders,
              last_tmdb_update: new Date().toISOString()
            })
            .eq('id', item.id);

          if (updateError) {
            throw updateError;
          }

          return transformedData;
        })
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          updatedItems.push(result.value);
        } else {
          failedItems.push({
            title: batch[index].title,
            error: result.reason?.message || 'Failed to update TMDB data'
          });
        }
      });

      // Add delay between batches
      if (i + BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return NextResponse.json({
      updated: updatedItems.length,
      failed: failedItems.length,
      failedItems
    });
  } catch (error) {
    console.error('Error populating TMDB data:', error);
    return NextResponse.json(
      { error: 'Failed to populate TMDB data' },
      { status: 500 }
    );
  }
} 