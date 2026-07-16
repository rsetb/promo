'use client';

import { useState } from 'react';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useCategories } from '@/lib/use-categories';
import { collection, addDoc } from 'firebase/firestore';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { NewProduct } from '@/lib/types';
import { Skeleton } from './ui/skeleton';

const formSchema = z.object({
  name: z.string().min(1, 'Nome do produto é obrigatório.'),
  price: z.string()
    .min(1, 'O preço é obrigatório.')
    .refine((val) => /^[0-9]+([,.][0-9]{1,2})?$/.test(val), 'Formato de preço inválido (ex: 99,99)'),
  category: z.string().min(1, 'Selecione uma categoria.'),
});

type AddProductDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onProductAdded: () => void;
};

export function AddProductDialog({
  isOpen,
  onOpenChange,
  onProductAdded,
}: AddProductDialogProps) {
  const firestore = useFirestore();
  const { categories, isLoading: areCategoriesLoading } = useCategories();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      price: '',
      category: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore) return;

    setIsSubmitting(true);
    try {
      const numericPrice = parseFloat(values.price.replace(',', '.'));
      const newProduct: NewProduct = {
        name: values.name,
        price: isNaN(numericPrice) ? 0 : numericPrice,
        category: values.category,
        description: '', // Default empty description
      };

      const productsCollectionRef = collection(firestore, 'products');

      addDoc(productsCollectionRef, newProduct)
        .then(() => {
          toast({
            title: 'Sucesso!',
            description: 'Novo produto adicionado ao catálogo.',
          });
          form.reset();
          onOpenChange(false);
          onProductAdded();
        }).catch((e) => {
          const permissionError = new FirestorePermissionError({
            path: productsCollectionRef.path,
            operation: 'create',
            requestResourceData: newProduct,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao adicionar produto',
        description: error.message || 'Ocorreu um erro desconhecido.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      form.reset();
      onOpenChange(open);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Produto</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do novo produto para adicioná-lo ao catálogo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço (R$)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0,00"
                      {...field}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9,.]/g, '');
                        field.onChange(val);
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  {areCategoriesLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((category) => (
                          <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adicionando...' : 'Adicionar Produto'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
