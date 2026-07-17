/**
 * Transformação do catálogo exportado do sistema antigo para o formato do
 * Postgres (data/catalog-export.json).
 *
 * Funções puras, sem I/O: o import e o teste de verificação usam exatamente o
 * mesmo código, então o que o teste aprova é o que roda na migração real.
 */

export type ExportedProduct = {
  id: string;
  name: string;
  description?: string;
  price?: number | null;
  category: string;
};

export type ExportedCategory = { id: string; name: string };

export type CatalogExport = {
  products: ExportedProduct[];
  categories: ExportedCategory[];
  siteInfo: Record<string, string> | null;
};

export type CleanProduct = {
  name: string;
  description: string;
  /** Centavos (13780 = R$ 137,80), ou null. */
  priceUnitCents: number | null;
  pricePackCents: number | null;
  /** O export antigo nao tinha caixa nem quantidades: nascem vazios. */
  priceBoxCents: number | null;
  packQty: number | null;
  boxQty: number | null;
  category: string;
};

/**
 * Categorias vendidas por garrafa; o resto é fardo.
 *
 * O export antigo tinha um preço só, sem dizer qual era. A separação veio das
 * médias por categoria e foi confirmada pelo dono do catálogo: CERVEJAS LATAS a
 * R$ 36 de média não é o preço de uma lata, é a caixa; ABSOLUT a R$ 66,90 é uma
 * garrafa.
 *
 * A MESMA regra está em drizzle/0004_precos_fardo_unidade.sql, que trata do
 * banco que já existe. As duas precisam concordar, senão um deploy novo (seed)
 * fica diferente da VPS (migration) — o scripts/verify-migration.ts confere.
 */
export const UNIT_PRICED_CATEGORIES = [
  'VODKAS',
  'WHISKYS',
  'GIN',
  'LICORES',
  'VINHOS',
  'DESTILADOS',
] as const;

export function isUnitPriced(category: string): boolean {
  return (UNIT_PRICED_CATEGORIES as readonly string[]).includes(category);
}

/**
 * Correções de digitação em categorias. 'CIGARRO NACIONAL' foi criada por engano
 * ao lado de 'CIGARROS NACIONAL' e tinha um único produto.
 */
const CATEGORY_FIXES: Record<string, string> = {
  'CIGARRO NACIONAL': 'CIGARROS NACIONAL',
};

/** Colapsa espaços internos e remove os das pontas. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function normalizeCategory(name: string): string {
  const cleaned = normalizeName(name).toUpperCase();
  return CATEGORY_FIXES[cleaned] ?? cleaned;
}

/**
 * Converte o preço do export (reais, ponto flutuante) para centavos inteiros.
 *
 * No banco antigo, "sem preço" tinha duas representações: null e 0 — ambas
 * exibidas como "Consulte". Aqui passa a ser só NULL.
 */
export function normalizePriceToCents(price: number | null | undefined): number | null {
  if (price === null || price === undefined) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  return Math.round(price * 100);
}

/**
 * IDs no formato `prod-N` vieram da lista estática que semeava o banco antigo;
 * os demais foram gerados automaticamente quando o produto foi criado ou
 * recriado pela interface do site. Quando os dois existem para o mesmo nome, o
 * do site é o que o dono do catálogo editou por último.
 */
export function isSeedId(id: string): boolean {
  return /^prod-\d+$/.test(id);
}

export type DedupeDecision = {
  name: string;
  kept: ExportedProduct;
  dropped: ExportedProduct[];
};

/**
 * Remove produtos duplicados por nome, preferindo a versão editada no site.
 * Retorna também as decisões tomadas, para que o import possa registrá-las.
 */
export function dedupeProducts(items: ExportedProduct[]): {
  products: ExportedProduct[];
  decisions: DedupeDecision[];
} {
  const groups = new Map<string, ExportedProduct[]>();
  for (const item of items) {
    const key = normalizeName(item.name).toUpperCase();
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const products: ExportedProduct[] = [];
  const decisions: DedupeDecision[] = [];

  for (const [key, group] of groups) {
    if (group.length === 1) {
      products.push(group[0]);
      continue;
    }
    const edited = group.filter((p) => !isSeedId(p.id));
    const kept = edited[0] ?? group[0];
    products.push(kept);
    decisions.push({ name: key, kept, dropped: group.filter((p) => p !== kept) });
  }

  return { products, decisions };
}

/** Lista final de categorias: normalizadas, sem duplicatas, ordenadas. */
export function buildCategories(data: CatalogExport): string[] {
  const names = new Set<string>();
  for (const category of data.categories) names.add(normalizeCategory(category.name));
  // Garante que toda categoria referenciada por um produto exista, mesmo que
  // não haja registro correspondente na coleção de categorias.
  for (const product of data.products) names.add(normalizeCategory(product.category));
  return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function buildProducts(data: CatalogExport): {
  products: CleanProduct[];
  decisions: DedupeDecision[];
} {
  const { products, decisions } = dedupeProducts(data.products);
  return {
    products: products
      .map((p) => {
        const category = normalizeCategory(p.category);
        const cents = normalizePriceToCents(p.price);
        const unit = isUnitPriced(category);
        return {
          name: normalizeName(p.name),
          description: (p.description ?? '').trim(),
          priceUnitCents: unit ? cents : null,
          pricePackCents: unit ? null : cents,
          priceBoxCents: null,
          packQty: null,
          boxQty: null,
          category,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    decisions,
  };
}
