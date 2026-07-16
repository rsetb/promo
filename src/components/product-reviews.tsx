import type { Review } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StarRating from '@/components/star-rating';

type ProductReviewsProps = {
  reviews: Review[];
};

export default function ProductReviews({ reviews }: ProductReviewsProps) {
  return (
    <section className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight text-center">
        Customer Reviews
      </h2>
      {reviews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={review.avatarUrl} alt={review.author} />
                    <AvatarFallback>
                      {review.author
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-base">{review.author}</CardTitle>
                    <StarRating rating={review.rating} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{review.comment}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">
          No reviews yet for this product.
        </p>
      )}
    </section>
  );
}
