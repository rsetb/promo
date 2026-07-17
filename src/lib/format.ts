const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Preços trafegam como inteiros em CENTAVOS (13780 = R$ 137,80) — é assim que
 * o banco guarda, para não perder exatidão em ponto flutuante.
 * NULL = sem preço definido; a vitrine pede para consultar.
 */
export function formatPrice(priceCents: number | null): string {
  if (priceCents === null) return 'Consulte';
  return currency.format(priceCents / 100);
}

/** Valor para o input de edição: 13780 -> "137,80"; null -> "". */
export function priceToInput(priceCents: number | null): string {
  if (priceCents === null) return '';
  return (priceCents / 100).toFixed(2).replace('.', ',');
}

/**
 * Converte o que o admin digitou ("1.234,56", "1234.56", "99") em centavos.
 * Vazio ou inválido vira null ("Consulte").
 *
 * O arredondamento acontece uma vez, aqui, na fronteira: depois disso o valor
 * é inteiro e não sofre mais erro de representação.
 */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  // "1.234,56" (pt-BR) -> "1234.56"; "1234.56" (já en-US) passa igual.
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * 100);
}
