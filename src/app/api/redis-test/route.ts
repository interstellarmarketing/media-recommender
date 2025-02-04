import { NextResponse } from 'next/server';
import { getCachedData, setCachedData } from '@/lib/redis';

export async function GET(request: Request) {
  try {
    const testKey = 'test-key';
    const testData = {
      message: 'Hello from Redis!',
      timestamp: new Date().toISOString()
    };

    // First, try to get data from cache
    const cachedData = await getCachedData(testKey);
    
    if (cachedData) {
      return NextResponse.json({
        source: 'cache',
        data: cachedData
      });
    }

    // If no cached data, set new data
    await setCachedData(testKey, testData, 60); // Cache for 60 seconds

    return NextResponse.json({
      source: 'new',
      data: testData
    });
  } catch (error) {
    console.error('Redis test error:', error);
    return NextResponse.json(
      { error: 'Redis test failed', details: error },
      { status: 500 }
    );
  }
} 