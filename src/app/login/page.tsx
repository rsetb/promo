'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Entrando...' : 'Entrar'}
    </Button>
  );
}

/**
 * Login de administrador.
 *
 * Não existe cadastro: a senha vem de ADMIN_PASSWORD no servidor. A tela antiga
 * criava uma conta para qualquer um que digitasse um usuário novo, e essa conta
 * ganhava permissão de escrita no catálogo.
 */
export default function LoginPage() {
  const [state, formAction] = useActionState(login, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Acesso restrito</CardTitle>
          <CardDescription>Entre com a senha de administrador para gerenciar o catálogo.</CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" autoFocus />
            </div>
            {state && !state.ok && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {state.error}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
