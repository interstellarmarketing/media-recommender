import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getCachedData, setCachedData, generateCacheKey } from '@/lib/redis';
import { fetchTMDBData, transformTMDBData } from '@/lib/tmdb';
import type { MediaItem } from '@/types';

interface PersonalCatalogItem extends Omit<MediaItem, 'id'> {
  media_id: number;
  user_id: string;
}

interface UpdatedItem {
  id: number;
  media_id: number;
  title: string;
  type: 'movie' | 'tv';
  poster_path?: string;
  genres?: Array<{ id: number; name: string; }>;
  overview?: string;
  rating?: number;
  added_at: string;
  watch_providers?: Array<{ id: number; name: string; logo_path: string; }>;
  vote_average?: number;
  release_date?: string;
  last_tmdb_update: string;
}

interface FailedUpdate {
  title: string;
  error: string;
}

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

// GET all items in personal catalog
export async function GET() {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all items with their stored TMDB data
    const { data: items, error } = await supabase
      .from('personal_catalog')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .eq('pending_deletion', false)
      .order('added_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Map items to the expected format
    const formattedItems = items.map(item => ({
      id: item.media_id,
      title: item.title,
      type: item.type,
      posterPath: item.poster_path,
      genres: item.genres,
      overview: item.overview,
      rating: item.rating,
      added_at: item.added_at,
      watchProviders: item.watch_providers,
      voteAverage: item.vote_average,
      releaseDate: item.release_date,
      contentRating: item.content_rating
    }));

    // Check for stale items in the background
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const hasStaleItems = items.some(
      item => !item.last_tmdb_update || new Date(item.last_tmdb_update) < sevenDaysAgo
    );

    if (hasStaleItems) {
      // Trigger background update
      fetch('/api/personal-catalog/update-tmdb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      }).catch(error => {
        console.error('Failed to trigger TMDB update:', error);
      });
    }

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    console.error('Error fetching personal catalog:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personal catalog' },
      { status: 500 }
    );
  }
}

// POST new item to personal catalog
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const item: MediaItem = await request.json();

    // Check if item already exists
    const { data: existing } = await supabase
      .from('personal_catalog')
      .select('id')
      .eq('user_id', user.id)
      .eq('media_id', item.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Item already in personal catalog' },
        { status: 400 }
      );
    }

    // Fetch TMDB data before inserting
    const tmdbData = await fetchTMDBData(item.type, item.id);
    if ('error' in tmdbData) {
      throw new Error(tmdbData.error);
    }

    // Add new item with TMDB data
    const transformedData = transformTMDBData(tmdbData, {
      type: item.type,
      rating: item.rating,
      added_at: new Date().toISOString()
    });

    const { data, error } = await supabase
      .from('personal_catalog')
      .insert([
        {
          user_id: user.id,
          media_id: item.id,
          title: transformedData.title,
          type: transformedData.type,
          added_at: transformedData.added_at,
          // Store TMDB data
          poster_path: transformedData.posterPath,
          genres: transformedData.genres || [],
          overview: transformedData.overview,
          vote_average: transformedData.voteAverage,
          release_date: transformedData.releaseDate,
          watch_providers: transformedData.watchProviders,
          content_rating: transformedData.contentRating,
          last_tmdb_update: new Date().toISOString()
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Return the item with all its data
    return NextResponse.json({
      id: data.media_id,
      title: data.title,
      type: data.type,
      posterPath: data.poster_path,
      genres: data.genres,
      overview: data.overview,
      rating: data.rating,
      added_at: data.added_at,
      watchProviders: data.watch_providers,
      voteAverage: data.vote_average,
      releaseDate: data.release_date,
    });
  } catch (error) {
    console.error('Error adding to personal catalog:', error);
    return NextResponse.json(
      { error: 'Failed to add item to personal catalog' },
      { status: 500 }
    );
  }
}

// DELETE endpoint for soft delete
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const mediaId = url.searchParams.get('mediaId');
  
  if (!mediaId) {
    return NextResponse.json({ error: 'Media ID is required' }, { status: 400 });
  }

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft delete by setting deleted_at timestamp
    const { error } = await supabase
      .from('personal_catalog')
      .update({ 
        deleted_at: new Date().toISOString(),
        pending_deletion: true 
      })
      .eq('user_id', user.id)
      .eq('media_id', mediaId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error soft deleting item:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}

// PATCH endpoint for restoring items
export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const mediaId = url.searchParams.get('mediaId');
  
  if (!mediaId) {
    return NextResponse.json({ error: 'Media ID is required' }, { status: 400 });
  }

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Restore item by clearing deleted_at and pending_deletion
    const { error } = await supabase
      .from('personal_catalog')
      .update({ 
        deleted_at: null,
        pending_deletion: false 
      })
      .eq('user_id', user.id)
      .eq('media_id', mediaId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error restoring item:', error);
    return NextResponse.json(
      { error: 'Failed to restore item' },
      { status: 500 }
    );
  }
} 