'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImagePicker } from '@/components/image-picker';
import { useToast } from '@/hooks/use-toast';
import { createProduct } from '@/lib/actions';
import { maskPriceInput } from '@/lib/format';
import type { Category } from '@/lib/types';

type AddProductDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  categories: Category[];
};

export function AddProductDialog({ isOpen, onOpenChange, categories }: AddProductDialogProps) {
  const [name, setName] = useState('');
  const [pricePack, setPricePack] = useState('');
  const [priceUnit, setPriceUnit] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const reset = () => {
    setName('');
    setPricePack('');
    setPriceUnit('');
    setCategoryId('');
    setImage(null);
    setImageUrlInput('');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      formData.set('name', name);
      formData.set('pricePack', pricePack);
      formData.set('priceUnit', priceUnit);
      formData.set('categoryId', categoryId);
      if (image) formData.set('image', image);
      if (imageUrlInput.trim()) formData.set('imageUrl', imageUrlInput.trim());

      const result = await createProduct(formData);
      if (result.ok) {
        router.refresh();
        toast({ title: 'Adicionado!', description: 'Novo produto no catálogo.' });
        reset();
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (isPending) return;
        if (!open) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Produto</DialogTitle>
          <DialogDescription>
            Preencha só os preços que existem. Sem nenhum, a vitrine mostra &quot;Consulte&quot;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="product-name">Nome do Produto</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="price-pack">Preço do fardo</Label>
              <Input
                id="price-pack"
                placeholder="0,00"
                value={pricePack}
                onChange={(e) => setPricePack(maskPriceInput(e.target.value))}
                disabled={isPending}
                inputMode="numeric"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price-unit">Preço da unidade</Label>
              <Input
                id="price-unit"
                placeholder="0,00"
                value={priceUnit}
                onChange={(e) => setPriceUnit(maskPriceInput(e.target.value))}
                disabled={isPending}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="product-category">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={isPending} required>
              <SelectTrigger id="product-category">
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

          <div className="grid gap-2">
            <Label>Foto</Label>
            <ImagePicker
              file={image}
              onFileChange={setImage}
              url={imageUrlInput}
              onUrlChange={setImageUrlInput}
              removed={false}
              onRemovedChange={() => {}}
              searchQuery={name}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adicionando...' : 'Adicionar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
