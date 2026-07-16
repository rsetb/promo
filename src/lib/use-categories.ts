'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, doc, writeBatch, getDocs, Firestore, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Category } from '@/lib/types';
import { useMemoFirebase } from '@/firebase/provider';
import { products } from '@/lib/products';

let seedingChecked = false;

// Derive unique, uppercase categories directly from the products list.
const initialCategories = [...new Set(products.map(p => p.category.toUpperCase()))];

async function seedDatabaseIfEmpty(firestore: Firestore) {
  if (seedingChecked) {
    return;
  }
  seedingChecked = true;
  const categoriesCollectionRef = collection(firestore, 'categories');
  
  try {
    const snapshot = await getDocs(categoriesCollectionRef);
    if (snapshot.empty) {
        console.log('Categories collection is empty. Seeding database...');
        const batch = writeBatch(firestore);
        
        initialCategories.forEach((categoryName) => {
            const docRef = doc(collection(firestore, 'categories'));
            batch.set(docRef, { name: categoryName });
        });
        
        await batch.commit();
        console.log('Database seeded successfully with unique, uppercase initial categories!');
    } else {
        console.log('Categories collection already has data. Skipping seed.');
    }

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
        console.log("Could not check or seed categories collection (this is expected on first load without auth):", error);
    }
  }
}

export function useCategories() {
  const firestore = useFirestore();
  const [key, setKey] = useState(0); 
  
  useEffect(() => {
    if (firestore) {
      seedDatabaseIfEmpty(firestore);
    }
  }, [firestore]);

  const categoriesQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'categories'), orderBy('name'));
  }, [firestore, key]);


  const { data: firestoreCategories, isLoading, error } = useCollection<Omit<Category, 'id'>>(categoriesQuery);

  const refreshCategories = useCallback(() => {
    setKey(prevKey => prevKey + 1);
  }, []);

  const categories: Category[] | null = firestoreCategories ? firestoreCategories.map(c => ({...c, name: c.name as string})) : [];
  
  return { categories, isLoading, error, refreshCategories };
}
