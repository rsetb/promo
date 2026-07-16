'use client';

import { useState, useTransition } from 'react';
import { Edit, MoreVertical, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { updateProduct } from '@/lib/actions';
import { formatPrice, priceToInput } from '@/lib/format';
import type { Category, ProductView } from '@/lib/types';

type ProductRowProps = {
  product: ProductView;
  categories: Category[];
  canEdit: boolean;
  onRequestDelete: (product: ProductView) => void;
};

export function ProductRow({ product, categories, canEdit, onRequestDelete }: ProductRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(priceToInput(product.price));
  const [categoryId, setCategoryId] = useState(String(product.categoryId));
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const startEditing = () => {
    setName(product.name);
    setPrice(priceToInput(product.price));
    setCategoryId(String(product.categoryId));
    setIsEditing(true);
  };

  const save = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('name', name);
      formData.set('price', price);
      formData.set('categoryId', categoryId);

      const result = await updateProduct(product.id, formData);
      if (result.ok) {
        setIsEditing(false);
        toast({ title: 'Salvo!', description: 'O produto foi atualizado.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  return (
    <Card className="border transition-all duration-300 hover:border-primary hover:shadow-lg">
      <CardHeader className="p-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div className="flex-1">
            {isEditing ? (
              <>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-auto text-md font-semibold leading-none tracking-tight"
                  disabled={isPending}
                  aria-label="Nome do produto"
                />
                <div className="mt-2">
                  <Select value={categoryId} onValueChange={setCategoryId} disabled={isPending}>
                    <SelectTrigger aria-label="Categoria">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <CardTitle className="text-md font-semibold">{product.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{product.category}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 self-start text-right sm:self-center">
            {isEditing ? (
              <>
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^0-9,.]/g, ''))}
                  className="w-32 text-base"
                  placeholder="0,00 (vazio = Consulte)"
                  disabled={isPending}
                  aria-label="Preço"
                />
                <Button onClick={save} size="icon" className="h-9 w-9" disabled={isPending}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  disabled={isPending}
                >
                  <X className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <>
                <p className="whitespace-nowrap text-xl font-bold">{formatPrice(product.price)}</p>
                {canEdit && (
                  <>
                    <Button onClick={startEditing} variant="ghost" size="icon" className="h-9 w-9" aria-label="Editar produto">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Mais ações">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onRequestDelete(product)} className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Excluir</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
