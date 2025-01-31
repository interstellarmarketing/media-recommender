'use client';

import React, { useState, useEffect } from 'react';
import { ListPlus } from 'lucide-react';
import type { MediaItem, MediaList } from '@/types';

interface AddToListButtonProps {
  item: MediaItem;
  className?: string;
}

export function AddToListButton({ item, className = '' }: AddToListButtonProps) {
  const [lists, setLists] = useState<MediaList[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Load lists from localStorage
  useEffect(() => {
    const savedLists = localStorage.getItem('mediaLists');
    if (savedLists) {
      setLists(JSON.parse(savedLists));
    }
  }, []);

  const addToList = (listId: string) => {
    const updatedLists = lists.map(list => {
      if (list.id === listId) {
        // Don't add if already in list
        if (list.items.some(existing => existing.id === item.id)) {
          return list;
        }
        return {
          ...list,
          items: [...list.items, item],
          updatedAt: new Date().toISOString()
        };
      }
      return list;
    });

    setLists(updatedLists);
    localStorage.setItem('mediaLists', JSON.stringify(updatedLists));
    setIsOpen(false);
  };

  if (lists.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 ${className}`}
        title="Add to List"
      >
        <ListPlus size={16} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50">
            <div className="py-1">
              {lists.map(list => (
                <button
                  key={list.id}
                  onClick={() => addToList(list.id)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                >
                  {list.name}
                  {list.items.some(existing => existing.id === item.id) && (
                    <span className="ml-2 text-green-500">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
} 