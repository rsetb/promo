import type { SiteInfo } from '@/db/schema';

export type { Category } from '@/db/schema';

/**
 * Produto como a UI consome: já com o nome da categoria resolvido pelo join,
 * em vez do category_id cru.
 *
 * `priceCents` é o preço em centavos (13780 = R$ 137,80), ou null quando não há
 * preço definido — a UI mostra "Consulte". Use os helpers de `lib/format` para
 * converter; não divida por 100 espalhado pela UI.
 */
export type ProductView = {
  id: number;
  name: string;
  description: string;
  priceCents: number | null;
  categoryId: number;
  category: string;
};

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
