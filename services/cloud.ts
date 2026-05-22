
import { Invoice, Party, Product, SpecialRate, User } from '../types';
import { db, auth } from './firebase';
import { collection, doc, getDocs, setDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';

// Cache for reducing API calls
const cache: Record<string, { data: any; timestamp: number; promise?: Promise<any> }> = {};
const CACHE_DURATION = 1000 * 2; // 2 seconds cache

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const Cloud = {
  getScriptUrl: () => 'FIREBASE_ENABLED', 

  // Helper to handle cached requests
  _cachedFetch: async (key: string, fetcher: () => Promise<any>, force = false) => {
    const now = Date.now();
    
    // 1. Return pending promise if already fetching (Deduplication)
    if (cache[key]?.promise) return cache[key].promise;

    // 2. Return cached data if not force and not expired
    if (!force && cache[key] && (now - cache[key].timestamp < CACHE_DURATION)) {
      console.log(`[Cloud] Serving cached ${key}`);
      return cache[key].data;
    }

    // 3. Execute fetch
    const promise = fetcher().then(result => {
      cache[key] = { data: result, timestamp: Date.now() };
      return result;
    }).catch(err => {
      delete cache[key]?.promise;
      throw err;
    });

    cache[key] = { ...cache[key], promise };
    const result = await promise;
    delete cache[key]?.promise;
    return result;
  },

  clearAllData: async () => {
    console.warn("Wipe command blocked by security policy.");
    return true;
  },

  syncInvoice: async (invoice: Invoice) => {
    try {
      if (!auth.currentUser) return { success: false, error: "Not authenticated" };
      const ref = doc(db, 'invoices', invoice.id);
      await setDoc(ref, {
        ...invoice,
        userId: auth.currentUser.uid
      }, { merge: true });
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `invoices/${invoice.id}`);
      return { success: false, error: e.message };
    }
  },

  syncInvoicesBatch: async (invoices: Invoice[]) => {
    if (invoices.length === 0) return { success: true };
    try {
      if (!auth.currentUser) return { success: false, error: "Not authenticated" };
      const batch = writeBatch(db);
      for (const inv of invoices) {
        const ref = doc(db, 'invoices', inv.id);
        batch.set(ref, {
          ...inv,
          userId: auth.currentUser.uid
        }, { merge: true });
      }
      await batch.commit();
      return { success: true };
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'invoices batch');
      return { success: false, error: e.message };
    }
  },

  syncMasterData: async (parties: Party[], products: Product[], rates: SpecialRate[], users: User[]) => {
    if (!auth.currentUser) throw new Error("Not authenticated");
    const userId = auth.currentUser.uid;

    try {
      const batch = writeBatch(db);

      // 1. Sync Parties
      for (const p of parties) {
        const ref = doc(db, 'parties', p.id);
        const payload: any = {
           name: p.name || "",
           address: p.address || "",
           city: p.city || "",
           phone: p.phone || "",
           gst_number: p.gstNumber || "",
           userId: userId
        };
        // Optionals
        if (p.code) payload.code = p.code;
        if (p.aadharNumber) payload.aadharNumber = p.aadharNumber;
        if (p.panNumber) payload.panNumber = p.panNumber;
        if (p.email) payload.email = p.email;
        if (p.state) payload.state = p.state;
        if (p.pincode) payload.pincode = p.pincode;

        batch.set(ref, payload, { merge: true });
      }

      // 2. Sync Products
      for (const p of products) {
        const ref = doc(db, 'products', p.id);
        const payload: any = {
           name: p.name || "",
           code: p.code || "",
           standard_rate: p.standardRate || 0,
           unit: p.unit || "",
           userId: userId
        };
        if (p.hsn != null) payload.hsn = p.hsn;
        if (p.gstPercent != null) payload.gstPercent = p.gstPercent;
        if (p.qtyPerCase != null) payload.qtyPerCase = p.qtyPerCase;
        if (p.weight != null) payload.weight = p.weight;

        batch.set(ref, payload, { merge: true });
      }

      // 3. Sync Users
      // Usually users collection in DB
      for (const u of users) {
         // Create a composite id or use user email
         const ref = doc(db, 'app_users', u.username);
         batch.set(ref, {
           username: u.username,
           role: u.role || 'user',
           userId: userId
         }, { merge: true });
      }

      // 4. Sync Rates 
      const partyRateMap: Record<string, Record<string, number>> = {};
      rates.forEach(r => {
        if (!partyRateMap[r.partyId]) partyRateMap[r.partyId] = {};
        partyRateMap[r.partyId][r.productId] = r.rate;
      });

      for (const [partyId, ratesJson] of Object.entries(partyRateMap)) {
         const ref = doc(db, 'special_rates', partyId);
         batch.set(ref, {
           party_id: partyId,
           rates: ratesJson,
           userId: userId
         }, { merge: true });
      }

      await batch.commit();

    } catch (error: any) {
      console.error("[Cloud] Error syncing master data:", error);
      handleFirestoreError(error, OperationType.WRITE, 'master_data batch');
      throw new Error(`Master sync failed: ${error.message}`);
    }
  },

  // --- FETCH METHODS ---

  fetchData: async (type: 'PRODUCTS' | 'RATES' | 'PARTIES' | 'INVOICES' | 'USERS', force = false): Promise<any> => {
    return Cloud._cachedFetch(type, async () => {
      try {
        if (!auth.currentUser) return [];
        const userId = auth.currentUser.uid;

        if (type === 'PARTIES') {
          const q = query(collection(db, 'parties')); // Remove userId filter since admin should see everything, but rule checks it
          const snap = await getDocs(q);
          const results: any[] = [];
          snap.forEach(docSnap => {
             const p = docSnap.data();
             results.push({
               id: docSnap.id,
               name: p.name,
               code: p.code || '',
               address: p.address || '',
               city: p.city || '',
               phone: p.phone || '',
               gstNumber: p.gst_number || '',
               aadharNumber: p.aadharNumber || '',
               panNumber: p.panNumber || '',
               email: p.email || '',
               state: p.state || '',
               pincode: p.pincode || ''
             });
          });
          return results;
        }

        if (type === 'PRODUCTS') {
          const snap = await getDocs(query(collection(db, 'products')));
          const results: any[] = [];
          snap.forEach(docSnap => {
             const p = docSnap.data();
             results.push({
               id: docSnap.id,
               name: p.name,
               code: p.code,
               standardRate: Number(p.standard_rate),
               unit: p.unit,
               hsn: p.hsn,
               gstPercent: Number(p.gstPercent),
               qtyPerCase: p.qtyPerCase,
               weight: p.weight
             });
          });
          return results;
        }

        if (type === 'RATES') {
          const snap = await getDocs(query(collection(db, 'special_rates')));
          const flatRates: SpecialRate[] = [];
          snap.forEach(docSnap => {
            const row = docSnap.data();
            if (row.rates && typeof row.rates === 'object') {
              Object.entries(row.rates).forEach(([prodId, rate]) => {
                flatRates.push({
                  partyId: row.party_id,
                  productId: prodId,
                  rate: Number(rate)
                });
              });
            }
          });
          return flatRates;
        }
        return [];
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, type);
        return [];
      }
    }, force);
  },

  fetchUsers: async (force = false): Promise<User[]> => {
    return Cloud._cachedFetch('USERS', async () => {
      try {
        if (!auth.currentUser) return [];
        const snap = await getDocs(query(collection(db, 'app_users')));
        const results: User[] = [];
        snap.forEach(docSnap => {
           const data = docSnap.data();
           results.push({
             username: data.username,
             password: '', // We don't fetch or store passwords securely like this, but matching old UI. App should migrate to Auth.
             role: data.role || 'user'
           });
        });
        return results;
      } catch(err) {
        handleFirestoreError(err, OperationType.GET, 'app_users');
        return [];
      }
    }, force);
  },

  fetchInvoices: async (force = false): Promise<Invoice[]> => {
    return Cloud._cachedFetch('INVOICES', async () => {
      try {
        if (!auth.currentUser) return [];
        const snap = await getDocs(query(collection(db, 'invoices')));
        const results: any[] = [];
        snap.forEach(docSnap => {
           const inv = docSnap.data();
           results.push({
             id: docSnap.id,
             invoiceNumber: inv.invoiceNumber || '',
             partyId: inv.partyId,
             partyName: inv.partyName || 'Unknown',
             date: inv.date,
             items: Array.isArray(inv.items) ? inv.items : [],
             subTotal: Number(inv.subTotal) || 0,
             taxAmount: Number(inv.taxAmount) || 0,
             globalDiscount: Number(inv.globalDiscount) || 0,
             grandTotal: Number(inv.grandTotal) || 0,
             vehicleNumber: inv.vehicleNumber || '',
             poNumber: inv.poNumber || '',
             partyAddress: inv.partyAddress || '',
             partyGst: inv.partyGst || '',
             partyPan: inv.partyPan || '',
             partyAadhar: inv.partyAadhar || '',
             partyPhone: inv.partyPhone || '',
             totalWeight: inv.totalWeight || '',
             previousBalance: Number(inv.previousBalance) || 0,
             totalBalance: Number(inv.totalBalance) || 0,
             syncStatus: 'synced'
           });
        });
        // Sort after fetch since indexing might not be set up
        return results.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) as Invoice[];
      } catch(err) {
        handleFirestoreError(err, OperationType.GET, 'invoices');
        return [];
      }
    }, force);
  },

  testConnection: async () => {
    try {
      const snap = await getDocs(query(collection(db, 'parties')));
      return { success: true };
    } catch (e: any) {
      if (e.message.includes('offline')) {
         return { success: false, error: "The client is offline. Check your network or Firebase configuration." };
      }
      return { success: false, error: e.message || "Unknown Connection Error" };
    }
  }
};
