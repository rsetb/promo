import type { Category, SiteInfo } from '@/db/schema';

export type { Category } from '@/db/schema';

/**
 * Produto como a UI consome: já com o nome da categoria resolvido pelo join,
 * em vez do category_id cru.
 *
 * `price` é null quando não há preço definido — a UI mostra "Consulte".
 */
export type ProductView = {
  id: number;
  name: string;
  description: string;
  price: number | null;
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
