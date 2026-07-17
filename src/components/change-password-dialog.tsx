'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
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
import { useToast } from '@/hooks/use-toast';
import { changePassword } from '@/lib/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando...' : 'Alterar senha'}
    </Button>
  );
}

export function ChangePasswordDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction] = useActionState(changePassword, null);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.ok) {
      toast({ title: 'Senha alterada!', description: 'As outras sessões foram encerradas.' });
      onOpenChange(false);
    }
  }, [state, toast, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>
            A senha nova passa a valer imediatamente e encerra as sessões abertas em outros
            aparelhos.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="current">Senha atual</Label>
            <Input id="current" name="current" type="password" required autoComplete="current-password" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="next">Senha nova</Label>
            <Input
              id="next"
              name="next"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm">Repita a senha nova</Label>
            <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
          </div>

          {state && !state.ok && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
