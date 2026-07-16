'use client';

import { useState, use } from 'react';
import { notFound } from 'next/navigation';
import { useDoc, useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Edit, Save, X, Share2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product, Category } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMemoFirebase } from '@/firebase/provider';
import { useCategories } from '@/lib/use-categories';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function ProductPage({ params: paramsPromise }: ProductPageProps) {
  const params = use(paramsPromise);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { categories, isLoading: areCategoriesLoading } = useCategories();

  const [isEditing, setIsEditing] = useState(false);
  const [newPrice, setNewPrice] = useState<number | string>('');
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('');

  const productRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'products', params.id);
  }, [firestore, params.id]);

  const { data: product, isLoading, refresh: refreshProduct } = useDoc<Product>(productRef);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-10 w-1/3" />
          <Separator />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    notFound();
  }
  
  const handleUpdate = async () => {
    if (typeof newPrice !== 'number' || newPrice < 0) {
      toast({
        variant: 'destructive',
        title: 'Preço inválido',
        description: 'Por favor, insira um número válido.',
      });
      return;
    }
    if (!newName) {
      toast({
        variant: 'destructive',
        title: 'Nome inválido',
        description: 'Por favor, insira um nome para o produto.',
      });
      return;
    }
    if (!newCategory) {
      toast({
        variant: 'destructive',
        title: 'Categoria inválida',
        description: 'Por favor, selecione uma categoria.',
      });
      return;
    }

    if (productRef) {
      const updatedData = { price: newPrice, name: newName, category: newCategory };
      updateDoc(productRef, updatedData)
        .then(() => {
          toast({
            title: 'Sucesso!',
            description: 'O produto foi atualizado.',
          });
          setIsEditing(false);
          refreshProduct();
        })
        .catch(() => {
            const permissionError = new FirestorePermissionError({
              path: productRef.path,
              operation: 'update',
              requestResourceData: updatedData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Confira este produto: ${product.name}`,
          url: window.location.href,
        });
      } catch (error) {
        // Não mostrar erro se o usuário cancelar o compartilhamento
        if ((error as DOMException)?.name !== 'AbortError') {
          console.error('Erro ao compartilhar:', error);
          toast({ variant: 'destructive', title: 'Erro ao compartilhar', description: 'Não foi possível compartilhar o produto.' });
        }
      }
    } else {
      // Fallback: copiar para a área de transferência
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast({ title: 'Link copiado!', description: 'O link do produto foi copiado para sua área de transferência.' });
      } catch (err) {
        console.error('Falha ao copiar o link:', err);
        toast({ variant: 'destructive', title: 'Erro ao copiar', description: 'Não foi possível copiar o link.' });
      }
    }
  };

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="space-y-6">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 space-y-2">
                 {isEditing && user ? (
                    areCategoriesLoading ? (
                        <Skeleton className="h-10 w-full max-w-xs" />
                    ) : (
                        <Select value={newCategory} onValueChange={setNewCategory}>
                            <SelectTrigger className="w-full max-w-xs">
                                <SelectValue placeholder="Selecione uma categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories?.map((cat: Category) => (
                                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )
                 ) : (
                    <p className="text-sm font-medium text-accent-foreground bg-accent/80 inline-block px-3 py-1 rounded-full">
                      {product.category}
                    </p>
                 )}
                
                {isEditing && user ? (
                  <Input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="text-4xl font-bold tracking-tight font-headline sm:text-5xl h-auto"
                  />
                ) : (
                  <h1 className="text-4xl font-bold tracking-tight font-headline sm:text-5xl">
                    {product.name}
                  </h1>
                )}
              </div>
               <Button onClick={handleShare} variant="outline" size="icon" className="shrink-0 mt-1">
                <Share2 className="w-5 h-5"/>
                <span className="sr-only">Compartilhar</span>
              </Button>
            </div>

            <div className="flex items-center gap-4">
              {isEditing && user ? (
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(parseFloat(e.target.value))}
                      className="text-3xl font-semibold w-48"
                      placeholder={product.price > 0 ? product.price.toFixed(2) : '0.00'}
                    />
                    <Button onClick={handleUpdate} size="icon"><Save /></Button>
                    <Button onClick={() => setIsEditing(false)} variant="ghost" size="icon">
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
              ) : (
                <p className="text-3xl font-semibold">
                  {product.price > 0
                    ? `R$${product.price.toFixed(2).replace('.', ',')}`
                    : 'Consulte'}
                </p>
              )}
               {user && !isEditing && (
                <Button onClick={() => {
                  setIsEditing(true);
                  setNewPrice(product.price > 0 ? product.price : '');
                  setNewName(product.name);
                  setNewCategory(product.category);
                }} variant="outline" size="icon">
                  <Edit className="w-5 h-5"/>
                </Button>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Descrição</h2>
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>

            <Button size="lg" className="w-full text-lg py-7">
              <ShoppingCart className="mr-2 h-5 w-5" />
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
