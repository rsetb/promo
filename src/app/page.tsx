import { Catalog } from '@/components/catalog';
import { Hero } from '@/components/hero';
import { isAdmin } from '@/lib/auth';
import { getCategories, getProducts, getSiteInfo } from '@/lib/queries';

/**
 * A home é um Server Component: os dados vêm do Postgres aqui, no servidor, e
 * chegam ao browser já renderizados. O navegador nunca fala com o banco.
 */
export default async function Home() {
  const [products, categories, siteInfo, admin] = await Promise.all([
    getProducts(),
    getCategories(),
    getSiteInfo(),
    isAdmin(),
  ]);

  return (
    <>
      <Hero siteInfo={siteInfo} canEdit={admin} />
      <Catalog products={products} categories={categories} canEdit={admin} />
    </>
  );
}
