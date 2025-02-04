'use client';

import React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface FilterState {
  sortBy: 'rating-desc' | 'rating-asc' | 'title-asc' | 'title-desc' | 'date-desc';
  genres: string[];
  mediaType: 'all' | 'movie' | 'tv';
  minRating: number | null;
  contentRating: string | null;
}

interface FilterMenuProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  availableGenres: string[];
}

const sortOptions = [
  { value: 'rating-desc', label: 'Rating (High to Low)' },
  { value: 'rating-asc', label: 'Rating (Low to High)' },
  { value: 'title-asc', label: 'Title (A to Z)' },
  { value: 'title-desc', label: 'Title (Z to A)' },
  { value: 'date-desc', label: 'Recently Added' },
] as const;

const mediaTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV Shows' },
] as const;

const ratingOptions = [
  { value: null, label: 'Any Rating' },
  { value: 4, label: '4+ Stars' },
  { value: 3, label: '3+ Stars' },
  { value: 2, label: '2+ Stars' },
  { value: 1, label: '1+ Stars' },
] as const;

const contentRatingOptions = [
  { value: null, label: 'Any Rating' },
  // Movie Ratings
  { value: 'G', label: 'G' },
  { value: 'PG', label: 'PG' },
  { value: 'PG-13', label: 'PG-13' },
  { value: 'R', label: 'R' },
  { value: 'NC-17', label: 'NC-17' },
  // TV Ratings
  { value: 'TV-Y', label: 'TV-Y' },
  { value: 'TV-Y7', label: 'TV-Y7' },
  { value: 'TV-PG', label: 'TV-PG' },
  { value: 'TV-14', label: 'TV-14' },
  { value: 'TV-MA', label: 'TV-MA' },
] as const;

export function FilterMenu({ filters, onFilterChange, availableGenres }: FilterMenuProps) {
  const [openSort, setOpenSort] = React.useState(false);
  const [openGenre, setOpenGenre] = React.useState(false);

  const currentSortOption = sortOptions.find(option => option.value === filters.sortBy);

  return (
    <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
      {/* Sort Dropdown */}
      <select
        value={filters.sortBy}
        onChange={(e) => onFilterChange({ ...filters, sortBy: e.target.value as FilterState['sortBy'] })}
        className="w-full sm:w-[200px] h-10 rounded-md border border-input bg-background px-3 py-2"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Genre Filter */}
      <select
        value={filters.genres[0] || ''}
        onChange={(e) => {
          const selectedGenre = e.target.value;
          onFilterChange({ 
            ...filters, 
            genres: selectedGenre ? [selectedGenre] : [] 
          });
        }}
        className="w-full sm:w-[200px] h-10 rounded-md border border-input bg-background px-3 py-2"
      >
        <option value="">All Genres</option>
        {availableGenres.map((genre) => (
          <option key={genre} value={genre}>
            {genre}
          </option>
        ))}
      </select>

      {/* Media Type Filter */}
      <select
        value={filters.mediaType}
        onChange={(e) => onFilterChange({ ...filters, mediaType: e.target.value as FilterState['mediaType'] })}
        className="w-full sm:w-[150px] h-10 rounded-md border border-input bg-background px-3 py-2"
      >
        {mediaTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>

      {/* Rating Filter */}
      <select
        value={filters.minRating?.toString() ?? ''}
        onChange={(e) => onFilterChange({ ...filters, minRating: e.target.value ? Number(e.target.value) : null })}
        className="w-full sm:w-[150px] h-10 rounded-md border border-input bg-background px-3 py-2"
      >
        {ratingOptions.map((option) => (
          <option key={option.label} value={option.value ?? ''}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Content Rating Filter */}
      <select
        value={filters.contentRating ?? ''}
        onChange={(e) => onFilterChange({ ...filters, contentRating: e.target.value || null })}
        className="w-full sm:w-[150px] h-10 rounded-md border border-input bg-background px-3 py-2"
      >
        {contentRatingOptions.map((option) => (
          <option key={option.label} value={option.value ?? ''}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
} 