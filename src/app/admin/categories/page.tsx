'use client';

import { useState } from 'react';
import { useCategories } from '@/lib/use-categories';
import { useFirestore, FirestorePermissionError, errorEmitter } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Edit, Save, X, Trash2 } from 'lucide-react';
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
import type { Category } from '@/lib/types';

export default function CategoriesPage() {
  const { categories, isLoading, refreshCategories } = useCategories();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ variant: 'destructive', title: 'O nome da categoria não pode estar vazio.' });
      return;
    }
    if (!firestore) return;

    setIsAdding(true);
    const categoriesCollectionRef = collection(firestore, 'categories');
    const newCategory = { name: newCategoryName };
    
    addDoc(categoriesCollectionRef, newCategory)
        .then(() => {
            toast({ title: 'Sucesso!', description: 'Nova categoria adicionada.' });
            setNewCategoryName('');
            refreshCategories();
        })
        .catch(() => {
            const permissionError = new FirestorePermissionError({
                path: categoriesCollectionRef.path,
                operation: 'create',
                requestResourceData: newCategory,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsAdding(false);
        });
  };
  
  const handleUpdateCategory = async (categoryId: string) => {
    if (!editingCategoryName.trim()) {
        toast({ variant: 'destructive', title: 'O nome da categoria não pode estar vazio.' });
        return;
    }
    if (!firestore) return;

    const categoryRef = doc(firestore, 'categories', categoryId);
    const updatedData = { name: editingCategoryName };

    updateDoc(categoryRef, updatedData)
        .then(() => {
            toast({ title: 'Sucesso!', description: 'Categoria atualizada.' });
            setEditingCategoryId(null);
            refreshCategories();
        })
        .catch(() => {
            const permissionError = new FirestorePermissionError({
                path: categoryRef.path,
                operation: 'update',
                requestResourceData: updatedData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  }

  const handleDeleteCategory = async () => {
      if(!firestore || !categoryToDelete) return;

      const categoryRef = doc(firestore, 'categories', categoryToDelete.id);
      deleteDoc(categoryRef)
        .then(() => {
            toast({ title: 'Sucesso!', description: 'Categoria excluída.' });
            setCategoryToDelete(null);
            refreshCategories();
        })
        .catch(() => {
            const permissionError = new FirestorePermissionError({
                path: categoryRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        })
  }

  const startEditing = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const cancelEditing = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Gerenciar Categorias</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Adicionar Nova Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="text"
              placeholder="Nome da nova categoria"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={isAdding}
            />
            <Button onClick={handleAddCategory} disabled={isAdding}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {isAdding ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mb-4">Categorias Existentes</h2>
      <div className="space-y-4">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex justify-between items-center">
                <Skeleton className="h-6 w-1/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-10" />
                  <Skeleton className="h-10 w-10" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : categories && categories.length > 0 ? (
          categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="p-4 flex justify-between items-center gap-4">
                {editingCategoryId === category.id ? (
                    <Input 
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="text-lg"
                    />
                ) : (
                    <p className="text-lg font-medium">{category.name}</p>
                )}
                
                <div className="flex items-center gap-2 flex-shrink-0">
                    {editingCategoryId === category.id ? (
                        <>
                            <Button onClick={() => handleUpdateCategory(category.id)} size="icon"><Save /></Button>
                            <Button onClick={cancelEditing} variant="ghost" size="icon"><X /></Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={() => startEditing(category)} variant="outline" size="icon"><Edit /></Button>
                            <Button onClick={() => setCategoryToDelete(category)} variant="destructive" size="icon"><Trash2 /></Button>
                        </>
                    )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-muted-foreground">Nenhuma categoria encontrada.</p>
        )}
      </div>

       <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente a categoria <strong>{categoryToDelete?.name}</strong>. Produtos nesta categoria não serão excluídos, mas precisarão ser re-categorizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
