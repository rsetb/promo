import { formatPrice } from '@/lib/format';
import { hasNoPrice, PRICE_KINDS, type ProductView } from '@/lib/types';

/**
 * Os preços do produto na vitrine.
 *
 * Mostra só o que existe: um produto vendido só em fardo não ganha linhas
 * vazias de unidade e caixa. Sem nenhum preço, "Consulte".
 *
 * O rótulo é obrigatório: "R$ 35,70" sozinho, num catálogo com unidade, fardo e
 * caixa, deixa o cliente sem saber o que está comprando. A quantidade entra
 * quando informada — "Fardo 12un" responde a pergunta seguinte antes que ela
 * seja feita.
 */
export function ProductPrices({ product }: { product: ProductView }) {
  if (hasNoPrice(product)) {
    return <p className="whitespace-nowrap text-xl font-bold">Consulte</p>;
  }

  return (
    <div className="text-right">
      {PRICE_KINDS.map((kind) => {
        const cents = product[kind.priceKey] as number | null;
        if (cents === null) return null;

        const qty = kind.qtyKey ? (product[kind.qtyKey] as number | null) : null;

        return (
          <p key={kind.id} className="whitespace-nowrap leading-tight">
            <span className="mr-1 text-xs font-medium uppercase text-muted-foreground">
              {kind.label}
              {qty !== null && ` ${qty}un`}
            </span>
            <span className="text-xl font-bold">{formatPrice(cents)}</span>
          </p>
        );
      })}
    </div>
  );
}
