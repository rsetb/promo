import 'server-only';

/**
 * Ponto de entrada do banco para o código do app.
 *
 * A implementação está em ./client — sem 'server-only', para que os scripts de
 * verificação possam usá-la fora do Next. Este módulo existe para que uma
 * importação acidental a partir de um client component falhe com uma mensagem
 * clara, em vez de um erro de bundler sobre `node:fs`.
 */
export { db, schema, getDatabasePath } from './client';
