import Link from 'next/link';
import type { Product } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type ProductListItemProps = {
  product: Product;
};

export default function ProductListItem({ product }: ProductListItemProps) {
  return (
    <Card className="transition-all duration-300 border hover:shadow-lg hover:border-primary">
      <CardHeader>
        <div className="flex justify-between items-center gap-4">
          <div className="flex-1">
            <CardTitle>
              <Link
                href={`/products/${product.id}`}
                className="hover:underline"
              >
                {product.name}
              </Link>
            </CardTitle>
          </div>
          <div className="text-right flex items-center gap-4">
            <p className="text-xl font-bold whitespace-nowrap">
              {product.price > 0 ? `R$${product.price.toFixed(2)}` : 'Consulte'}
            </p>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
