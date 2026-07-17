import { isSafeImageName, readProductImage } from '@/lib/uploads';

export const runtime = 'nodejs';

/**
 * Serve as fotos que estão no volume.
 *
 * Precisa existir porque o volume fica fora de `public/` — e tem que ficar,
 * senão as fotos sumiriam a cada redeploy.
 *
 * O nome é gerado por nós e nunca muda: o conteúdo de /api/images/<nome> é
 * imutável. Por isso o cache é agressivo — trocar a foto de um produto gera um
 * nome novo, então não há o que invalidar.
 */
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;

  if (!isSafeImageName(file)) {
    return new Response('Não encontrado', { status: 404 });
  }

  const image = await readProductImage(file);
  if (!image) {
    return new Response('Não encontrado', { status: 404 });
  }

  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(image.byteLength),
    },
  });
}
