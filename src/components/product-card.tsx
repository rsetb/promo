import Link from 'next/link';
import type { Product } from '@/lib/types';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/products/${product.id}`} className="group block">
      <Card className="h-full flex flex-col overflow-hidden transition-all duration-300 border hover:shadow-accent/20 hover:shadow-lg hover:-translate-y-1">
        <CardHeader>
          <CardTitle className="text-lg font-semibold leading-tight mb-2">
            {product.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        </CardContent>
        <CardFooter className="pt-0 flex justify-between items-center">
          <p className="text-xl font-bold">
            {product.price > 0 ? `R$${product.price.toFixed(2)}` : 'Consulte'}
          </p>
          <Button variant="secondary" size="sm" asChild>
            <span className="cursor-pointer">Ver Detalhes</span>
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
