import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    // Get the first item from personal catalog
    const { data: item, error: selectError } = await supabase
      .from('personal_catalog')
      .select('*')
      .limit(1)
      .single();

    if (selectError) {
      throw selectError;
    }

    if (!item) {
      return NextResponse.json({ error: 'No items found in personal catalog' }, { status: 404 });
    }

    // Test update with some TMDB-like data
    const testData = {
      poster_path: '/test_poster.jpg',
      genres: [{ id: 1, name: 'Test Genre' }],
      overview: 'This is a test overview to verify TMDB data storage.',
      vote_average: 8.5,
      release_date: '2024-02-01',
      watch_providers: [{ id: 1, name: 'Test Provider', logo_path: '/test_logo.jpg' }],
      last_tmdb_update: new Date().toISOString()
    };

    // Update the item with test data
    const { data: updatedItem, error: updateError } = await supabase
      .from('personal_catalog')
      .update(testData)
      .eq('id', item.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      message: 'Test successful',
      original: item,
      updated: updatedItem
    });
  } catch (error) {
    console.error('Test failed:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error },
      { status: 500 }
    );
  }
} 