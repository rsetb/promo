'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { KeyRound, LayoutGrid, LogIn, LogOut, Share2, User as UserIcon } from 'lucide-react';
import { ChangePasswordDialog } from '@/components/change-password-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { logout } from '@/lib/actions';

export function ShareButton({ siteName }: { siteName: string }) {
  const { toast } = useToast();

  const share = async () => {
    const shareData = {
      title: siteName,
      text: `Confira o catálogo da ${siteName}!`,
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // Cancelar o compartilhamento é uma ação do usuário, não um erro.
        if ((error as DOMException)?.name !== 'AbortError') {
          toast({
            variant: 'destructive',
            title: 'Erro ao compartilhar',
            description: 'Não foi possível compartilhar a página.',
          });
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareData.url);
      toast({ title: 'Link copiado!', description: 'O link foi copiado para a área de transferência.' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o link.',
      });
    }
  };

  return (
    <Button variant="outline" size="icon" onClick={share}>
      <Share2 className="h-5 w-5" />
      <span className="sr-only">Compartilhar página</span>
    </Button>
  );
}

export function AdminMenu() {
  const [isPending, startTransition] = useTransition();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  return (
    <>
      <ChangePasswordDialog isOpen={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen} />
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Mesmo variant e tamanho do ShareButton: os dois ficam lado a lado no
            header e precisam parecer o mesmo tipo de botão. */}
        <Button variant="outline" size="icon" aria-label="Menu do administrador">
          <UserIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium leading-none">Administrador</p>
          <p className="mt-1 text-xs leading-none text-muted-foreground">Sessão ativa</p>
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
          <span>Alterar senha</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(() => {
              void logout();
            });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isPending ? 'Saindo...' : 'Sair'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}

export function LoginButton() {
  return (
    <Button variant="outline" asChild>
      <Link href="/login">
        <LogIn className="mr-2 h-4 w-4" />
        Login
      </Link>
    </Button>
  );
}
