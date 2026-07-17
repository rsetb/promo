import { onCatalogChange } from '@/lib/events';

// Precisa do runtime Node: o barramento de eventos vive na memória do processo.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

/**
 * Stream SSE que avisa as abas abertas quando o catálogo muda.
 *
 * O evento carrega só "mudou" — não os dados. Quem recebe pede a página nova ao
 * servidor, que é a fonte de verdade. Mandar o dado pelo stream criaria um
 * segundo caminho de leitura para manter em sincronia com o primeiro.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Comentário inicial: abre o stream e faz o EventSource considerar
      // a conexão estabelecida.
      send(': conectado\n\n');

      const unsubscribe = onCatalogChange(() => send('event: change\ndata: 1\n\n'));

      // Proxies e balanceadores derrubam conexões ociosas. O ping mantém viva.
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // já fechado pelo cliente
        }
      };

      // Aba fechada, navegação, refresh: solta o ouvinte, senão o Set cresce
      // sem parar e vaza memória.
      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Impede o nginx/proxy de segurar o stream em buffer esperando encher.
      'X-Accel-Buffering': 'no',
    },
  });
}
