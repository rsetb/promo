/**
 * Testa a formatação de preço: máscara de digitação e conversão para centavos.
 *
 * Dinheiro é o dado mais sensível do catálogo — um erro aqui vira preço errado
 * na vitrine, não uma tela feia.
 *
 * Uso: npm run verify:format
 */
import { formatPrice, maskPriceInput, parsePriceToCents, priceToInput } from '../src/lib/format';

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.log(`  FALHOU  ${label}: esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ok      ${label} -> ${JSON.stringify(actual)}`);
  }
}

console.log('\n== mascara: digitos entram pela direita ==');
check('vazio', maskPriceInput(''), '');
check('"6"', maskPriceInput('6'), '0,06');
check('"66"', maskPriceInput('66'), '0,66');
check('"669"', maskPriceInput('669'), '6,69');
check('"6699"', maskPriceInput('6699'), '66,99');
check('"123456"', maskPriceInput('123456'), '1.234,56');
check('"12345678"', maskPriceInput('12345678'), '123.456,78');
check('colar "R$ 1.234,56"', maskPriceInput('R$ 1.234,56'), '1.234,56');
check('letras sao ignoradas', maskPriceInput('abc12'), '0,12');
check('zeros a esquerda', maskPriceInput('000123'), '1,23');
check('so zeros', maskPriceInput('000'), '');
check('apagar tudo', maskPriceInput('0,06'.slice(0, 0)), '');

console.log('\n== mascara -> centavos (o que vai para o banco) ==');
check('"66,99"', parsePriceToCents('66,99'), 6699);
check('"1.234,56"', parsePriceToCents('1.234,56'), 123456);
check('"0,06"', parsePriceToCents('0,06'), 6);
check('vazio = Consulte', parsePriceToCents(''), null);
check('zero = Consulte (uma representacao so)', parsePriceToCents('0,00'), null);
check('negativo = Consulte', parsePriceToCents('-5'), null);
check('lixo = Consulte', parsePriceToCents('abc'), null);

console.log('\n== ida e volta: banco -> input -> banco ==');
for (const cents of [1, 6, 99, 100, 6699, 13780, 123456, 999999]) {
  check(`${cents} centavos`, parsePriceToCents(priceToInput(cents)), cents);
}

console.log('\n== exibicao na vitrine ==');
// Intl separa "R$" do numero com espaco NAO-QUEBRAVEL (U+00A0), nao com espaco
// comum — e os dois sao indistinguiveis a olho nu.
const NBSP = String.fromCharCode(160);
check('13780', formatPrice(13780), `R$${NBSP}137,80`);
check('6699', formatPrice(6699), `R$${NBSP}66,99`);
check('123456', formatPrice(123456), `R$${NBSP}1.234,56`);
check('null', formatPrice(null), 'Consulte');

console.log(`\n${'-'.repeat(46)}`);
if (failures) {
  console.log(`${failures} de ${checks} verificacoes FALHARAM`);
  process.exit(1);
}
console.log(`todas as ${checks} verificacoes passaram`);
