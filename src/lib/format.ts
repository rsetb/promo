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
  return maskPriceInput(String(priceCents));
}

/**
 * Máscara de digitação: os dígitos entram pela direita, como numa maquininha.
 *
 *   ""      -> ""
 *   "6"     -> "0,06"
 *   "66"    -> "0,66"
 *   "6699"  -> "66,99"
 *   "123456"-> "1.234,56"
 *
 * Recebe qualquer coisa e considera só os dígitos, então serve tanto para o que
 * o usuário digita quanto para colar "R$ 1.234,56" de outro lugar.
 */
export function maskPriceInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  const cents = Number(digits);
  // Zero volta vazio para o campo não mentir: parsePriceToCents trata 0 como
  // "sem preço", então mostrar "0,00" prometeria um preço que não seria salvo.
  if (!Number.isFinite(cents) || cents === 0) return '';

  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte o que o admin digitou ("1.234,56", "1234.56", "99") em centavos.
 *
 * Vazio, inválido OU zero viram null ("Consulte"). Zero cair em null é
 * proposital: "sem preço" tem uma representação só, igual ao que a migração
 * fez com os 44 produtos que tinham preço 0. Sem isso, dava para recriar pela
 * tela justamente o estado ambíguo que o banco eliminou.
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
  if (!Number.isFinite(value) || value <= 0) return null;

  return Math.round(value * 100);
}
