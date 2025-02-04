import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Context = {
  params: Promise<{ userId: string }>;
};

export async function GET(
  request: NextRequest,
  context: Context
): Promise<Response> {
  try {
    const params = await context.params;
    const userId = params.userId;

    // Initialize Supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );

    // Get catalog items with all stored TMDB data
    const { data: items, error: itemsError } = await supabase
      .from('personal_catalog')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .eq('pending_deletion', false)
      .order('added_at', { ascending: false });

    if (itemsError) {
      console.error('Items error:', itemsError);
      throw itemsError;
    }

    // If no items found, return early with empty response
    if (!items || items.length === 0) {
      return NextResponse.json({
        items: [],
        failedItems: [],
        userName: 'User',
      });
    }

    // Get user profile if items exist
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();

    // Format items with stored TMDB data
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
      // Trigger background update without waiting for response
      fetch('/api/personal-catalog/update-tmdb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      }).catch(error => {
        console.error('Failed to trigger TMDB update:', error);
      });
    }

    return NextResponse.json({
      items: formattedItems,
      userName: profile?.full_name || 'User',
    });
  } catch (error) {
    console.error('Error fetching shared catalog:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog' },
      { status: 500 }
    );
  }
} 