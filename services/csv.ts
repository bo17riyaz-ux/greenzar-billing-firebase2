
import { Party, Product, SpecialRate, Invoice, InvoiceItem } from '../types';

// Helper to escape CSV fields
const safe = (str: string | number | undefined) => {
  if (str === undefined || str === null) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

// --- PARSER ---
export const parseCSV = (text: string): string[][] => {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuote = false;
  let currentToken = '';
  
  for(let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i+1];
    
    if (char === '"') {
      if (inQuote && nextChar === '"') {
        currentToken += '"';
        i++; 
      } else {
        inQuote = !inQuote;
      }
    } else if (char === ',' && !inQuote) {
      row.push(currentToken.trim());
      currentToken = '';
    } else if ((char === '\n' || char === '\r') && !inQuote) {
      if (currentToken || row.length > 0) row.push(currentToken.trim());
      if (row.length > 0) result.push(row);
      row = [];
      currentToken = '';
      if (char === '\r' && nextChar === '\n') i++;
    } else {
      currentToken += char;
    }
  }
  if (currentToken || row.length > 0) {
    row.push(currentToken.trim());
    result.push(row);
  }
  return result;
};

// --- EXPORTERS ---

export const exportPartiesToCSV = (parties: Party[]) => {
  let csv = "ID,Code,Name,Address,City,Phone,GST,Aadhar,PAN\n";
  parties.forEach(p => {
    csv += `${safe(p.id)},${safe(p.code)},${safe(p.name)},${safe(p.address)},${safe(p.city)},${safe(p.phone)},${safe(p.gstNumber)},${safe(p.aadharNumber)},${safe(p.panNumber)}\n`;
  });
  return csv;
};

export const exportProductsToCSV = (products: Product[]) => {
  let csv = "ID,Name,Code,Standard Rate,Unit,Weight\n";
  products.forEach(p => {
    csv += `${safe(p.id)},${safe(p.name)},${safe(p.code)},${p.standardRate},${safe(p.unit)},${safe(p.weight)}\n`;
  });
  return csv;
};

// The Matrix Export: Rows=Products, Cols=Parties
export const exportRatesMatrixToCSV = (parties: Party[], products: Product[], rates: SpecialRate[]) => {
  // Header: Product Info, then each Party Name
  let csv = "Product ID,Product Name,Standard Rate";
  parties.forEach(p => {
    csv += `,${safe(p.name)}`; // Use Name for readability in Sheets
  });
  csv += "\n";

  // Rows
  products.forEach(prod => {
    csv += `${safe(prod.id)},${safe(prod.name)},${prod.standardRate}`;
    parties.forEach(party => {
      const rateObj = rates.find(r => r.partyId === party.id && r.productId === prod.id);
      const val = rateObj ? rateObj.rate : ''; 
      csv += `,${val}`;
    });
    csv += "\n";
  });
  
  return csv;
};

export const exportInvoicesToCSV = (invoices: Invoice[]) => {
  // Flat format for DB analysis: Invoice Header repeated for each Item
  let csv = "Invoice ID,Invoice Number,Date,Party Name,Tax Amount,Grand Total,Total Weight,Previous Balance,Total Due,Product Name,Quantity,Rate,Line Total,Item Weight\n";
  
  invoices.forEach(inv => {
    inv.items.forEach(item => {
      csv += `${safe(inv.id)},${safe(inv.invoiceNumber)},${inv.date},${safe(inv.partyName)},${inv.taxAmount},${inv.grandTotal},${safe(inv.totalWeight)},${inv.previousBalance || 0},${inv.totalBalance || 0},${safe(item.productName)},${item.quantity},${item.rate},${item.total},${safe(item.weight)}\n`;
    });
  });
  return csv;
};

// --- IMPORTERS ---

export const parsePartiesFromCSV = (csvText: string): Party[] => {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];
  // Old Format: A=ID, B=Name, C=Address, D=City, E=Phone, F=GST, G=Aadhar, H=PAN
  // New Format: A=ID, B=Code, C=Name, D=Address, E=City, F=Phone, G=GST, H=Aadhar, I=PAN
  
  // Detect format by header check
  const header = rows[0];
  const hasCode = header[1].toLowerCase() === 'code';

  if (hasCode) {
    return rows.slice(1).map(r => ({
        id: r[0] || crypto.randomUUID(), 
        code: r[1] || '',
        name: r[2],
        address: r[3] || '',
        city: r[4] || '',
        phone: r[5] || '',
        gstNumber: r[6] || '',
        aadharNumber: r[7] || '',
        panNumber: r[8] || ''
    })).filter(p => p.name);
  } else {
    // Fallback for old CSVs
    return rows.slice(1).map(r => ({
        id: r[0] || crypto.randomUUID(), 
        name: r[1],
        address: r[2] || '',
        city: r[3] || '',
        phone: r[4] || '',
        gstNumber: r[5] || '',
        aadharNumber: r[6] || '',
        panNumber: r[7] || ''
    })).filter(p => p.name);
  }
};

export const parseProductsFromCSV = (csvText: string): Product[] => {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];
  return rows.slice(1).map(r => ({
    id: r[0] || crypto.randomUUID(),
    name: r[1],
    code: r[2] || '',
    standardRate: parseFloat(r[3]) || 0,
    unit: r[4] || 'pcs',
    weight: r[5] || ''
  })).filter(p => p.name);
};

export const parseRatesMatrixFromCSV = (csvText: string, parties: Party[], products: Product[]): SpecialRate[] => {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const header = rows[0]; // Product ID, Product Name, Std Rate, Party1, Party2...
  
  // Map column index to Party ID
  const partyColMap: Record<number, string> = {};
  
  // Start from col 3 (0=ID, 1=Name, 2=Rate)
  for (let i = 3; i < header.length; i++) {
    const partyName = header[i];
    const party = parties.find(p => p.name.trim().toLowerCase() === partyName.trim().toLowerCase());
    if (party) {
      partyColMap[i] = party.id;
    }
  }

  const newRates: SpecialRate[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const productName = row[1];
    const productIdRaw = row[0];

    let product = products.find(p => p.id === productIdRaw);
    if (!product) product = products.find(p => p.name === productName);

    if (product) {
      Object.entries(partyColMap).forEach(([colIdx, partyId]) => {
        const rateVal = parseFloat(row[Number(colIdx)]);
        if (!isNaN(rateVal) && rateVal > 0) {
          newRates.push({
            partyId: partyId,
            productId: product!.id,
            rate: rateVal
          });
        }
      });
    }
  }

  return newRates;
};

export const parseInvoicesFromCSV = (csvText: string, parties: Party[], products: Product[]): Invoice[] => {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const groups: Record<string, string[][]> = {};
  
  rows.slice(1).forEach(row => {
    const invId = row[0];
    if (!invId) return; // Ignore empty rows
    if (!groups[invId]) groups[invId] = [];
    groups[invId].push(row);
  });

  const invoices: Invoice[] = [];

  Object.entries(groups).forEach(([invId, groupRows]) => {
    const first = groupRows[0];
    
    // Header Data
    const invoiceNumber = first[1] || '';
    const date = first[2] || new Date().toISOString().split('T')[0];
    const partyName = first[3] || 'Unknown';
    const taxAmount = parseFloat(first[4]) || 0;
    const grandTotal = parseFloat(first[5]) || 0;
    const totalWeight = first[6] || '';
    const previousBalance = parseFloat(first[7]) || 0;
    const totalBalance = parseFloat(first[8]) || 0;

    // Attempt to connect back to DB Party
    const matchedParty = parties.find(p => p.name.trim().toLowerCase() === partyName.trim().toLowerCase());
    const partyId = matchedParty ? matchedParty.id : crypto.randomUUID();

    const items: InvoiceItem[] = groupRows.map(row => {
       const pName = row[9] || 'Unknown Product';
       const qty = parseFloat(row[10]) || 1;
       const rate = parseFloat(row[11]) || 0;
       const lineTotal = parseFloat(row[12]) || 0;
       const iWeight = row[13] || '';

       const matchedProduct = products.find(p => p.name.trim().toLowerCase() === pName.trim().toLowerCase());
       
       return {
         id: crypto.randomUUID(),
         productId: matchedProduct ? matchedProduct.id : crypto.randomUUID(),
         productName: pName,
         quantity: qty,
         rate: rate,
         baseRate: rate,
         total: lineTotal,
         weight: iWeight
       };
    });

    const subTotal = items.reduce((sum, item) => sum + item.total, 0);

    invoices.push({
      id: invId,
      invoiceNumber,
      date,
      partyId,
      partyName,
      partyAddress: matchedParty?.address || '',
      partyPhone: matchedParty?.phone || '',
      partyGst: matchedParty?.gstNumber || '',
      items,
      subTotal: subTotal,
      taxPercent: 0, 
      taxAmount: taxAmount,
      globalDiscount: 0, 
      grandTotal: grandTotal,
      totalWeight: totalWeight,
      previousBalance: previousBalance,
      totalBalance: totalBalance,
      syncStatus: 'pending'
    });
  });

  return invoices;
};
