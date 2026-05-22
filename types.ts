
export interface Party {
  id: string;        // A: Serial No (Internal UUID)
  name: string;      // B: Name
  code?: string;     // New: Auto-generated Serial/Short Code (e.g. C-001)
  address: string;   // C: Address
  city: string;      // D: City (New)
  phone: string;     // E: Phone
  gstNumber: string; // F: GST (New)
  aadharNumber: string;// G: Aadhar (New)
  panNumber: string; // H: PAN (New)
  email?: string;    // kept as optional internal field
  state?: string;    // New: State
  pincode?: string;  // New: Pincode
}

export interface Product {
  id: string;
  name: string;
  code: string;
  standardRate: number;
  unit: string;
  hsn?: string;
  gstPercent?: number;
  qtyPerCase?: number;
  weight?: string; // New: Product weight
}

// The core mapping: Party + Product = Specific Rate
export interface SpecialRate {
  partyId: string;
  productId: string;
  rate: number;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  rate: number; // This is now the GROSS (Inclusive) Rate
  baseRate: number; // New: Rate before Tax
  total: number; // Total Inclusive Amount (Qty * Rate)
  hsn?: string;
  gstPercent?: number;
  weight?: string; // New: Row-level weight
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  partyId: string;
  partyName: string; 
  date: string;
  items: InvoiceItem[];
  subTotal: number;
  taxPercent: number;
  taxAmount: number;
  globalDiscount: number; // New: Discount on total invoice
  grandTotal: number;
  // New fields for the PDF format
  vehicleNumber?: string;
  poNumber?: string; // Reference No
  // Snapshot fields for Sheet Export "A to Z"
  partyAddress?: string;
  partyGst?: string;
  partyPan?: string;    // New Snapshot
  partyAadhar?: string; // New Snapshot
  partyPhone?: string;  // New Snapshot
  totalWeight?: string; // New: Manual weight entry
  // Ledger Fields
  previousBalance?: number;
  totalBalance?: number;
  showLedger?: boolean; // New: Toggle to show/hide ledger on print
  // Sync Status
  syncStatus?: 'synced' | 'pending' | 'failed';
  lastUpdated?: string;
}

export interface User {
  username: string;
  password: string;
  role?: string;
}

export interface Statement {
  id: string;
  partyId: string;
  partyName: string;
  date: string;
  previousBalance: number;
  selectedInvoiceIds: string[];
  totalAmount: number;
}

export type ViewState = 'billing' | 'history' | 'statement' | 'party_download' | 'logs' | 'ranking' | 'parties' | 'products' | 'rates' | 'users' | 'data' | 'more';
