
'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, setDoc, getDoc, Firestore } from 'firebase/firestore';
import { useFirestore, useDoc } from '@/firebase';
import type { SiteInfo } from '@/lib/types';
import { useMemoFirebase } from '@/firebase/provider';

const SITE_INFO_DOC_ID = 'main';

const defaultSiteInfo: SiteInfo = {
    siteName: 'MR Bebidas',
    heroTitle1: 'MR BEBIDAS',
    heroTitle2: 'DISTRIBUIDORA',
    heroLocation: 'FORTALEZA',
    heroSlogan: 'Explore nossa seleção completa de tabacaria e bebidas premium',
    heroPhone: '5585994125603',
    heroPhoneDisplay: '(85) 99412-5603',
    heroLocation2: 'CUMBUCO',
    heroPhone2: '5585992234683',
    heroPhoneDisplay2: '(85) 99223-4683',
};

let seedingChecked = false;

async function seedSiteInfoIfEmpty(firestore: Firestore) {
  if (seedingChecked) return;
  seedingChecked = true;

  const siteInfoRef = doc(firestore, 'siteInfo', SITE_INFO_DOC_ID);
  
  try {
    const docSnap = await getDoc(siteInfoRef);
    if (!docSnap.exists()) {
        console.log('Site info document does not exist. Seeding with default data...');
        await setDoc(siteInfoRef, defaultSiteInfo);
        console.log('Site info seeded successfully!');
    } else {
        console.log('Site info document exists. Skipping seed.');
    }
  } catch (error) {
    console.warn("Could not check or seed site info (this is expected on first load without auth):", error);
  }
}

export function useSiteInfo() {
  const firestore = useFirestore();
  const [key, setKey] = useState(0);
   
  useEffect(() => {
    if (firestore) {
      seedSiteInfoIfEmpty(firestore);
    }
  }, [firestore]);

  const siteInfoRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return doc(firestore, 'siteInfo', SITE_INFO_DOC_ID);
  }, [firestore, key]);


  const { data: firestoreInfo, isLoading: isFirestoreLoading, error } = useDoc<SiteInfo>(siteInfoRef);
  
  const refreshSiteInfo = useCallback(() => {
    setKey(prevKey => prevKey + 1);
  }, []);

  const siteInfo = firestoreInfo ?? defaultSiteInfo;
    
  return { siteInfo, isLoading: isFirestoreLoading, error, siteInfoRef, refreshSiteInfo };
}
