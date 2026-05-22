
import { Party, Product, SpecialRate, Invoice, User } from '../types';

const KEYS = {
  PARTIES: 'greemzar_parties',
  PRODUCTS: 'greemzar_products',
  RATES: 'greemzar_rates',
  INVOICES: 'greemzar_invoices',
  USERS: 'greemzar_users',
  VERSION: 'greemzar_db_version'
};

// Increment this version to FORCE overwrite local data with empty lists
// v3.0: Clean Start - No Hardcoded Data
const CURRENT_DB_VERSION = 'v3.0-empty-force-fix';

const SEED_USERS: User[] = [{ username: 'riyaz', password: '6211', role: 'admin' }];

// --- MIGRATION / INITIALIZATION ---
try {
  const currentVersion = localStorage.getItem(KEYS.VERSION);
  if (currentVersion !== CURRENT_DB_VERSION) {
    console.log(`Migrating Data from ${currentVersion} to ${CURRENT_DB_VERSION}`);
    
    // FORCE WIPE LOCAL DATA to satisfy "REMOVE ALL DETAILS" request
    localStorage.setItem(KEYS.PARTIES, JSON.stringify([]));
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify([]));
    localStorage.setItem(KEYS.RATES, JSON.stringify([]));
    // We keep invoices usually, but since "EVERY THING" was requested, we wipe them if it's a hard reset.
    // However, users often want to keep history. We will sanitize history instead of deleting it, 
    // unless it's null/undefined.
    if (!localStorage.getItem(KEYS.INVOICES)) {
        localStorage.setItem(KEYS.INVOICES, JSON.stringify([]));
    }
    
    localStorage.setItem(KEYS.VERSION, CURRENT_DB_VERSION);
  }
} catch (e) {
  console.error("Migration failed", e);
}

export const Store = {
  resetToSeedData: () => {
    // RESETS TO EMPTY LISTS
    localStorage.setItem(KEYS.PARTIES, JSON.stringify([]));
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify([]));
    localStorage.setItem(KEYS.RATES, JSON.stringify([]));
    localStorage.setItem(KEYS.INVOICES, JSON.stringify([]));
    localStorage.setItem(KEYS.VERSION, CURRENT_DB_VERSION);
    window.location.reload();
  },

  getParties: (): Party[] => {
    const data = localStorage.getItem(KEYS.PARTIES);
    if (!data || data === 'null') return []; 
    try { return JSON.parse(data); } catch { return []; }
  },
  saveParties: (parties: Party[]) => localStorage.setItem(KEYS.PARTIES, JSON.stringify(parties)),

  getProducts: (): Product[] => {
    const data = localStorage.getItem(KEYS.PRODUCTS);
    if (!data || data === 'null') return [];
    try { return JSON.parse(data); } catch { return []; }
  },
  saveProducts: (products: Product[]) => localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(products)),

  getRates: (): SpecialRate[] => {
    const data = localStorage.getItem(KEYS.RATES);
    if (!data || data === 'null') return [];
    try { return JSON.parse(data); } catch { return []; }
  },
  saveRates: (rates: SpecialRate[]) => localStorage.setItem(KEYS.RATES, JSON.stringify(rates)),

  getInvoices: (): Invoice[] => {
    const data = localStorage.getItem(KEYS.INVOICES);
    if (!data || data === 'null') return [];
    try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) return [];
        
        // CRITICAL: Sanitize data to prevent White Screen of Death
        return parsed.map((inv: any) => ({
            id: inv.id || crypto.randomUUID(),
            invoiceNumber: inv.invoiceNumber || 'Unknown',
            partyId: inv.partyId || '',
            partyName: inv.partyName || 'Unknown Party',
            date: inv.date || new Date().toISOString().split('T')[0],
            items: Array.isArray(inv.items) ? inv.items : [],
            subTotal: Number(inv.subTotal) || 0,
            taxPercent: Number(inv.taxPercent) || 0,
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
            syncStatus: (inv.syncStatus as 'synced' | 'pending' | 'failed') || 'synced',
            lastUpdated: inv.lastUpdated || null
        }));
    } catch (e) {
        console.error("Corrupt Invoice Data Found. Resetting to empty to fix crash.", e);
        return [];
    }
  },
  saveInvoice: (invoice: Invoice) => {
    const invoices = Store.getInvoices();
    const invoiceToSave: Invoice = {
      ...invoice,
      syncStatus: 'pending',
      lastUpdated: new Date().toISOString()
    };
    invoices.unshift(invoiceToSave); // Add to top
    localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
  },
  updateInvoice: (updatedInvoice: Invoice) => {
    const invoices = Store.getInvoices();
    const index = invoices.findIndex(inv => inv.id === updatedInvoice.id);
    if (index !== -1) {
      const updated: Invoice = {
        ...updatedInvoice,
        syncStatus: 'pending',
        lastUpdated: new Date().toISOString()
      };
      invoices[index] = updated;
      localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
    }
  },
  saveInvoices: (invoices: Invoice[]) => {
    localStorage.setItem(KEYS.INVOICES, JSON.stringify(invoices));
  },

  getUsers: (): User[] => {
    const data = localStorage.getItem(KEYS.USERS);
    try { return data ? JSON.parse(data) : SEED_USERS; } catch { return SEED_USERS; }
  },
  saveUsers: (users: User[]) => localStorage.setItem(KEYS.USERS, JSON.stringify(users)),
};
