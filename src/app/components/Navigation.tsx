'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/SupabaseProvider';
import { getSupabase } from '@/lib/supabase';

export function Navigation() {
  const { user } = useAuth();

  const handleSignOut = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center px-2 text-gray-900 font-medium">
              Media Recommender
            </Link>
          </div>
          <div className="flex items-center">
            {user ? (
              <>
                <Link href="/account" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Account
                </Link>
                <button
                  onClick={handleSignOut}
                  className="ml-4 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/login" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 