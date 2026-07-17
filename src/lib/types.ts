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
  /** Preço do fardo/caixa, ou null. */
  pricePackCents: number | null;
  /** Preço da unidade avulsa, ou null. */
  priceUnitCents: number | null;
  categoryId: number;
  category: string;
  /** Nome do arquivo da foto, ou null. A URL sai de imageUrl(). */
  imageFile: string | null;
};

/** Produto sem nenhum preço: a vitrine pede para consultar. */
export function hasNoPrice(product: Pick<ProductView, 'pricePackCents' | 'priceUnitCents'>): boolean {
  return product.pricePackCents === null && product.priceUnitCents === null;
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
