'use client';

import Link from 'next/link';
import { LogIn, LogOut, User as UserIcon, KeyRound, Edit, Save, X, LayoutGrid, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser, useAuth, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { signOut } from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChangePasswordDialog } from '@/components/change-password-dialog';
import { useState } from 'react';
import Image from 'next/image';
import { useSiteInfo } from '@/lib/use-site-info';
import { Skeleton } from './ui/skeleton';
import { Input } from './ui/input';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

function getInitials(name?: string | null) {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('');
}

export default function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { siteInfo, isLoading: isSiteInfoLoading, siteInfoRef, refreshSiteInfo } = useSiteInfo();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  
  const [isEditingSiteName, setIsEditingSiteName] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');

  const handleLogout = async () => {
    await signOut(auth);
  };
  
  const handleUpdateSiteName = async () => {
    if (firestore && siteInfoRef) {
      const data = { siteName: newSiteName };
      updateDoc(siteInfoRef, data)
        .then(() => {
          toast({
            title: 'Sucesso!',
            description: 'O nome do site foi atualizado.',
          });
          setIsEditingSiteName(false);
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
  
  const handleStartEditingSiteName = (currentName: string) => {
    setIsEditingSiteName(true);
    setNewSiteName(currentName);
  };
  
  const handleCancelEditing = () => {
    setIsEditingSiteName(false);
    setNewSiteName('');
  }

  const handleShare = async () => {
    const shareData = {
      title: siteInfo.siteName,
      text: `Confira o catálogo da ${siteInfo.siteName}!`,
      url: window.location.origin,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if ((error as DOMException)?.name !== 'AbortError') {
          console.error('Erro ao compartilhar:', error);
          toast({ variant: 'destructive', title: 'Erro ao compartilhar', description: 'Não foi possível compartilhar a página.' });
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        toast({ title: 'Link copiado!', description: 'O link da página foi copiado para sua área de transferência.' });
      } catch (err) {
        console.error('Falha ao copiar o link:', err);
        toast({ variant: 'destructive', title: 'Erro ao copiar', description: 'Não foi possível copiar o link.' });
      }
    }
  };


  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center">
          <Link href="/" className="mr-auto flex items-center gap-2 group">
              <Image
                src="/logo.png"
                alt="MR Bebidas Logo"
                width={40}
                height={40}
                className="rounded-full"
              />
              {isSiteInfoLoading ? (
                 <Skeleton className="h-6 w-24" />
              ) : isEditingSiteName && user ? (
                <div className="flex items-center gap-2">
                   <Input
                     type="text"
                     value={newSiteName}
                     onChange={(e) => setNewSiteName(e.target.value)}
                     className="h-9"
                   />
                   <Button onClick={handleUpdateSiteName} size="icon" className="h-9 w-9"><Save className="w-5 h-5"/></Button>
                   <Button onClick={handleCancelEditing} variant="ghost" size="icon" className="h-9 w-9">
                     <X className="w-5 h-5" />
                   </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold uppercase">{siteInfo.siteName}</span>
                    {user && (
                      <Button onClick={() => handleStartEditingSiteName(siteInfo.siteName)} variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <Edit className="w-4 h-4"/>
                      </Button>
                    )}
                </div>
              )}
          </Link>
          <div className="flex items-center gap-2 ml-auto">
             <Button variant="outline" size="icon" onClick={handleShare}>
                <Share2 className="h-5 w-5" />
                <span className="sr-only">Compartilhar Página</span>
            </Button>
            {isUserLoading ? (
              <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={user.photoURL ?? ''}
                        alt={user.displayName ?? 'Usuário'}
                      />
                      <AvatarFallback>
                        {getInitials(user.email) || <UserIcon />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.displayName || 'Usuário'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                   <DropdownMenuItem asChild>
                    <Link href="/admin/categories">
                      <LayoutGrid className="mr-2 h-4 w-4" />
                      <span>Gerenciar Categorias</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setIsChangePasswordOpen(true)}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    <span>Alterar Senha</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" asChild>
                <Link href="/login">
                  <LogIn className="mr-2" />
                  Login
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      {user && (
        <ChangePasswordDialog
          isOpen={isChangePasswordOpen}
          onOpenChange={setIsChangePasswordOpen}
        />
      )}
    </>
  );
}
