import { randomBytes } from 'node:crypto';
import { mkdir, unlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Fotos dos produtos.
 *
 * Ficam no MESMO volume do banco (/data em produção). Não podem ir para
 * `public/`: aquilo é parte da imagem Docker, então toda foto enviada sumiria
 * no redeploy seguinte — o mesmo motivo que obriga o banco a estar no volume.
 *
 * Este módulo NÃO importa 'server-only', igual a src/db/open.ts: o
 * scripts/verify-uploads.ts precisa exercitar exatamente este código fora do
 * Next. Importar daqui num client component quebra o build de qualquer forma —
 * `node:fs` e o sharp não existem no navegador.
 */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — foto de celular cabe
const MAX_DIMENSION = 800; // px, maior lado
const WEBP_QUALITY = 80;

/** Nome gerado por nós: 32 hex + .webp. Ver assertSafeImageName. */
const SAFE_NAME = /^[a-f0-9]{32}\.webp$/;

export function getUploadsPath(): string {
  return process.env.UPLOADS_PATH ?? './data/uploads';
}

/**
 * Garante que o nome veio de nós e não é um caminho.
 *
 * O nome chega pela URL (/api/images/<nome>) e do banco. Sem esta checagem,
 * "../../etc/passwd" ou "../app.db" seriam caminhos válidos a partir da pasta
 * de uploads — o pedido leria qualquer arquivo do volume, inclusive o banco.
 */
export function isSafeImageName(name: string): boolean {
  return SAFE_NAME.test(name);
}

export type SaveResult = { ok: true; file: string } | { ok: false; error: string };

/**
 * Processa e grava a foto enviada.
 *
 * Sempre reescreve a imagem com o sharp, em vez de guardar o arquivo original:
 * - normaliza para webp num tamanho só, então uma foto de 5 MB do celular não
 *   vira 5 MB no carregamento de cada cliente;
 * - `.rotate()` aplica a orientação do EXIF — sem isso, foto tirada na vertical
 *   aparece deitada, porque o navegador ignora esse metadado em <img>;
 * - o metadado EXIF (que inclui localização do GPS, em foto de celular) não
 *   sobrevive ao reencode;
 * - um arquivo que o sharp não decodifica não é imagem, então nada que não seja
 *   imagem chega ao disco.
 */
export async function saveProductImage(file: File): Promise<SaveResult> {
  if (file.size === 0) return { ok: false, error: 'Arquivo vazio.' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'A imagem passa de 10 MB. Use uma foto menor.' };
  }

  const input = Buffer.from(await file.arrayBuffer());

  let output: Buffer;
  try {
    output = await sharp(input)
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    return { ok: false, error: 'Não consegui ler esse arquivo como imagem.' };
  }

  const name = `${randomBytes(16).toString('hex')}.webp`;
  const dir = getUploadsPath();
  await mkdir(dir, { recursive: true });
  await writeFileAtomic(join(dir, name), output);

  return { ok: true, file: name };
}

export async function readProductImage(name: string): Promise<Buffer | null> {
  if (!isSafeImageName(name)) return null;
  try {
    return await readFile(join(getUploadsPath(), name));
  } catch {
    return null;
  }
}

/**
 * Apaga a foto. Falhar aqui não pode derrubar a operação: um arquivo órfão
 * ocupa alguns KB, enquanto um erro impediria o admin de excluir o produto.
 */
export async function deleteProductImage(name: string | null): Promise<void> {
  if (!name || !isSafeImageName(name)) return;
  try {
    await unlink(join(getUploadsPath(), name));
  } catch {
    // já não existe, ou sem permissão — segue.
  }
}

async function writeFileAtomic(path: string, data: Buffer): Promise<void> {
  const { writeFile, rename } = await import('node:fs/promises');
  const tmp = `${path}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, data);
  // rename é atômico no mesmo sistema de arquivos: ou o arquivo existe
  // inteiro, ou não existe. Sem isto, uma queda no meio da escrita deixaria
  // uma foto truncada que o banco já considera válida.
  await rename(tmp, path);
}
