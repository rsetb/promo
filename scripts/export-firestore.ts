/**
 * Exporta o catálogo do Firestore para data/firestore-export.json.
 *
 * Script de migração de uso único, mantido no repositório para que a origem
 * dos dados em Postgres seja auditável. Não precisa de credencial: products,
 * categories e siteInfo são de leitura pública nas rules atuais.
 *
 * Uso: npx tsx scripts/export-firestore.ts
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { writeFileSync, mkdirSync } from 'node:fs';

/**
 * Config do projeto Firebase antigo. Chaves de API do Firebase Web são públicas
 * por design (a proteção real ficava nas security rules), então não há segredo
 * aqui — é só o endereço de onde os dados vêm.
 */
const firebaseConfig = {
  projectId: 'studio-6761180622-96003',
  appId: '1:427718591118:web:19fa7aa95d583033fb7fdf',
  apiKey: 'AIzaSyBSIck40leMbVpHcWOKgla8rDboVhfluys',
  authDomain: 'studio-6761180622-96003.firebaseapp.com',
  messagingSenderId: '427718591118',
};

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const productsSnap = await getDocs(collection(db, 'products'));
  const products = productsSnap.docs.map((d) => ({ ...d.data(), id: d.id }));

  const categoriesSnap = await getDocs(collection(db, 'categories'));
  const categories = categoriesSnap.docs.map((d) => ({ ...d.data(), id: d.id }));

  const siteInfoSnap = await getDoc(doc(db, 'siteInfo', 'main'));
  const siteInfo = siteInfoSnap.exists() ? siteInfoSnap.data() : null;

  const output = {
    exportedAt: new Date().toISOString(),
    products,
    categories,
    siteInfo,
  };

  mkdirSync('data', { recursive: true });
  writeFileSync('data/firestore-export.json', JSON.stringify(output, null, 2));

  console.log(`produtos:   ${products.length}`);
  console.log(`categorias: ${categories.length}`);
  console.log(`siteInfo:   ${siteInfo ? 'ok' : 'AUSENTE'}`);
  console.log('-> data/firestore-export.json');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha no export:', err);
    process.exit(1);
  });
