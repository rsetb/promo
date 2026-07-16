# MR Bebidas Distribuidora — catálogo

Vitrine de produtos com edição pelo próprio site. Next.js 15 (App Router) +
Postgres via Drizzle.

## Como funciona

O navegador nunca fala com o banco. As páginas são Server Components: leem o
Postgres no servidor e mandam HTML pronto. Escritas passam por Server Actions,
que verificam a sessão antes de tocar no banco.

```
Browser ──HTML──> Server Component ──SQL──> Postgres
   └────Server Action (checa sessão)────┘
```

Não há cadastro: existe uma senha de administrador, em `ADMIN_PASSWORD`. Quem
entra com ela recebe um cookie de sessão assinado (HMAC-SHA256) e passa a ver os
controles de edição.

| Diretório | O quê |
| --- | --- |
| `src/app` | Rotas (home, login, admin/categories) |
| `src/components` | UI — só é client component o que precisa de interação |
| `src/db` | Schema Drizzle e conexão |
| `src/lib` | `auth.ts` (sessão), `actions.ts` (escritas), `queries.ts` (leituras) |
| `drizzle` | Migrations SQL versionadas |
| `scripts` | Migração do Firestore, banco local, verificação |

## Desenvolvimento

Precisa de um Postgres. Se não tiver nenhum à mão, o projeto sobe um:

```bash
npm install
cp .env.example .env     # ajuste os valores
npm run dev:db           # Postgres local (PGlite/WASM) na porta 54329 — deixe rodando
npm run dev              # em outro terminal
```

`dev:db` aplica as migrations e importa `data/firestore-export.json` na primeira
execução; os dados ficam em `data/dev-db/`.

> **Limitação do `dev:db`:** o PGlite atende **uma conexão por vez**. Com o app
> conectado, qualquer outro cliente (ex.: `node scripts/probe-db.mjs`) derruba a
> conexão. Por isso o `.env` de desenvolvimento usa `DB_POOL_MAX=1`. Para usar
> mais de um cliente ao mesmo tempo, aponte a `DATABASE_URL` para um Postgres de
> verdade.

## Verificação

```bash
npm run db:verify   # roda migrations + import num Postgres real (WASM) e confere o resultado
npm run typecheck
npm run build
```

`db:verify` usa o mesmo SQL e o mesmo código de import da migração de produção,
com os dados reais exportados — 24 checagens, incluindo as restrições do banco
(preço negativo, categoria duplicada, exclusão de categoria com produtos).

## Deploy no EasyPanel

Crie **dois serviços**:

**1. Postgres.** Use o template de Postgres do EasyPanel. Não exponha a porta
5432 para a internet — o app acessa pela rede interna do Docker.

**2. App.** Aponte para este repositório; o `Dockerfile` na raiz é detectado
sozinho. Variáveis de ambiente:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | `postgres://usuario:senha@<host-interno-do-postgres>:5432/promo` |
| `DATABASE_SSL` | `false` (rede interna do Docker não tem TLS) |
| `ADMIN_PASSWORD` | senha longa e aleatória — quem a tiver edita o catálogo |
| `SESSION_SECRET` | 32+ caracteres aleatórios; trocar desloga todo mundo |

Gere os segredos com:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

As migrations rodam sozinhas no start do container (`scripts/migrate.mjs`).

### Carga inicial dos dados

Depois do primeiro deploy, com o banco vazio, rode o import de dentro da rede da
VPS (terminal do container do app, ou qualquer lugar com acesso ao Postgres):

```bash
npx tsx scripts/import-to-postgres.ts          # aborta se já houver dados
npx tsx scripts/import-to-postgres.ts --force  # apaga e reimporta
```

Se você ainda estiver editando o catálogo no site antigo (Firestore), gere um
export novo antes de migrar, para não perder as últimas alterações:

```bash
npm run firestore:export
```

## Origem dos dados

O catálogo veio do Firestore. `data/firestore-export.json` é o export bruto
(294 produtos, 80 categorias) e fica versionado como prova de origem. A
transformação, em `scripts/lib/transform.ts`, aplicou:

- **80 → 22 categorias.** O seed antigo rodava no navegador e gravava com ID
  automático; abas simultâneas semeavam em paralelo e cada categoria virou ~5
  registros. Agora `name` é `UNIQUE`.
- **294 → 285 produtos.** Nove nomes estavam duplicados — seis deles escondidos
  por espaço em branco no fim do nome. Em cada par, ficou a versão editada pelo
  site (preço mais recente) e saiu a do seed estático.
- **Preço sem valor virou `NULL`.** Antes, "sem preço" era `null` ou `0`,
  indistintamente; ambos exibiam "Consulte". Agora há uma representação só.
- **Categoria `CIGARRO NACIONAL`** (digitação) foi unificada em
  `CIGARROS NACIONAL`.
