'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddProductDialog } from '@/components/add-product-dialog';
import { ProductRow } from '@/components/product-row';
import { useToast } from '@/hooks/use-toast';
import { deleteProduct } from '@/lib/actions';
import type { Category, ProductView } from '@/lib/types';

const ALL = 'TODOS';

/** Ignora acentos e caixa, para que "energeticos" encontre "ENERGÉTICOS". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

type CatalogProps = {
  products: ProductView[];
  categories: Category[];
  canEdit: boolean;
};

export function Catalog({ products, categories, canEdit }: CatalogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductView | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const filtered = useMemo(() => {
    const needle = fold(searchTerm.trim());
    return products.filter((product) => {
      const matchesSearch = !needle || fold(product.name).includes(needle);
      const matchesCategory = selectedCategory === ALL || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const confirmDelete = () => {
    if (!productToDelete) return;
    startTransition(async () => {
      const result = await deleteProduct(productToDelete.id);
      if (result.ok) {
        router.refresh();
        toast({ title: 'Excluído', description: 'O produto foi removido do catálogo.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
      setProductToDelete(null);
    });
  };

  return (
    <div className="container relative z-10 mx-auto -mt-16 px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-lg border bg-card p-4 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-background pl-10"
              aria-label="Buscar produtos"
            />
          </div>
          {canEdit && (
            <Button onClick={() => setIsAddOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Produto
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[ALL, ...categories.map((c) => c.name)].map((name) => (
            <Button
              key={name}
              variant={selectedCategory === name ? 'default' : 'secondary'}
              onClick={() => setSelectedCategory(name)}
              size="sm"
              className="rounded-full"
            >
              {name}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                categories={categories}
                canEdit={canEdit}
                onRequestDelete={setProductToDelete}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center rounded-lg border bg-card py-20 text-center">
            <h3 className="text-2xl font-semibold">Nenhum produto encontrado</h3>
            <p className="mt-2 text-muted-foreground">Tente ajustar seus filtros.</p>
          </div>
        )}
      </div>

      {canEdit && (
        <AddProductDialog isOpen={isAddOpen} onOpenChange={setIsAddOpen} categories={categories} />
      )}

      <AlertDialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente o produto{' '}
              <strong>{productToDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
