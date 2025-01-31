'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/SupabaseProvider';
import { supabase } from '@/lib/supabase';

export function Navigation() {
  const { user, loading } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-primary">
                Media Recommender
              </Link>
            </div>
          </div>
          
          <div className="flex items-center">
            {loading ? (
              <div className="text-gray-500">Loading...</div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                <Link
                  href="/account"
                  className="text-gray-700 hover:text-primary transition-colors"
                >
                  Account
                </Link>
                <span className="text-gray-700">
                  Welcome, {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm px-4 py-2 border border-transparent rounded-md text-white bg-primary hover:bg-primary/90"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="space-x-4">
                <Link
                  href="/login"
                  className="text-sm px-4 py-2 border border-transparent rounded-md text-primary bg-primary/10 hover:bg-primary/20"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="text-sm px-4 py-2 border border-transparent rounded-md text-white bg-primary hover:bg-primary/90"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 