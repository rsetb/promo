import Image from 'next/image';
import Link from 'next/link';
import { EditableText } from '@/components/editable-text';
import { AdminMenu, LoginButton, ShareButton } from '@/components/header-actions';
import { isAdmin } from '@/lib/auth';
import { getSiteInfo } from '@/lib/queries';

export default async function Header() {
  const [siteInfo, admin] = await Promise.all([getSiteInfo(), isAdmin()]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
        <div className="mr-auto flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="MR Bebidas" width={40} height={40} className="rounded-full" />
          </Link>
          {admin ? (
            <EditableText
              field="siteName"
              value={siteInfo.siteName}
              canEdit
              className="text-lg font-bold uppercase"
            />
          ) : (
            <Link href="/" className="text-lg font-bold uppercase">
              {siteInfo.siteName}
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ShareButton siteName={siteInfo.siteName} />
          {admin ? <AdminMenu /> : <LoginButton />}
        </div>
      </div>
    </header>
  );
}
