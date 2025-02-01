'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  sizes?: string;
}

export function ImageWithFallback({
  src,
  alt,
  width = 0,
  height = 0,
  className = '',
  fill,
  sizes,
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (error || !src) {
    return (
      <div 
        className={`bg-gray-200 rounded flex items-center justify-center ${className}`}
        style={!fill ? { width: `${width}px`, height: `${height}px` } : undefined}
      >
        <span className="text-gray-400 text-sm">No Image</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <Image
        src={src}
        alt={alt}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        className={`${className} ${isLoading ? 'blur-sm' : ''}`}
        onError={() => setError(true)}
        onLoad={() => setIsLoading(false)}
        priority={false}
        loading="lazy"
        fill={fill}
        sizes={sizes}
      />
      {isLoading && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse rounded"
          style={!fill ? { width: `${width}px`, height: `${height}px` } : undefined}
        />
      )}
    </div>
  );
} 