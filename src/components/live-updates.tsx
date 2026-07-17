'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Mantém a página em dia sem F5, em qualquer dispositivo.
 *
 * Escuta /api/updates e, ao aviso de mudança, pede a página nova. Não renderiza
 * nada — só liga o ouvinte.
 *
 * O EventSource reconecta sozinho se a conexão cair (queda de rede, deploy,
 * suspensão do celular), então não há retry manual aqui.
 *
 * Editar em outra aba não atrapalha: router.refresh() troca o que veio do
 * servidor, mas o estado local dos componentes — inclusive um campo de preço em
 * edição — é preservado pelo React.
 */
export function LiveUpdates() {
  const router = useRouter();

  useEffect(() => {
    // navigator.onLine falso não impede: o EventSource lida com a reconexão.
    const source = new EventSource('/api/updates');

    const onChange = () => router.refresh();
    source.addEventListener('change', onChange);

    return () => {
      source.removeEventListener('change', onChange);
      source.close();
    };
  }, [router]);

  return null;
}
