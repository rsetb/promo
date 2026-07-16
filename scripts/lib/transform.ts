/**
 * Transformação dos dados exportados do Firestore para o formato do Postgres.
 *
 * Funções puras, sem I/O: o import e o teste de verificação usam exatamente o
 * mesmo código, então o que o teste aprova é o que roda na migração real.
 */

export type FirestoreProduct = {
  id: string;
  name: string;
  description?: string;
  price?: number | null;
  category: string;
};

export type FirestoreCategory = { id: string; name: string };

export type FirestoreExport = {
  products: FirestoreProduct[];
  categories: FirestoreCategory[];
  siteInfo: Record<string, string> | null;
};

export type CleanProduct = {
  name: string;
  description: string;
  price: number | null;
  category: string;
};

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
 * No Firestore, "sem preço" tinha duas representações: null e 0 — ambas exibidas
 * como "Consulte". No Postgres passa a ser só NULL.
 */
export function normalizePrice(price: number | null | undefined): number | null {
  if (price === null || price === undefined) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  return Math.round(price * 100) / 100;
}

/**
 * IDs no formato `prod-N` vieram da lista estática (src/lib/products.ts); os
 * demais foram gerados pelo Firestore quando o produto foi criado ou recriado
 * pela interface do site. Quando os dois existem para o mesmo nome, o do site é
 * o que o dono do catálogo editou por último.
 */
export function isSeedId(id: string): boolean {
  return /^prod-\d+$/.test(id);
}

export type DedupeDecision = {
  name: string;
  kept: FirestoreProduct;
  dropped: FirestoreProduct[];
};

/**
 * Remove produtos duplicados por nome, preferindo a versão editada no site.
 * Retorna também as decisões tomadas, para que o import possa registrá-las.
 */
export function dedupeProducts(items: FirestoreProduct[]): {
  products: FirestoreProduct[];
  decisions: DedupeDecision[];
} {
  const groups = new Map<string, FirestoreProduct[]>();
  for (const item of items) {
    const key = normalizeName(item.name).toUpperCase();
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const products: FirestoreProduct[] = [];
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
export function buildCategories(data: FirestoreExport): string[] {
  const names = new Set<string>();
  for (const category of data.categories) names.add(normalizeCategory(category.name));
  // Garante que toda categoria referenciada por um produto exista, mesmo que
  // não haja registro correspondente na coleção de categorias.
  for (const product of data.products) names.add(normalizeCategory(product.category));
  return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function buildProducts(data: FirestoreExport): {
  products: CleanProduct[];
  decisions: DedupeDecision[];
} {
  const { products, decisions } = dedupeProducts(data.products);
  return {
    products: products
      .map((p) => ({
        name: normalizeName(p.name),
        description: (p.description ?? '').trim(),
        price: normalizePrice(p.price),
        category: normalizeCategory(p.category),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    decisions,
  };
}
