import { MediaRecommender } from '@/components/MediaRecommender';
import { MediaLists } from '@/components/MediaLists';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto space-y-8">
        <MediaLists />
        <MediaRecommender />
      </div>
    </main>
  );
} 