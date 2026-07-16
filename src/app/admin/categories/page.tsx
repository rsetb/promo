import { redirect } from 'next/navigation';
import { CategoriesManager } from '@/components/categories-manager';
import { isAdmin } from '@/lib/auth';
import { getCategories } from '@/lib/queries';

/**
 * Antes esta página era um client component sem nenhuma verificação: qualquer
 * visitante abria /admin/categories. Agora o acesso é decidido no servidor,
 * antes de qualquer HTML ser gerado.
 */
export default async function CategoriesPage() {
  if (!(await isAdmin())) {
    redirect('/login');
  }

  const categories = await getCategories();

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Gerenciar Categorias</h1>
      <CategoriesManager categories={categories} />
    </div>
  );
}
