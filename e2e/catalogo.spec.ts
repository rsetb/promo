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

  test('produto pode ter os três preços, com quantidade', async ({ page }) => {
    await entrar(page);
    await page.goto('/');
    await page.getByLabel('Buscar produtos').fill('AMSTEL ULTRA LONG NECK');

    await page.getByRole('button', { name: 'Editar produto' }).first().click();
    const fardo = page.getByLabel('Preço do fardo').first();
    await fardo.fill('');
    await fardo.pressSequentially('9900');
    const qtd = page.getByLabel('Unidades por fardo').first();
    await qtd.fill('');
    await qtd.pressSequentially('12');
    const un = page.getByLabel('Preço da unidade').first();
    await un.fill('');
    await un.pressSequentially('850');
    await un.press('Enter');

    await expect(page.getByText('R$ 99,00').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('R$ 8,50').first()).toBeVisible();
    // A quantidade entra no rotulo: "Fardo 12un".
    await expect(page.getByText('Fardo 12un')).toBeVisible();

    // Limpa: este produto é o "sem preço" de outro teste, e o banco é
    // compartilhado entre os projetos desktop e celular. Sem devolver ao
    // estado original, o outro teste falha por causa deste.
    await page.getByRole('button', { name: 'Editar produto' }).first().click();
    await page.getByLabel('Preço do fardo').first().fill('');
    await page.getByLabel('Unidades por fardo').first().fill('');
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

  /**
   * O preço fica ao lado do nome, não embaixo — empilhar desperdiçava metade da
   * largura da tela. O risco de colocar lado a lado é um nome longo empurrar o
   * preço para fora; este teste é o que prova que não acontece.
   */
  test('preço fica ao lado do nome, sem rolagem lateral', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Buscar produtos').fill('AMSTEL ULTRA LONG NECK');
    await expect(page.getByText('AMSTEL ULTRA LONG NECK 12X275ML')).toBeVisible();

    // Preço e nome na mesma faixa horizontal: se estivesse embaixo, o topo do
    // preço ficaria abaixo da base do nome.
    const nome = await page.getByText('AMSTEL ULTRA LONG NECK 12X275ML').boundingBox();
    const preco = await page.getByText('Consulte').first().boundingBox();
    expect(nome).not.toBeNull();
    expect(preco).not.toBeNull();
    expect(preco!.x, 'o preço fica à direita do nome').toBeGreaterThan(nome!.x);
    expect(preco!.y, 'o preço não fica abaixo do nome').toBeLessThan(nome!.y + nome!.height);
  });

  /**
   * Nome comprido SEM espaços é o caso que realmente quebra o layout: texto com
   * espaço quebra sozinho, então os nomes do catálogo não provam nada. É este
   * cenário que o min-w-0/break-words defende — e sem ele, o preço sai da tela.
   */
  test('nome comprido sem espaços não empurra o preço para fora', async ({ page }) => {
    const NOME = 'PRODUTOCOMNOMEABSURDAMENTELONGOSEMESPACOSPARATESTE';

    await entrar(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Adicionar Produto' }).click();
    await page.getByLabel('Nome do Produto').fill(NOME);
    await page.getByLabel('Preço da unidade').fill('12345');
    await page.locator('#product-category').click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Adicionar Produto' }).last().click();

    await page.getByLabel('Buscar produtos').fill(NOME);
    await expect(page.getByText(NOME)).toBeVisible({ timeout: 15_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow, 'a página não pode rolar de lado no celular').toBe(false);

    const preco = await page.getByText('R$ 123,45').first().boundingBox();
    const largura = page.viewportSize()!.width;
    expect(preco).not.toBeNull();
    expect(preco!.x + preco!.width, 'o preço tem que caber na tela').toBeLessThanOrEqual(largura);

    // Limpa: o banco é compartilhado entre os projetos.
    await page.getByRole('button', { name: 'Mais ações' }).first().click();
    await page.getByRole('menuitem', { name: 'Excluir' }).click();
    await page.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(page.getByText(NOME)).toHaveCount(0, { timeout: 15_000 });
  });
});
