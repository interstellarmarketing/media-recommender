import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { fetchTMDBData } from '@/lib/tmdb';
import type { TMDBResponse } from '@/lib/tmdb';

const BATCH_SIZE = 10;
const BATCH_DELAY = 100;

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
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get items that need updating
    const { data: items, error } = await supabase
      .from('personal_catalog')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    // Process items in batches
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const tmdbData = await fetchTMDBData(item.type, item.media_id);
            if (tmdbData.error) {
              console.error(`Failed to fetch TMDB data for ${item.type}/${item.media_id}:`, tmdbData.error);
              return;
            }

            // Get content rating
            let contentRating;
            if (item.type === 'movie') {
              const usReleaseInfo = tmdbData.release_dates?.results.find(r => r.iso_3166_1 === 'US');
              contentRating = usReleaseInfo?.release_dates[0]?.certification;
            } else {
              const usRating = tmdbData.content_ratings?.results.find(r => r.iso_3166_1 === 'US');
              contentRating = usRating?.rating;
            }

            // Update item in database
            const { error: updateError } = await supabase
              .from('personal_catalog')
              .update({
                poster_path: tmdbData.poster_path,
                genres: tmdbData.genres || [],
                overview: tmdbData.overview,
                vote_average: tmdbData.vote_average,
                release_date: tmdbData.release_date || tmdbData.first_air_date,
                watch_providers: tmdbData['watch/providers']?.results?.US?.flatrate || [],
                content_rating: contentRating,
                last_tmdb_update: new Date().toISOString()
              })
              .eq('user_id', userId)
              .eq('media_id', item.media_id);

            if (updateError) {
              console.error(`Failed to update item ${item.media_id}:`, updateError);
            }
          } catch (error) {
            console.error(`Error processing item ${item.media_id}:`, error);
          }
        })
      );

      if (i + BATCH_SIZE < items.length) {
        // Wait between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in update TMDB data:', error);
    return NextResponse.json(
      { error: 'Failed to update TMDB data' },
      { status: 500 }
    );
  }
} 