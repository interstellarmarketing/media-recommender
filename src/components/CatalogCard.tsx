import React from 'react';
import { Star, Info, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { isRecommendedItem, type MediaItem } from '@/types';
import Image from 'next/image';

interface CatalogCardProps {
  item: MediaItem;
  isRecommended?: boolean;
  rating?: number;
  onDetailsClick?: () => void;
  onDelete?: () => void;
  isPersonalCatalog?: boolean;
  disabled?: boolean;
  extra?: React.ReactNode;
  className?: string;
}

export function CatalogCard({ 
  item, 
  isRecommended, 
  rating, 
  onDetailsClick,
  onDelete,
  isPersonalCatalog,
  disabled,
  extra,
  className 
}: CatalogCardProps) {
  const recommendationDetails = isRecommendedItem(item) ? {
    score: Math.round(item.recommendationScore * 100),
    similarity: item.thematicSimilarity ? Math.round(item.thematicSimilarity * 100) : null,
  } : null;

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-colors hover:shadow-md",
      className
    )}>
      <CardContent className="p-0">
        <div className="relative">
          <AspectRatio ratio={2/3}>
            <Image
              src={item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : '/placeholder.png'}
              alt={item.title}
              fill
              className={cn(
                "object-cover",
                "transition-opacity duration-200",
                "group-hover:opacity-90"
              )}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            
            {/* Overlay */}
            <div className={cn(
              "absolute inset-0",
              "flex flex-col justify-end",
              "bg-gradient-to-t from-background/80 via-background/40 to-transparent",
              "opacity-0 transition-opacity duration-200",
              "group-hover:opacity-100"
            )}>
              <div className="space-y-2 p-4">
                <button
                  onClick={onDetailsClick}
                  className={cn(
                    "w-full",
                    "flex items-center justify-center gap-2",
                    "rounded-md",
                    "bg-primary/20 backdrop-blur-sm",
                    "px-3 py-2",
                    "text-sm font-medium text-primary-foreground",
                    "transition-colors",
                    "hover:bg-primary/30"
                  )}
                >
                  <Info className="h-4 w-4" />
                  View Details
                </button>
                
                {isPersonalCatalog && onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    disabled={disabled}
                    className={cn(
                      "w-full",
                      "flex items-center justify-center gap-2",
                      "rounded-md",
                      "bg-red-500/20 backdrop-blur-sm",
                      "px-3 py-2",
                      "text-sm font-medium text-white",
                      "transition-colors",
                      "hover:bg-red-500/30",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                    {disabled ? 'Removing...' : 'Remove'}
                  </button>
                )}
                
                {recommendationDetails && (
                  <div className="text-sm text-primary-foreground">
                    Match Score: {recommendationDetails.score}%
                  </div>
                )}
              </div>
            </div>
          </AspectRatio>

          {/* Badges */}
          <div className="absolute left-2 right-2 top-2 flex justify-between gap-2">
            {typeof rating === 'number' && (
              <Badge variant="outline" className={cn(
                "flex items-center gap-1",
                "bg-primary text-primary-foreground"
              )}>
                <Star className="h-3 w-3" />
                {rating.toFixed(1)}
              </Badge>
            )}
            {isRecommended && (
              <Badge variant="outline" className={cn(
                "bg-green-500/90 text-white"
              )}>
                Recommended
              </Badge>
            )}
          </div>

          {/* Watch Providers */}
          {item.watchProviders && item.watchProviders.length > 0 && (
            <div className="absolute bottom-2 left-2 flex -space-x-2">
              {item.watchProviders.slice(0, 3).map((provider) => (
                <Avatar
                  key={provider.id}
                  className={cn(
                    "h-6 w-6",
                    "border-2 border-background",
                    "ring-1 ring-background"
                  )}
                >
                  <AvatarImage
                    src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                    alt={provider.name || 'Provider'}
                  />
                  <AvatarFallback className="text-xs">
                    {provider.name ? provider.name[0] : 'P'}
                  </AvatarFallback>
                </Avatar>
              ))}
              {item.watchProviders.length > 3 && (
                <Avatar className={cn(
                  "h-6 w-6",
                  "border-2 border-background",
                  "ring-1 ring-background"
                )}>
                  <AvatarFallback className="bg-muted text-xs">
                    +{item.watchProviders.length - 3}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-2 text-sm font-medium leading-tight">
            {item.title}
          </h3>
          {extra && <div>{extra}</div>}
        </div>
      </CardContent>
    </Card>
  );
} 