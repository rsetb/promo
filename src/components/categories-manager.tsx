'use client';

import { useState, useTransition } from 'react';
import { Edit, PlusCircle, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { createCategory, deleteCategory, updateCategory } from '@/lib/actions';
import type { Category } from '@/lib/types';

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set('name', newName);
    startTransition(async () => {
      const result = await createCategory(formData);
      if (result.ok) {
        setNewName('');
        toast({ title: 'Sucesso!', description: 'Nova categoria adicionada.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  const save = (id: number) => {
    const formData = new FormData();
    formData.set('name', editingName);
    startTransition(async () => {
      const result = await updateCategory(id, formData);
      if (result.ok) {
        setEditingId(null);
        toast({ title: 'Sucesso!', description: 'Categoria atualizada.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    startTransition(async () => {
      const result = await deleteCategory(toDelete.id);
      if (result.ok) {
        toast({ title: 'Excluída', description: 'A categoria foi removida.' });
      } else {
        toast({ variant: 'destructive', title: 'Não foi possível excluir', description: result.error });
      }
      setToDelete(null);
    });
  };

  return (
    <>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Adicionar Nova Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Nome da nova categoria"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isPending}
              aria-label="Nome da nova categoria"
              required
            />
            <Button type="submit" disabled={isPending}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {isPending ? 'Salvando...' : 'Adicionar'}
            </Button>
          </form>
          <p className="mt-2 text-sm text-muted-foreground">
            O nome é salvo em maiúsculas e precisa ser único.
          </p>
        </CardContent>
      </Card>

      <h2 className="mb-4 text-2xl font-bold">Categorias Existentes ({categories.length})</h2>
      <div className="space-y-4">
        {categories.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma categoria encontrada.</p>
        ) : (
          categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                {editingId === category.id ? (
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') save(category.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="text-lg"
                    disabled={isPending}
                    autoFocus
                    aria-label="Nome da categoria"
                  />
                ) : (
                  <p className="text-lg font-medium">{category.name}</p>
                )}

                <div className="flex flex-shrink-0 items-center gap-2">
                  {editingId === category.id ? (
                    <>
                      <Button onClick={() => save(category.id)} size="icon" disabled={isPending} aria-label="Salvar">
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => {
                          setEditingId(category.id);
                          setEditingName(category.name);
                        }}
                        variant="outline"
                        size="icon"
                        aria-label={`Editar ${category.name}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => setToDelete(category)}
                        variant="destructive"
                        size="icon"
                        aria-label={`Excluir ${category.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso excluirá permanentemente a categoria <strong>{toDelete?.name}</strong>. Se ainda
              houver produtos nela, o banco recusará a exclusão — mova os produtos antes.
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
    </>
  );
}
