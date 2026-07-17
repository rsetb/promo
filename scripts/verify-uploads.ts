/**
 * Testa o processamento de fotos dos produtos: validação de nome (o que barra
 * path traversal), conversão, redimensionamento, orientação do EXIF e exclusão.
 *
 * Uso: npm run verify:uploads
 */
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.log(`  FALHOU  ${label}: esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ok      ${label} = ${JSON.stringify(actual)}`);
  }
}

function fileFrom(buffer: Buffer, name: string, type: string): File {
  return new File([new Uint8Array(buffer)], name, { type });
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'promo-uploads-'));
  process.env.UPLOADS_PATH = dir;

  // Import depois de definir UPLOADS_PATH: o módulo lê a env em getUploadsPath().
  const { saveProductImage, deleteProductImage, isSafeImageName, readProductImage } = await import(
    '../src/lib/uploads'
  );

  console.log('\n== nomes: barra o path traversal ==');
  // O nome chega pela URL. Se um caminho passasse, a rota leria qualquer
  // arquivo do volume — inclusive o próprio banco.
  check('nome legitimo', isSafeImageName('a'.repeat(32) + '.webp'), true);
  check('../app.db', isSafeImageName('../app.db'), false);
  check('..\\app.db', isSafeImageName('..\\app.db'), false);
  check('subpasta', isSafeImageName('x/y.webp'), false);
  check('extensao errada', isSafeImageName('a'.repeat(32) + '.png'), false);
  check('nome curto', isSafeImageName('abc.webp'), false);
  check('maiusculas (nao geramos)', isSafeImageName('A'.repeat(32) + '.webp'), false);
  check('vazio', isSafeImageName(''), false);

  console.log('\n== upload: converte e redimensiona ==');
  const bigJpeg = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
  console.log(`  entrada: JPEG 3000x2000, ${(bigJpeg.length / 1024).toFixed(0)} KB`);

  const saved = await saveProductImage(fileFrom(bigJpeg, 'foto.jpg', 'image/jpeg'));
  check('salvou', saved.ok, true);

  if (saved.ok) {
    const stored = await readProductImage(saved.file);
    const meta = await sharp(stored!).metadata();
    console.log(`  saida:   WEBP ${meta.width}x${meta.height}, ${(stored!.length / 1024).toFixed(0)} KB`);

    check('virou webp', meta.format, 'webp');
    check('maior lado limitado a 800', Math.max(meta.width!, meta.height!), 800);
    check('proporcao mantida (3:2)', Math.round((meta.width! / meta.height!) * 100), 150);
    check('ficou menor que a entrada', stored!.length < bigJpeg.length, true);
    check('nome gerado e seguro', isSafeImageName(saved.file), true);

    console.log('\n== exclusao ==');
    await deleteProductImage(saved.file);
    check('arquivo removido do disco', existsSync(join(dir, saved.file)), false);
    // Apagar duas vezes não pode explodir: um erro aqui impediria o admin de
    // excluir o produto.
    await deleteProductImage(saved.file);
    check('apagar de novo nao quebra', true, true);
  }

  console.log('\n== orientacao do EXIF ==');
  // Foto de celular na vertical vem com os pixels deitados + um EXIF dizendo
  // "gire 90". O navegador ignora isso em <img>, então a foto apareceria
  // deitada se o sharp não aplicasse o .rotate().
  const rotated = await sharp({
    create: { width: 1000, height: 500, channels: 3, background: { r: 10, g: 90, b: 200 } },
  })
    .withMetadata({ orientation: 6 }) // 6 = girar 90 no sentido horário
    .jpeg()
    .toBuffer();

  const savedRot = await saveProductImage(fileFrom(rotated, 'vertical.jpg', 'image/jpeg'));
  check('salvou a foto com EXIF', savedRot.ok, true);
  if (savedRot.ok) {
    const meta = await sharp((await readProductImage(savedRot.file))!).metadata();
    console.log(`  1000x500 + orientation:6 -> ${meta.width}x${meta.height}`);
    check('rotacao aplicada (virou retrato)', meta.height! > meta.width!, true);
    await deleteProductImage(savedRot.file);
  }

  console.log('\n== recusa o que nao e imagem ==');
  const notImage = await saveProductImage(fileFrom(Buffer.from('nao sou imagem'), 'x.jpg', 'image/jpeg'));
  check('texto disfarcado de .jpg', notImage.ok, false);

  const empty = await saveProductImage(fileFrom(Buffer.alloc(0), 'v.jpg', 'image/jpeg'));
  check('arquivo vazio', empty.ok, false);

  const tooBig = await saveProductImage(
    fileFrom(Buffer.alloc(11 * 1024 * 1024), 'grande.jpg', 'image/jpeg')
  );
  check('acima de 10 MB', tooBig.ok, false);
  if (!tooBig.ok) console.log(`          mensagem: "${tooBig.error}"`);

  console.log('\n== leitura de nome invalido ==');
  check('readProductImage("../app.db")', await readProductImage('../app.db'), null);

  rmSync(dir, { recursive: true, force: true });

  console.log(`\n${'-'.repeat(46)}`);
  if (failures) {
    console.log(`${failures} de ${checks} verificacoes FALHARAM`);
    process.exit(1);
  }
  console.log(`todas as ${checks} verificacoes passaram`);
}

main().catch((err) => {
  console.error('erro:', err);
  process.exit(1);
});
