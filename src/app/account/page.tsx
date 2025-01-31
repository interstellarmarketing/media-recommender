'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/SupabaseProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { redirect } from 'next/navigation';

interface MediaList {
  id: string;
  name: string;
  description: string | null;
  items: any[];
  createdAt: string;
  updatedAt: string;
}

// This ensures the page is only rendered on the client
let isClient = false;

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<MediaList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    isClient = true;
  }, []);

  useEffect(() => {
    if (!loading && !user && mounted) {
      router.replace('/login');
    }
  }, [loading, user, router, mounted]);

  useEffect(() => {
    const fetchLists = async () => {
      if (!user?.id || !mounted) return;
      
      try {
        const response = await fetch('/api/lists', {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch lists');
        }
        const data = await response.json();
        setLists(data);
      } catch (error) {
        console.error('Failed to fetch lists:', error);
      } finally {
        setLoadingLists(false);
      }
    };

    fetchLists();
  }, [user?.id, mounted]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newListName,
          description: newListDescription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create list');
      }

      const newList = await response.json();
      setLists([newList, ...lists]);
      setShowCreateForm(false);
      setNewListName('');
      setNewListDescription('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create list');
    }
  };

  // Don't render anything on the server
  if (!mounted) {
    return null;
  }

  // Show loading state
  if (loading || loadingLists) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-6">
          {/* User Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Email:</span> {user.email}
                </p>
                <p>
                  <span className="font-medium">Member since:</span>{' '}
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Media Lists */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Your Media Lists</CardTitle>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
              >
                {showCreateForm ? 'Cancel' : 'Create New List'}
              </button>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                  {error}
                </div>
              )}

              {showCreateForm && (
                <form onSubmit={handleCreateList} className="mb-6 space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      List Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description (optional)
                    </label>
                    <textarea
                      id="description"
                      value={newListDescription}
                      onChange={(e) => setNewListDescription(e.target.value)}
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"
                  >
                    Create List
                  </button>
                </form>
              )}

              {lists.length === 0 ? (
                <p className="text-gray-500">You haven&apos;t created any lists yet.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {lists.map((list) => (
                    <Card key={list.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">{list.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">
                          {list.description || 'No description'}
                        </p>
                        <div className="mt-2 text-sm text-gray-500">
                          <p>{list.items?.length || 0} items</p>
                          <p>
                            Last updated:{' '}
                            {new Date(list.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 