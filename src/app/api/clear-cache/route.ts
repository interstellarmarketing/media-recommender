import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function POST() {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    // Clear all keys
    await redis.flushall();

    return NextResponse.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Failed to clear cache:', error);
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
  }
} 