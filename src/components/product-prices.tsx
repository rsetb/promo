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
            {/*
              Menor no celular: com "CAIXA 12UN R$ 802,80" em text-xl, o bloco
              de preço tomava mais da metade de uma tela de 375px e sobrava tão
              pouco para o nome que "ABSOLUT" quebrava em "ABSO/LUT".
            */}
            <span className="mr-1 text-[10px] font-medium uppercase text-muted-foreground sm:text-xs">
              {kind.label}
              {qty !== null && ` ${qty}un`}
            </span>
            <span className="text-base font-bold sm:text-xl">{formatPrice(cents)}</span>
          </p>
        );
      })}
    </div>
  );
}
