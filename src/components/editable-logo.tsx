'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImagePicker } from '@/components/image-picker';
import { useToast } from '@/hooks/use-toast';
import { updateSiteLogo } from '@/lib/actions';
import { logoUrl } from '@/lib/types';

type EditableLogoProps = {
  logoFile: string | null;
  siteName: string;
  canEdit: boolean;
  size: number;
  className?: string;
  priority?: boolean;
};

/**
 * O logo, com troca pelo próprio site quando admin.
 *
 * Usado no hero e no header — os dois leem o mesmo logoFile, então trocar num
 * lugar troca nos dois.
 */
export function EditableLogo({
  logoFile,
  siteName,
  canEdit,
  size,
  className,
  priority,
}: EditableLogoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const src = logoUrl(logoFile);

  const save = () => {
    startTransition(async () => {
      const formData = new FormData();
      if (file) formData.set('image', file);
      if (url.trim()) formData.set('imageUrl', url.trim());

      const result = await updateSiteLogo(formData);
      if (result.ok) {
        setFile(null);
        setUrl('');
        setIsOpen(false);
        router.refresh();
        toast({ title: 'Logo atualizado!' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  const image = (
    <Image
      src={src}
      alt={siteName}
      width={size}
      height={size}
      className={className}
      priority={priority}
      // O logo vem do volume por uma rota dinâmica; sem isto o otimizador do
      // Next serviria a versão antiga em cache depois da troca.
      unoptimized={!!logoFile}
    />
  );

  if (!canEdit) return image;

  return (
    <>
      <div className="group relative inline-block">
        {image}
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          variant="secondary"
          size="icon"
          className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full border shadow-sm"
          aria-label="Trocar logo"
        >
          <Edit className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (isPending) return;
          if (!open) {
            setFile(null);
            setUrl('');
          }
          setIsOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Trocar logo</DialogTitle>
            <DialogDescription>
              Aparece no topo do site e na página inicial. Uma imagem quadrada fica melhor.
            </DialogDescription>
          </DialogHeader>

          <ImagePicker
            currentFile={logoFile}
            file={file}
            onFileChange={setFile}
            url={url}
            onUrlChange={setUrl}
            removed={false}
            onRemovedChange={() => {}}
            disabled={isPending}
          />

          <DialogFooter>
            <Button onClick={save} disabled={isPending || (!file && !url.trim())}>
              {isPending ? 'Salvando...' : 'Salvar logo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
