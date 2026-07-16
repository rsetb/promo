'use client';

import { useState } from 'react';
import { useAuth, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
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
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc } from 'firebase/firestore';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  // We append a dummy domain to the username to make it a valid email for Firebase.
  const getEmailFromUsername = (user: string) => `${user.toLowerCase().trim()}@mrdistribuidora.com`;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
        toast({
            variant: 'destructive',
            title: 'Usuário inválido',
            description: 'Por favor, insira um nome de usuário.',
        });
        return;
    }
    setIsLoading(true);
    const email = getEmailFromUsername(username);
    
    try {
      // Attempt to sign in first
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
      toast({
        title: 'Login bem-sucedido!',
        description: 'Você foi autenticado.',
      });
    } catch (error: any) {
      // If user not found or credential is generally invalid, try to create a new account
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // Create a user document in Firestore
          if (firestore && user) {
            const userDocRef = doc(firestore, 'users', user.uid);
            const newUserDoc = {
                id: user.uid,
                username: username,
            };
            
            // Non-blocking write to Firestore with proper error handling
            setDoc(userDocRef, newUserDoc).catch(() => {
                // The permission error emitter will create a detailed, safe error message
                const permissionError = new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'create',
                    requestResourceData: newUserDoc, // This data is safe to log
                });
                errorEmitter.emit('permission-error', permissionError);
            });
          }

          router.push('/');
          toast({
            title: 'Cadastro realizado com sucesso!',
            description: 'Sua conta foi criada e você já está logado.',
          });
        } catch (signUpError: any) {
          console.error('Falha no cadastro:', signUpError);
          let description = 'Não foi possível criar sua conta.';
          if (signUpError.code === 'auth/weak-password') {
            description = 'A senha deve ter pelo menos 6 caracteres.';
          } else {
            description = signUpError.message || description;
          }
          toast({
            variant: 'destructive',
            title: 'Falha no cadastro',
            description,
          });
        }
      } else {
        console.error('Falha no login:', error);
        let description = 'Ocorreu um erro desconhecido.';
        if (error.code === 'auth/wrong-password') {
          description = 'Senha incorreta. Verifique seus dados.';
        } else if (error.code === 'auth/invalid-email') {
            description = 'O nome de usuário não é válido.';
        }
        toast({
          variant: 'destructive',
          title: 'Falha no login',
          description,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Entre com seu usuário e senha para gerenciar os produtos. Se não
            tiver uma conta, ela será criada automaticamente.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignIn}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
