import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/header';
import { LiveUpdates } from '@/components/live-updates';

export const metadata: Metadata = {
  title: 'MR Bebidas Distribuidora',
  description: 'Explore nossa seleção completa de tabacaria e bebidas premium',
};

/**
 * Toda página é renderizada por requisição.
 *
 * O Header lê o catálogo do Postgres e a sessão do cookie, então não há nada
 * que possa ser congelado no build — inclusive a página 404, que herda este
 * layout. Sem isto, `next build` tentaria pré-renderizar e exigiria um banco
 * acessível durante a construção da imagem Docker.
 */
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background font-body antialiased">
        <LiveUpdates />
        <div className="relative flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
