import { test, expect, type Page } from '@playwright/test';

/**
 * Testes que usam o site como uma pessoa usa.
 *
 * Cada um aqui corresponde a algo que quebrou de verdade e chegou ao usuário.
 * Não são exemplos: são a lista de erros que as verificações de script não
 * pegaram, porque elas exercitam o servidor e nunca tocam na interface.
 */

const SENHA = 'senha-de-teste-e2e';

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Menu do administrador' })).toBeVisible();
}

test.describe('visitante', () => {
  test('vê o catálogo e nenhum controle de admin', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('ABSOLUT').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar Produto' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Trocar logo' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar produto' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  });

  /**
   * BUG REAL: eu afirmei que digitar "energeticos" achava "ENERGÉTICOS". A
   * função de tirar acento funcionava isolada, mas a busca só olhava o nome do
   * produto — e ENERGÉTICOS é uma categoria. Dava "Nenhum produto encontrado".
   */
  test('busca sem acento, por nome e por categoria', async ({ page }) => {
    await page.goto('/');
    const busca = page.getByLabel('Buscar produtos');

    await busca.fill('energeticos'); // categoria, sem acento
    await expect(page.getByText('Nenhum produto encontrado')).toHaveCount(0);

    await busca.fill('cafe'); // "COCA COLA COM CAFÉ LATA 220ML"
    await expect(page.getByText('Nenhum produto encontrado')).toHaveCount(0);

    await busca.fill('absolut'); // nome, sem acento envolvido
    await expect(page.getByText('ABSOLUT').first()).toBeVisible();

    await busca.fill('xyzabc123naoexiste');
    await expect(page.getByText('Nenhum produto encontrado')).toBeVisible();
  });

  test('/admin/categories redireciona para o login', async ({ page }) => {
    await page.goto('/admin/categories');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('admin', () => {
  test('senha errada não entra', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Senha').fill('chute-errado');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('Senha incorreta.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu do administrador' })).toHaveCount(0);
  });

  /**
   * BUG REAL: eu disse que a tela atualizava sem F5 sem nunca ter clicado no
   * botão. Não atualizava — sendo tudo force-dynamic, não há cache para o
   * revalidatePath invalidar e o router nunca refazia a busca.
   *
   * BUG REAL: e só salvava clicando; Enter não fazia nada.
   */
  test('editar preço com Enter atualiza a tela sem recarregar', async ({ page }) => {
    await entrar(page);
    await page.goto('/');

    // ABSOLUT é VODKAS: preço de unidade, sem fardo.
    await page.getByRole('button', { name: 'Editar produto' }).first().click();
    const unidade = page.getByLabel('Preço da unidade').first();
    await unidade.fill('');
    await unidade.pressSequentially('12345');
    await unidade.press('Enter');

    await expect(page.getByText('R$ 123,45').first()).toBeVisible({ timeout: 15_000 });

    // Volta ao valor original, para o teste poder rodar de novo.
    await page.getByRole('button', { name: 'Editar produto' }).first().click();
    const unidade2 = page.getByLabel('Preço da unidade').first();
    await unidade2.fill('');
    await unidade2.pressSequentially('6690');
    await unidade2.press('Enter');
    await expect(page.getByText('R$ 66,90').first()).toBeVisible({ timeout: 15_000 });
  });

  /**
   * O catálogo tem fardo e unidade. "R$ 35,70" sem rótulo deixa o cliente sem
   * saber o que está comprando — e o produto só pode mostrar o preço que tem.
   */
  test('vitrine rotula fardo e unidade, e mostra só o que existe', async ({ page }) => {
    await page.goto('/');

    // AMSTEL é CERVEJAS LATAS: fardo.
    const amstel = page.locator('div').filter({ hasText: /^AMSTELCERVEJAS LATAS$/ }).first();
    await expect(page.getByText('Fardo').first()).toBeVisible();

    // ABSOLUT é VODKAS: unidade.
    await expect(page.getByText('Un.').first()).toBeVisible();

    // Produto sem nenhum preço continua "Consulte".
    await page.getByLabel('Buscar produtos').fill('AMSTEL ULTRA LONG NECK');
    await expect(page.getByText('Consulte').first()).toBeVisible();
  });

  test('produto pode ter os dois preços ao mesmo tempo', async ({ page }) => {
    await entrar(page);
    await page.goto('/');
    await page.getByLabel('Buscar produtos').fill('AMSTEL ULTRA LONG NECK');

    await page.getByRole('button', { name: 'Editar produto' }).first().click();
    const fardo = page.getByLabel('Preço do fardo').first();
    await fardo.fill('');
    await fardo.pressSequentially('9900');
    const un = page.getByLabel('Preço da unidade').first();
    await un.fill('');
    await un.pressSequentially('850');
    await un.press('Enter');

    await expect(page.getByText('R$ 99,00').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('R$ 8,50').first()).toBeVisible();

    // Limpa: este produto é o "sem preço" de outro teste, e o banco é
    // compartilhado entre os projetos desktop e celular. Sem devolver ao
    // estado original, o outro teste falha por causa deste.
    await page.getByRole('button', { name: 'Editar produto' }).first().click();
    await page.getByLabel('Preço do fardo').first().fill('');
    const un2 = page.getByLabel('Preço da unidade').first();
    await un2.fill('');
    await un2.press('Enter');
    await expect(page.getByText('Consulte').first()).toBeVisible({ timeout: 15_000 });
  });

  /** BUG REAL: a página de categorias não tinha caminho de volta. */
  test('categorias tem botão de voltar ao catálogo', async ({ page }) => {
    await entrar(page);
    await page.goto('/admin/categories');

    await expect(page.getByRole('heading', { name: 'Gerenciar Categorias' })).toBeVisible();
    await page.getByRole('link', { name: /Voltar ao catálogo/ }).click();
    await expect(page).toHaveURL('/');
  });

  /**
   * BUG REAL: o app quebrava com tela de erro. O drizzle embrulha a exceção do
   * SQLite, então error.code vinha undefined e nenhum catch casava. A
   * verificação de banco provava que o BANCO recusa; nunca provou que o APP
   * traduz a recusa numa mensagem.
   */
  test('excluir categoria com produtos mostra o motivo, sem quebrar', async ({ page }) => {
    await entrar(page);
    await page.goto('/admin/categories');

    await page.getByRole('button', { name: /Excluir VODKAS/ }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();

    await expect(page.getByText(/ainda tem produtos/).first()).toBeVisible({ timeout: 15_000 });
    // A página continua de pé: não virou tela de erro.
    await expect(page.getByRole('heading', { name: 'Gerenciar Categorias' })).toBeVisible();
  });

  test('categoria duplicada mostra o motivo', async ({ page }) => {
    await entrar(page);
    await page.goto('/admin/categories');

    await page.getByLabel('Nome da nova categoria').fill('VODKAS');
    await page.getByRole('button', { name: 'Adicionar' }).click();

    await expect(page.getByText(/já existe/).first()).toBeVisible({ timeout: 15_000 });
  });
});

/**
 * BUG REAL: o lápis usava opacity-0 group-hover:opacity-100. No celular não
 * existe hover — o cabeçalho ficava impossível de editar justamente no aparelho
 * que o dono do catálogo usa.
 */
test.describe('celular', () => {
  test.skip(({ isMobile }) => !isMobile, 'só no projeto celular');

  test('controles de edição aparecem sem hover', async ({ page }) => {
    await entrar(page);
    await page.goto('/');

    // Sem mover o mouse: no toque, o que só aparece no hover não existe.
    await expect(page.getByRole('button', { name: 'Trocar logo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar produto' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar nome do site' })).toBeVisible();
  });

  test('categorias viram dropdown', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Filtrar por categoria')).toBeVisible();
  });
});
