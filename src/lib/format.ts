const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Preço null significa "sem preço definido" — a vitrine pede para consultar. */
export function formatPrice(price: number | null): string {
  if (price === null) return 'Consulte';
  return currency.format(price);
}

/** Valor para o input de edição: 137.8 -> "137,80"; null -> "". */
export function priceToInput(price: number | null): string {
  if (price === null) return '';
  return price.toFixed(2).replace('.', ',');
}
