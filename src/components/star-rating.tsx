import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

type StarRatingProps = {
  rating: number;
  className?: string;
};

export default function StarRating({ rating, className }: StarRatingProps) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {[...Array(5)].map((_, index) => (
        <Star
          key={index}
          className={cn(
            'h-5 w-5',
            rating > index
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
}
