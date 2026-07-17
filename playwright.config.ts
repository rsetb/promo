import { defineConfig, devices } from '@playwright/test';

/**
 * Testes que usam o site como uma pessoa usa: clicando, num navegador de
 * verdade.
 *
 * Existem porque as verificações de script (npm run verify) exercitam o
 * servidor — banco, senha, upload — e nunca tocam na interface. Todos os bugs
 * que chegaram ao usuário eram de interface: botão que não atualizava a tela,
 * lápis invisível no celular, página sem caminho de volta, erro do banco
 * virando tela branca.
 *
 * O projeto "celular" não é luxo: é o aparelho onde o dono do catálogo
 * trabalha, e onde `hover` não existe — a causa de um dos bugs.
 */
export default defineConfig({
  testDir: './e2e',
  // Um arquivo SQLite só, e testes que escrevem nele: em paralelo eles
  // brigariam pelo estado e falhariam sem relação com o código.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
    {
      // 375px: a largura de um iPhone comum, que é o aparelho do dono do
      // catálogo. O Pixel 7 tem 412px e passou num layout que quebrava lá.
      // Chromium com a largura certa em vez do device iPhone, que exigiria
      // baixar o WebKit — aqui o que decide o layout é a largura.
      name: 'celular-estreito',
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } },
    },
  ],

  webServer: {
    // `next start` não funciona com output: 'standalone' — o próprio Next avisa
    // e manda usar o server.js gerado, que é exatamente o que roda no container.
    command: 'node scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
