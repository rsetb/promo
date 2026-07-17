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

  return processAndStore(Buffer.from(await file.arrayBuffer()));
}

/**
 * Caminho único de processamento: upload e URL passam os dois por aqui.
 *
 * Ter uma função só garante que as duas origens recebam a mesma validação, o
 * mesmo redimensionamento e a mesma remoção de EXIF — em vez de uma delas
 * ficar para trás quando alguém mexer numa e esquecer da outra.
 */
async function processAndStore(input: Buffer): Promise<SaveResult> {
  let output: Buffer;
  try {
    output = await sharp(input)
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch {
    return { ok: false, error: 'Não consegui ler isso como imagem.' };
  }

  const name = `${randomBytes(16).toString('hex')}.webp`;
  const dir = getUploadsPath();
  await mkdir(dir, { recursive: true });
  await writeFileAtomic(join(dir, name), output);

  return { ok: true, file: name };
}

/**
 * Baixa a imagem de uma URL e guarda como se fosse upload.
 *
 * Guardamos o arquivo em vez do link: um link quebra quando o site de origem
 * sai do ar, troca o endereço ou bloqueia hotlink — e aí a foto some do
 * catálogo sem ninguém mexer em nada.
 */
export async function saveProductImageFromUrl(rawUrl: string): Promise<SaveResult> {
  const url = parsePublicHttpUrl(rawUrl);
  if (!url) return { ok: false, error: 'Endereço inválido. Use um link http:// ou https://.' };

  const blocked = await resolvesToPrivateAddress(url.hostname);
  if (blocked) {
    // SSRF: sem esta checagem, colar "http://localhost:3000" ou um IP interno
    // faria o servidor buscar na PRÓPRIA rede da VPS e devolver o resultado.
    return { ok: false, error: 'Esse endereço aponta para a rede interna do servidor.' };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'image/*' },
    });
  } catch {
    return { ok: false, error: 'Não consegui baixar a imagem desse endereço.' };
  }

  if (!response.ok) {
    return { ok: false, error: `O site respondeu ${response.status} ao pedir a imagem.` };
  }

  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'A imagem passa de 10 MB. Escolha outra.' };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  // O content-length pode mentir ou nem vir; conferimos o tamanho real também.
  if (buffer.length === 0) return { ok: false, error: 'O endereço não devolveu nenhum dado.' };
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'A imagem passa de 10 MB. Escolha outra.' };
  }

  // Daqui em diante é o mesmo caminho do upload: o sharp valida, corrige
  // orientação, redimensiona e descarta o EXIF.
  return processAndStore(buffer);
}

/** Aceita só http/https. Descarta file://, data:, gopher:// e afins. */
function parsePublicHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url;
}

/**
 * Resolve o hostname e recusa endereços que não são da internet pública.
 *
 * Cobre localhost, 10.x, 172.16-31.x, 192.168.x, link-local (169.254.x — que
 * inclui o endpoint de metadados das nuvens) e os equivalentes em IPv6.
 */
async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  const { lookup } = await import('node:dns/promises');
  try {
    const results = await lookup(hostname, { all: true });
    return results.some(({ address }) => isPrivateAddress(address));
  } catch {
    // Não resolveu: o fetch falharia de qualquer forma.
    return true;
  }
}

function isPrivateAddress(address: string): boolean {
  if (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80')) {
    return true;
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;

  const [a, b] = parts;
  if (a === 127 || a === 0 || a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // metadados de nuvem
  return false;
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
