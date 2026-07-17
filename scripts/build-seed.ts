/**
 * Gera data/seed.json a partir de data/catalog-export.json.
 *
 * Roda no BUILD (onde existe tsx e os fontes TypeScript), não em produção. A
 * transformação — dedupe, normalização de nomes, preços em centavos — acontece
 * aqui, uma vez, e o resultado vai pronto para a imagem. Assim o container não
 * precisa de tsx nem da lógica de transformação: ele só insere linhas.
 *
 * Uso: npx tsx scripts/build-seed.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildCategories, buildProducts, type CatalogExport } from './lib/transform';
import { DEFAULT_SITE_INFO } from './lib/site-info';

const data: CatalogExport = JSON.parse(readFileSync('data/catalog-export.json', 'utf8'));

const categories = buildCategories(data);
const { products, decisions } = buildProducts(data);

const seed = {
  generatedAt: new Date().toISOString(),
  categories,
  products,
  siteInfo: { ...DEFAULT_SITE_INFO, ...(data.siteInfo ?? {}) },
};

writeFileSync('data/seed.json', JSON.stringify(seed, null, 2));

console.log(`origem:  ${data.products.length} produtos, ${data.categories.length} categorias`);
console.log(`seed:    ${products.length} produtos, ${categories.length} categorias`);
if (decisions.length) {
  console.log(`duplicados resolvidos: ${decisions.length} (mantida a versão editada no site)`);
  for (const d of decisions) {
    console.log(`  ${d.name}: ficou ${d.kept.id}=${d.kept.price ?? 'sem preço'}`);
  }
}
console.log('-> data/seed.json');
