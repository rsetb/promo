import { formatPrice } from '@/lib/format';
import { hasNoPrice, type ProductView } from '@/lib/types';

/**
 * Os preços do produto na vitrine.
 *
 * Mostra só o que existe: um produto vendido só em fardo não ganha uma linha
 * "Un. —". Sem nenhum dos dois, "Consulte".
 *
 * O rótulo é obrigatório quando há preço: "R$ 35,70" sozinho, num catálogo que
 * tem fardo e unidade, deixa o cliente sem saber o que está comprando.
 */
export function ProductPrices({
  product,
}: {
  product: Pick<ProductView, 'pricePackCents' | 'priceUnitCents'>;
}) {
  if (hasNoPrice(product)) {
    return <p className="whitespace-nowrap text-xl font-bold">Consulte</p>;
  }

  return (
    <div className="text-right">
      {product.pricePackCents !== null && (
        <p className="whitespace-nowrap text-xl font-bold leading-tight">
          <span className="mr-1 text-xs font-medium uppercase text-muted-foreground">Fardo</span>
          {formatPrice(product.pricePackCents)}
        </p>
      )}
      {product.priceUnitCents !== null && (
        <p className="whitespace-nowrap text-xl font-bold leading-tight">
          <span className="mr-1 text-xs font-medium uppercase text-muted-foreground">Un.</span>
          {formatPrice(product.priceUnitCents)}
        </p>
      )}
    </div>
  );
}
