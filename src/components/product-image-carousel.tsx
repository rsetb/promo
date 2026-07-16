'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

type ImagePlaceholder = {
  imageUrl: string;
  imageHint: string;
};

type ProductImageCarouselProps = {
  images: ImagePlaceholder[];
  productName: string;
};

export default function ProductImageCarousel({ images, productName }: ProductImageCarouselProps) {
    if (!images || images.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="relative aspect-square flex items-center justify-center p-0 bg-muted">
          <p className="text-muted-foreground">Sem imagem</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Carousel className="w-full" opts={{ loop: true }}>
      <CarouselContent>
        {images.map((image, index) => (
          <CarouselItem key={index}>
            <div className="p-1">
              <Card className="overflow-hidden">
                <CardContent className="relative aspect-square flex items-center justify-center p-0">
                  <Image
                    src={image.imageUrl}
                    alt={`${productName} - image ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    data-ai-hint={image.imageHint}
                  />
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 z-10" />
      <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 z-10" />
    </Carousel>
  );
}
