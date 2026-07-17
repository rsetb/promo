'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { setSecondBranchVisible } from '@/lib/actions';

/**
 * Liga/desliga a segunda cidade no site.
 *
 * Não some com os dados: heroLocation2/heroPhone2 continuam salvos, só param
 * de aparecer para o visitante. O admin vê a linha esmaecida (ver Hero) e pode
 * religar aqui sem redigitar nada.
 */
export function BranchVisibilityToggle({ label, initialVisible }: { label: string; initialVisible: boolean }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const toggle = (checked: boolean) => {
    startTransition(async () => {
      const result = await setSecondBranchVisible(checked);
      if (result.ok) {
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    });
  };

  return (
    <div className="col-span-2 mt-1 flex items-center justify-center gap-2">
      <Switch
        id="branch2-visible"
        checked={initialVisible}
        onCheckedChange={toggle}
        disabled={isPending}
      />
      <Label htmlFor="branch2-visible" className="cursor-pointer text-xs text-muted-foreground">
        Mostrar {label} no site
      </Label>
    </div>
  );
}
