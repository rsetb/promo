import 'server-only';

/**
 * Avisos de "o catálogo mudou", em memória do processo.
 *
 * Quando o admin salva algo, as Server Actions chamam notifyCatalogChange(); a
 * rota /api/updates repassa o aviso para cada aba aberta, que então pede uma
 * atualização. Assim a página só refaz a busca quando algo realmente mudou —
 * em vez de ficar recarregando a cada X segundos para descobrir que nada mudou.
 *
 * LIMITE: o barramento vive na memória de UM processo. Com uma instância só (o
 * caso no EasyPanel) funciona; se um dia houver réplicas, cada uma avisaria só
 * as suas abas, e isto precisaria ir para Redis ou um canal externo.
 *
 * Alterações feitas fora do app (ex.: escrever direto no arquivo .db) também
 * não disparam aviso — só passam pelo caminho das Server Actions.
 */

type Listener = () => void;

const globalForEvents = globalThis as unknown as { catalogListeners?: Set<Listener> };

// Guardado no globalThis porque o hot reload do Next recria os módulos: sem
// isto, o emissor das actions e o ouvinte da rota SSE seriam Sets diferentes.
const listeners: Set<Listener> = (globalForEvents.catalogListeners ??= new Set());

export function onCatalogChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyCatalogChange(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Uma aba que já caiu não pode impedir o aviso das outras.
    }
  }
}
