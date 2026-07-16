'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, SiteInfo, Category } from '@/lib/types';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Edit, Save, X, Phone, PlusCircle, MoreVertical, Trash2 } from 'lucide-react';
import { useProducts } from '@/lib/use-products';
import { useSiteInfo } from '@/lib/use-site-info';
import { useCategories } from '@/lib/use-categories';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import Image from 'next/image';
import { AddProductDialog } from '@/components/add-product-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type EditableField = 'siteName' | 'heroTitle1' | 'heroTitle2' | 'heroLocation' | 'heroPhoneDisplay' | 'heroLocation2' | 'heroPhoneDisplay2';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const { products, isLoading: areProductsLoading, refreshProducts } = useProducts();
  const { siteInfo, isLoading: isSiteInfoLoading, siteInfoRef, refreshSiteInfo } = useSiteInfo();
  const { categories, isLoading: areCategoriesLoading, refreshCategories } = useCategories();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number | string>('');
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('');

  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [fieldValue, setFieldValue] = useState('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');

  const isLoading = areProductsLoading || isSiteInfoLoading || areCategoriesLoading;
  const didAttemptPhoneSwapFix = useRef(false);

  const displayCategories = useMemo(() => {
    if (!categories) return ['TODOS'];
    const categoryNames = categories.map(c => c.name.toUpperCase());
    const uniqueNames = Array.from(new Set(categoryNames));
    const sortedUniqueNames = uniqueNames.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return ['TODOS', ...sortedUniqueNames];
  }, [categories]);

  // One-time fix for swapped phone numbers in Firestore
  useEffect(() => {
    if (didAttemptPhoneSwapFix.current) return;
    // Only run this check if we are logged in and have the necessary info.
    if (user && siteInfoRef && siteInfo.heroPhone === '5585992234683') {
      didAttemptPhoneSwapFix.current = true;
      const updatedData = {
        heroPhone: '5585994125603',
        heroPhoneDisplay: '(85) 99412-5603',
        heroPhone2: '5585992234683',
        heroPhoneDisplay2: '(85) 99223-4683',
      };
      updateDoc(siteInfoRef, updatedData)
        .then(() => {
          refreshSiteInfo();
        })
        .catch(() => {});
    }
  }, [siteInfo.heroPhone, siteInfoRef, refreshSiteInfo, user]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    return sortedProducts.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === 'TODOS' || product.category.toUpperCase() === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const handleUpdateProduct = async (productId: string, data: Partial<Product>) => {
    if (firestore) {
      const productRef = doc(firestore, 'products', productId);
      updateDoc(productRef, data)
        .then(() => {
          toast({
            title: 'Sucesso!',
            description: 'O produto foi atualizado.',
          });
          setEditingProductId(null);
          refreshProducts(); // Force refresh
        })
        .catch(() => {
          const permissionError = new FirestorePermissionError({
            path: productRef.path,
            operation: 'update',
            requestResourceData: data,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  const handleDeleteProduct = async () => {
    if (firestore && productToDelete) {
      const productRef = doc(firestore, 'products', productToDelete.id);
      deleteDoc(productRef)
        .then(() => {
          toast({
            title: 'Sucesso!',
            description: 'O produto foi excluído.',
          });
          setProductToDelete(null);
          refreshProducts(); // Force refresh
        })
        .catch(() => {
          const permissionError = new FirestorePermissionError({
            path: productRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  const handleUpdateSiteInfo = async () => {
    if (firestore && editingField && siteInfoRef) {
      const data: Partial<SiteInfo> = { [editingField]: fieldValue };

      if (editingField === 'heroPhoneDisplay') {
        data.heroPhone = fieldValue.replace(/\D/g, '');
      }

      if (editingField === 'heroPhoneDisplay2') {
        data.heroPhone2 = fieldValue.replace(/\D/g, '');
      }

      updateDoc(siteInfoRef, data)
        .then(() => {
          toast({
            title: 'Sucesso!',
            description: 'A informação do site foi atualizada.',
          });
          setEditingField(null);
          setFieldValue('');
          refreshSiteInfo();
        })
        .catch(() => {
          const permissionError = new FirestorePermissionError({
            path: siteInfoRef.path,
            operation: 'update',
            requestResourceData: data,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  const handleStartEditingProduct = (product: Product) => {
    setEditingProductId(product.id);
    setNewPrice(product.price > 0 ? product.price.toFixed(2).replace('.', ',') : '');
    setNewName(product.name);
    setNewCategory(product.category);
  };

  const handleStartEditingField = (field: EditableField, currentValue: string) => {
    setEditingField(field);
    setFieldValue(currentValue);
  };

  const handleCancelEditing = () => {
    setEditingProductId(null);
    setNewPrice('');
    setNewName('');
    setNewCategory('');
    setEditingField(null);
    setFieldValue('');
  };

  const renderEditableField = (field: EditableField, value: string, className: string, isCentered: boolean = false) => {
    const isEditing = editingField === field && user;

    return (
      <div className={`group relative w-full flex items-center gap-2 ${isCentered ? 'justify-center' : ''}`}>
        {isEditing ? (
          <>
            <Input
              type="text"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              className={`${className} h-auto p-0 border-dashed`}
            />
            <Button onClick={handleUpdateSiteInfo} size="icon" className="h-9 w-9 shrink-0"><Save className="w-5 h-5" /></Button>
            <Button onClick={handleCancelEditing} variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <X className="w-5 h-5" />
            </Button>
          </>
        ) : (
          <div className="relative flex justify-center items-center w-full">
            <span className={className}>{value}</span>
            {user && (
              <Button
                onClick={() => handleStartEditingField(field, value)}
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 h-9 w-9 opacity-0 group-hover:opacity-100"
              >
                <Edit className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const WhatsappIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-green-500 w-4 h-4"
    >
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.487 5.235 3.487 8.413.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.89-5.466 0-9.887 4.434-9.889 9.886-.001 2.269.655 4.357 1.849 6.081l-1.214 4.439 4.542-1.195z" />
    </svg>
  );

  return (
    <>
      <div className="text-center pt-8 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="relative">
          <div className="flex justify-center items-center mb-4 pt-4">
            <Image
              src="/logo.png"
              alt="MR Bebidas Distribuidora Logo"
              width={160}
              height={160}
              className="rounded-full"
            />
          </div>
          <div className="flex flex-col items-center">
            {renderEditableField('heroTitle1', siteInfo.heroTitle1, 'text-5xl font-black tracking-tighter sm:text-6xl md:text-7xl text-foreground', true)}
            {renderEditableField('heroTitle2', siteInfo.heroTitle2, 'text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl text-foreground', true)}
          </div>

          <div className="mt-4 mx-auto max-w-md px-4">
            <div className="grid grid-cols-[auto,1fr] gap-x-4 items-center">
              {/* Coluna Esquerda - Cidades */}
              <div className="space-y-2 justify-self-start text-left">
                {/* Fortaleza */}
                <div className="flex items-center gap-2 group">
                  {isSiteInfoLoading ? <Skeleton className="h-5 w-24" /> : (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm sm:text-lg font-semibold text-muted-foreground whitespace-nowrap">{siteInfo.heroLocation}</p>
                      {user && <Button onClick={() => handleStartEditingField('heroLocation', siteInfo.heroLocation)} variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 flex-shrink-0"><Edit className="w-4 h-4" /></Button>}
                    </div>
                  )}
                </div>
                {/* Cumbuco */}
                <div className="flex items-center gap-2 group">
                  {isSiteInfoLoading ? <Skeleton className="h-5 w-24" /> : (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm sm:text-lg font-semibold text-muted-foreground whitespace-nowrap">{siteInfo.heroLocation2}</p>
                      {user && <Button onClick={() => handleStartEditingField('heroLocation2', siteInfo.heroLocation2)} variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 flex-shrink-0"><Edit className="w-4 h-4" /></Button>}
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna Direita - Telefones */}
              <div className="space-y-2 justify-self-end text-right">
                {/* Telefone Fortaleza */}
                <div className="flex items-center gap-2 group">
                  {isSiteInfoLoading ? <Skeleton className="h-5 w-32" /> : (
                    <div className="flex items-center gap-1.5">
                      <a href={`https://wa.me/${siteInfo.heroPhone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                        <WhatsappIcon />
                        <p className="text-sm sm:text-lg font-semibold text-muted-foreground group-hover:underline whitespace-nowrap">{siteInfo.heroPhoneDisplay}</p>
                      </a>
                      {user && <Button onClick={() => handleStartEditingField('heroPhoneDisplay', siteInfo.heroPhoneDisplay)} variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 flex-shrink-0"><Edit className="w-4 h-4" /></Button>}
                    </div>
                  )}
                </div>
                {/* Telefone Cumbuco */}
                <div className="flex items-center gap-2 group">
                  {isSiteInfoLoading ? <Skeleton className="h-5 w-32" /> : (
                    <div className="flex items-center gap-1.5">
                      <a href={`https://wa.me/${siteInfo.heroPhone2}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                        <WhatsappIcon />
                        <p className="text-sm sm:text-lg font-semibold text-muted-foreground group-hover:underline whitespace-nowrap">{siteInfo.heroPhoneDisplay2}</p>
                      </a>
                      {user && <Button onClick={() => handleStartEditingField('heroPhoneDisplay2', siteInfo.heroPhoneDisplay2)} variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 flex-shrink-0"><Edit className="w-4 h-4" /></Button>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


          <div className="mt-6 max-w-2xl mx-auto">
            <div className="text-lg text-muted-foreground p-1">
              {isLoading ? <div className="h-6"><Skeleton className="h-6 w-full max-w-md mx-auto" /></div> : siteInfo.heroSlogan}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-16 relative z-10">
        <div className="bg-card p-4 rounded-lg border shadow-lg">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            {user && (
              <Button onClick={() => setIsAddProductOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Produto
              </Button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {areCategoriesLoading && (!categories || categories.length === 0) ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)
            ) : (
              displayCategories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'secondary'}
                  onClick={() => setSelectedCategory(category)}
                  size="sm"
                  className="rounded-full"
                >
                  {category}
                </Button>
              ))
            )}
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-5 w-1/4 mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="transition-all duration-300 border hover:shadow-lg hover:border-primary"
                >
                  <CardHeader className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                      <div className="flex-1">
                        {editingProductId === product.id && user ? (
                          <Input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="text-md font-semibold leading-none tracking-tight h-auto"
                          />
                        ) : (
                          <CardTitle className="text-md font-semibold">{product.name}</CardTitle>
                        )}
                        {editingProductId === product.id && user ? (
                          <div className="mt-2">
                            {areCategoriesLoading ? (
                              <Skeleton className="h-10 w-full" />
                            ) : (
                              <Select value={newCategory} onValueChange={setNewCategory}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione uma categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories?.map((cat: Category) => (
                                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">{product.category}</p>
                        )}
                      </div>
                      <div className="text-right flex items-center gap-2 self-start sm:self-center">
                        {editingProductId === product.id && user ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              value={newPrice}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9,.]/g, '');
                                setNewPrice(val);
                              }}
                              className="w-32 text-base"
                              placeholder={product.price > 0 ? product.price.toFixed(2).replace('.', ',') : '0,00'}
                            />
                            <Button
                              onClick={() => {
                                const numericPrice = typeof newPrice === 'string'
                                  ? parseFloat(newPrice.replace(',', '.'))
                                  : newPrice;
                                handleUpdateProduct(product.id, {
                                  name: newName,
                                  price: isNaN(numericPrice) ? 0 : numericPrice,
                                  category: newCategory
                                });
                              }}
                              size="icon"
                              className="h-9 w-9"
                            >
                              <Save />
                            </Button>
                            <Button onClick={handleCancelEditing} variant="ghost" size="icon" className="h-9 w-9">
                              <X className="w-5 h-5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="text-xl font-bold whitespace-nowrap">
                              {product.price > 0
                                ? `R$${product.price.toFixed(2).replace('.', ',')}`
                                : 'Consulte'}
                            </p>
                            {user && (
                              <>
                                <Button onClick={() => handleStartEditingProduct(product)} variant="ghost" size="icon" className="h-9 w-9">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => setProductToDelete(product)} className="text-red-600">
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
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-20 bg-card rounded-lg border mt-8">
              <h3 className="text-2xl font-semibold">
                Nenhum produto encontrado
              </h3>
              <div className="mt-2 text-muted-foreground">
                Tente ajustar seus filtros.
              </div>
            </div>
          )}
        </div>
      </div>
      {user && (
        <AddProductDialog
          isOpen={isAddProductOpen}
          onOpenChange={setIsAddProductOpen}
          onProductAdded={() => {
            refreshProducts();
            refreshCategories();
          }}
        />
      )}
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso excluirá permanentemente o produto <strong>{productToDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
