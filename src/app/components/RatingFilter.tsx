'use client';

import { useEffect, useState } from 'react';
import { MOVIE_RATINGS, TV_RATINGS, type ContentRating } from '@/types';

interface RatingFilterProps {
  onRatingChange: (selectedRatings: Set<ContentRating>) => void;
}

export function RatingFilter({ onRatingChange }: RatingFilterProps) {
  // Initialize with all ratings selected
  const [selectedRatings, setSelectedRatings] = useState<Set<ContentRating>>(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem('selectedRatings');
    if (saved) {
      try {
        const parsedArray = JSON.parse(saved) as ContentRating[];
        // Validate that all items are valid ratings
        if (parsedArray.every(rating => 
          [...MOVIE_RATINGS, ...TV_RATINGS].includes(rating as any)
        )) {
          const parsed = new Set<ContentRating>(parsedArray);
          // Call onRatingChange with initial value
          requestAnimationFrame(() => onRatingChange(parsed));
          return parsed;
        }
      } catch (e) {
        console.warn('Invalid ratings in localStorage');
      }
    }
    
    // Default to all ratings selected
    const allRatings = new Set<ContentRating>([...MOVIE_RATINGS, ...TV_RATINGS]);
    // Call onRatingChange with initial value
    requestAnimationFrame(() => onRatingChange(allRatings));
    return allRatings;
  });

  // Save to localStorage whenever selections change
  useEffect(() => {
    localStorage.setItem('selectedRatings', JSON.stringify(Array.from(selectedRatings)));
  }, [selectedRatings]);

  const toggleRating = (rating: ContentRating) => {
    setSelectedRatings(prev => {
      const next = new Set(prev);
      if (next.has(rating)) {
        next.delete(rating);
      } else {
        next.add(rating);
      }
      // Call onRatingChange directly in the state update
      onRatingChange(next);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 font-medium">Movie Ratings</h3>
        <div className="flex flex-wrap gap-2">
          {MOVIE_RATINGS.map(rating => (
            <button
              key={rating}
              onClick={() => toggleRating(rating)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selectedRatings.has(rating)
                  ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium">TV Ratings</h3>
        <div className="flex flex-wrap gap-2">
          {TV_RATINGS.map(rating => (
            <button
              key={rating}
              onClick={() => toggleRating(rating)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selectedRatings.has(rating)
                  ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
} 