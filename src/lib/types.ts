import type { SiteInfo } from '@/db/schema';

export type { Category } from '@/db/schema';

/**
 * Produto como a UI consome: já com o nome da categoria resolvido pelo join,
 * em vez do category_id cru.
 *
 * Os preços são em centavos (13780 = R$ 137,80) e cada um é null quando o
 * produto não é vendido daquele jeito. Use os helpers de `lib/format` para
 * converter; não divida por 100 espalhado pela UI.
 */
export type ProductView = {
  id: number;
  name: string;
  description: string;
  /** Preços em centavos; null = não vendido daquela forma. */
  priceUnitCents: number | null;
  pricePackCents: number | null;
  priceBoxCents: number | null;
  /** Quantas unidades no fardo/caixa; null = não informado. */
  packQty: number | null;
  boxQty: number | null;
  categoryId: number;
  category: string;
  /** Nome do arquivo da foto, ou null. A URL sai de imageUrl(). */
  imageFile: string | null;
};

/**
 * Os jeitos de vender, numa lista só.
 *
 * Fonte única para a vitrine, o formulário de edição e as Server Actions. Em um
 * dia isto foi de 1 preço para 3; com a lista, um quarto tipo é uma entrada
 * aqui — e não uma caçada por trechos repetidos em quatro arquivos.
 *
 * A ordem é a de exibição: do menor para o maior.
 */
export const PRICE_KINDS = [
  {
    id: 'unit',
    label: 'Un.',
    formLabel: 'Preço da unidade',
    priceKey: 'priceUnitCents',
    formField: 'priceUnit',
    qtyKey: null,
    qtyFormField: null,
    qtyLabel: null,
  },
  {
    id: 'pack',
    label: 'Fardo',
    formLabel: 'Preço do fardo',
    priceKey: 'pricePackCents',
    formField: 'pricePack',
    qtyKey: 'packQty',
    qtyFormField: 'packQty',
    qtyLabel: 'Unidades por fardo',
  },
  {
    id: 'box',
    label: 'Caixa',
    formLabel: 'Preço da caixa',
    priceKey: 'priceBoxCents',
    formField: 'priceBox',
    qtyKey: 'boxQty',
    qtyFormField: 'boxQty',
    qtyLabel: 'Unidades por caixa',
  },
] as const satisfies readonly {
  id: string;
  label: string;
  formLabel: string;
  priceKey: keyof ProductView;
  formField: string;
  qtyKey: keyof ProductView | null;
  qtyFormField: string | null;
  qtyLabel: string | null;
}[];

export type PriceKind = (typeof PRICE_KINDS)[number];

/** Produto sem nenhum preço: a vitrine pede para consultar. */
export function hasNoPrice(product: ProductView): boolean {
  return PRICE_KINDS.every((kind) => product[kind.priceKey] === null);
}

/** URL pública da foto. Serve pela rota que lê o volume — ver /api/images. */
export function imageUrl(imageFile: string | null): string | null {
  return imageFile ? `/api/images/${imageFile}` : null;
}

/**
 * URL do logo. Cai no /logo.png que vem na imagem Docker enquanto o admin não
 * subir um — assim o site nunca fica sem logo, nem em banco recém-criado.
 */
export function logoUrl(logoFile: string | null): string {
  return logoFile ? `/api/images/${logoFile}` : '/logo.png';
}

/** site_info sem as colunas de controle (id, updatedAt). */
export type SiteInfoView = Omit<SiteInfo, 'id' | 'updatedAt'>;

/** Campos de site_info editáveis inline pelo admin. */
export type EditableSiteField = keyof Pick<
  SiteInfoView,
  | 'siteName'
  | 'heroTitle1'
  | 'heroTitle2'
  | 'heroSlogan'
  | 'heroLocation'
  | 'heroPhoneDisplay'
  | 'heroLocation2'
  | 'heroPhoneDisplay2'
>;

/** Retorno padrão das Server Actions, consumido pela UI para exibir erros. */
export type ActionResult = { ok: true } | { ok: false; error: string };
