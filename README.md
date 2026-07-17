# MR Bebidas Distribuidora — catálogo

Vitrine de produtos com edição pelo próprio site. Next.js 15 (App Router) +
SQLite via Drizzle.

## Como funciona

O navegador nunca fala com o banco. As páginas são Server Components: leem o
SQLite no servidor e mandam HTML pronto. Escritas passam por Server Actions,
que verificam a sessão antes de tocar no banco.

```
Browser ──HTML──> Server Component ──SQL──> SQLite (arquivo)
   └────Server Action (checa sessão)────┘
```

Não há cadastro: existe uma senha de administrador, em `ADMIN_PASSWORD`. Quem
entra com ela recebe um cookie de sessão assinado (HMAC-SHA256) e passa a ver os
controles de edição.

O banco é **um arquivo** (`DATABASE_PATH`). Não há serviço de banco separado —
para 285 produtos e um admin, SQLite sobra.

| Diretório | O quê |
| --- | --- |
| `src/app` | Rotas (home, login, admin/categories) |
| `src/components` | UI — só é client component o que precisa de interação |
| `src/db` | Schema Drizzle, `open.ts` (conexão + PRAGMAs) |
| `src/lib` | `auth.ts` (sessão), `actions.ts` (escritas), `queries.ts` (leituras) |
| `drizzle` | Migrations SQL versionadas |
| `scripts` | Migrate, import do catálogo, verificação |

### Duas decisões que valem saber

**Preço em centavos.** SQLite não tem tipo decimal. As opções seriam REAL
(ponto flutuante, que acumula erro em dinheiro) ou TEXT (sem aritmética). A
coluna `price_cents` é um inteiro: R$ 137,80 vira `13780`. Converta só na
fronteira, com os helpers de `src/lib/format.ts` — não divida por 100 espalhado
pela UI.

**`PRAGMA foreign_keys = ON` não é opcional.** O SQLite ignora foreign keys por
padrão, e o PRAGMA vale por conexão (não fica no arquivo). Sem ele, excluir uma
categoria que ainda tem produtos passaria batido. Por isso toda abertura de
banco — app e scripts — passa por `src/db/open.ts`, e `db:verify` confere que o
PRAGMA está ligado.

## Desenvolvimento

```bash
npm install
cp .env.example .env    # ajuste os valores
npm run db:import       # cria data/app.db e carrega o catálogo
npm run dev
```

Sem serviço de banco para subir: o arquivo é o banco.

## Verificação

```bash
npm run db:verify   # migration + import num SQLite descartável, e confere o resultado
npm run typecheck
npm run build
```

`db:verify` usa o mesmo SQL, a mesma abertura de conexão e o mesmo código de
import que rodam em produção, com os dados reais — 28 checagens, incluindo os
PRAGMAs e as restrições do banco (preço negativo, categoria duplicada, exclusão
de categoria com produtos).

## Deploy no EasyPanel

Um serviço só: um **App** apontando para este repositório (o `Dockerfile` na
raiz é detectado sozinho).

**O volume é obrigatório.** Monte um volume em **`/data`**. O banco inteiro é o
arquivo `/data/app.db`; sem volume ele fica na camada gravável do container e
**o catálogo é perdido no primeiro redeploy**.

Variáveis de ambiente:

| Variável | Valor |
| --- | --- |
| `DATABASE_PATH` | `/data/app.db` (já é o default da imagem) |
| `ADMIN_PASSWORD` | senha longa e aleatória — quem a tiver edita o catálogo |
| `SESSION_SECRET` | 32+ caracteres aleatórios; trocar desloga todo mundo |

Gere os segredos com:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

As migrations rodam sozinhas no start do container (`scripts/migrate.mjs`).

### Carga inicial dos dados

No primeiro deploy o banco sobe vazio (só o schema). Para carregar o catálogo,
rode uma vez no terminal do container:

```bash
node scripts/migrate.mjs   # já roda no start, mas não custa
npx tsx scripts/import-catalog.ts
```

> O `db:import` aborta se já houver produtos. Use `--force` só para apagar tudo
> e reimportar — ele **descarta as edições feitas pelo site**.

### Backup

O banco é um arquivo. Copiar ele (e os `-wal`/`-shm` ao lado) é o backup:

```bash
sqlite3 /data/app.db ".backup /data/backup-$(date +%F).db"
```

Use `.backup` em vez de `cp`: ele lida com escritas em andamento.

## Origem dos dados

O catálogo foi migrado de um banco anterior (Firestore, já descontinuado neste
projeto). `data/catalog-export.json` é o export bruto — 294 produtos, 80
categorias — e fica versionado como prova de origem: é dele que o `db:import`
carrega o banco.

A transformação, em `scripts/lib/transform.ts`, aplicou:

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

Esse export é um retrato do momento da migração e não é atualizável: as
ferramentas do banco antigo foram removidas do projeto. A partir daqui, a fonte
de verdade é o SQLite.
