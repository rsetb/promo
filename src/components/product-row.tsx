'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Edit, ImageOff, MoreVertical, Save, Trash2, X } from 'lucide-react';
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
import { ImagePicker } from '@/components/image-picker';
import { useToast } from '@/hooks/use-toast';
import { updateProduct } from '@/lib/actions';
import { ProductPrices } from '@/components/product-prices';
import { PriceFields, type PriceFormState } from '@/components/price-fields';
import { priceToInput } from '@/lib/format';
import { imageUrl, PRICE_KINDS, type Category, type ProductView } from '@/lib/types';

/** Estado inicial dos campos de preço, a partir do produto salvo. */
function priceFormFrom(product: ProductView): PriceFormState {
  const state: PriceFormState = {};
  for (const kind of PRICE_KINDS) {
    state[kind.formField] = priceToInput(product[kind.priceKey] as number | null);
    if (kind.qtyKey && kind.qtyFormField) {
      const qty = product[kind.qtyKey] as number | null;
      state[kind.qtyFormField] = qty === null ? '' : String(qty);
    }
  }
  return state;
}

type ProductRowProps = {
  product: ProductView;
  categories: Category[];
  canEdit: boolean;
  onRequestDelete: (product: ProductView) => void;
};

export function ProductRow({ product, categories, canEdit, onRequestDelete }: ProductRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [prices, setPrices] = useState<PriceFormState>(() => priceFormFrom(product));
  const [categoryId, setCategoryId] = useState(String(product.categoryId));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageRemoved, setImageRemoved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const startEditing = () => {
    setName(product.name);
    setPrices(priceFormFrom(product));
    setCategoryId(String(product.categoryId));
    setImageFile(null);
    setImageUrlInput('');
    setImageRemoved(false);
    setIsEditing(true);
  };

  const save = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('name', name);
      for (const [field, value] of Object.entries(prices)) formData.set(field, value);
      formData.set('categoryId', categoryId);
      if (imageFile) formData.set('image', imageFile);
      if (imageUrlInput.trim()) formData.set('imageUrl', imageUrlInput.trim());
      if (imageRemoved && !imageFile && !imageUrlInput.trim()) formData.set('removeImage', '1');

      const result = await updateProduct(product.id, formData);
      if (result.ok) {
        setIsEditing(false);
        // Sem isto a tela só mostra o valor novo depois de um F5: as rotas são
        // force-dynamic, então não há cache para o revalidatePath da action
        // invalidar, e o router nunca refaz a busca sozinho.
        router.refresh();
        toast({ title: 'Salvo!', description: 'O produto foi atualizado.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  /**
   * Enter salva, Escape cancela — nos dois campos de texto. Mesmo atalho do
   * EditableText e da tela de categorias.
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      save();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsEditing(false);
    }
  };

  const thumb = imageUrl(product.imageFile);

  return (
    <Card className="border transition-all duration-300 hover:border-primary hover:shadow-lg">
      <CardHeader className="p-4">
        {/*
          Em linha quando cabe; `flex-wrap` deixa o preço cair para a linha de
          baixo quando não cabe — em vez de espremer o nome. Sem isto, um
          produto com 2-3 preços (CAIXA 12UN R$ 802,80 + botões de ação)
          reduzia o nome a poucos pixels, e break-words passava a quebrar
          LETRA POR LETRA em vez de por palavra: "ABSOLUT" virava uma coluna de
          uma letra por linha.

          `flex-col` só volta durante a edição, onde os campos precisam de
          largura.
        */}
        <div
          className={
            isEditing
              ? 'flex flex-col items-start justify-between gap-4 sm:flex-row'
              : 'flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1'
          }
        >
          {/*
            min-w-[140px] no lugar de min-w-0: um piso de largura, não zero.
            Sem piso, o flex-wrap acima nunca chega a agir — o nome encolhe até
            sumir antes do preço ser forçado à linha de baixo.
          */}
          <div className={isEditing ? 'flex-1' : 'min-w-[140px] flex-1'}>
            {isEditing ? (
              <>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-auto text-md font-semibold leading-none tracking-tight"
                  disabled={isPending}
                  autoFocus
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
                <div className="mt-3">
                  <ImagePicker
                    currentFile={product.imageFile}
                    file={imageFile}
                    onFileChange={setImageFile}
                    url={imageUrlInput}
                    onUrlChange={setImageUrlInput}
                    removed={imageRemoved}
                    onRemovedChange={setImageRemoved}
                    searchQuery={name}
                    disabled={isPending}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                {thumb ? (
                  <Image
                    src={thumb}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-md border object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                    <ImageOff className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  {/* break-words: nome comprido quebra em linhas em vez de
                      estourar a largura e empurrar o preço para fora. */}
                  <CardTitle className="text-md break-words font-semibold">{product.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{product.category}</p>
                </div>
              </div>
            )}
          </div>

          {/*
            shrink-0: o preço nunca é espremido por um nome longo — ele cai
            para a linha de baixo antes disso (flex-wrap acima).
            ml-auto: garante alinhamento à direita mesmo sozinho numa segunda
            linha, onde justify-between do pai nem sempre posiciona à direita.
          */}
          <div
            className={
              isEditing
                ? 'flex items-center gap-2 self-start text-right sm:self-center'
                : 'ml-auto flex shrink-0 items-center gap-1 text-right sm:gap-2'
            }
          >
            {isEditing ? (
              <>
                <PriceFields
                  values={prices}
                  onChange={(field, value) => setPrices((p) => ({ ...p, [field]: value }))}
                  disabled={isPending}
                  onEnter={save}
                  compact
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
                <ProductPrices product={product} />
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
