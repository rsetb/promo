import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Abertura do banco — fonte única dos PRAGMAs.
 *
 * Este módulo NÃO importa 'server-only' de propósito: o app (src/db/index.ts) e
 * os scripts de linha de comando precisam abrir o banco exatamente do mesmo
 * jeito. Se cada um tivesse a sua cópia, um deles acabaria com foreign_keys
 * desligado e a diferença só apareceria em produção.
 */

export function getDatabasePath(): string {
  return process.env.DATABASE_PATH ?? './data/app.db';
}

export function openDatabase(path: string = getDatabasePath()): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);

  // CRÍTICO: o SQLite ignora foreign keys por padrão, e o PRAGMA vale por
  // conexão (não fica gravado no arquivo). Sem isto, excluir uma categoria que
  // ainda tem produtos passaria batido e deixaria produtos apontando para uma
  // categoria inexistente — exatamente o que o onDelete: 'restrict' promete
  // impedir.
  sqlite.pragma('foreign_keys = ON');

  // WAL: leitores não travam o escritor e vice-versa. Sem isto, uma escrita
  // bloqueia todas as leituras — e o catálogo é quase só leitura.
  sqlite.pragma('journal_mode = WAL');

  // Espera até 5s por um lock em vez de falhar na hora.
  sqlite.pragma('busy_timeout = 5000');

  // NORMAL com WAL é seguro contra queda do processo e bem mais rápido que FULL.
  sqlite.pragma('synchronous = NORMAL');

  return sqlite;
}
