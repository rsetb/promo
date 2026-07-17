import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CategoriesManager } from '@/components/categories-manager';
import { Button } from '@/components/ui/button';
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
      {/* Sem isto a página não tem saída: o logo do header leva ao catálogo,
          mas é pequeno e não se anuncia — e para o admin o nome do site ao lado
          é campo editável, não link. */}
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao catálogo
        </Link>
      </Button>

      <h1 className="mb-6 text-3xl font-bold">Gerenciar Categorias</h1>
      <CategoriesManager categories={categories} />
    </div>
  );
}
