
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Party, Product, SpecialRate, Invoice, InvoiceItem } from '../types';
import { ShoppingCart, User, Plus, Trash2, Save, Scan, Zap, FileText, CloudLightning, Loader2, Printer, X, CreditCard, Box, MapPin, Phone, Calculator, ChevronDown, ChevronUp, Edit3, Copy, Download, FileSpreadsheet, Search, Tag, Sparkles, Info, ArrowUpCircle } from 'lucide-react';
import { formatWeight, getLocalDateString } from '../utils';
import { Store } from '../services/store';
import { Cloud } from '../services/cloud';
import { InvoiceTemplate } from './InvoiceTemplate';
import { exportInvoicesToCSV } from '../services/csv';

interface Props {
  parties: Party[];
  setParties: (p: Party[]) => void;
  products: Product[];
  specialRates: SpecialRate[];
  setSpecialRates: (rates: SpecialRate[]) => void; 
  onInvoiceSaved: () => void;
  initialData?: Invoice | null; 
}

// Defined Vehicle Options
const VEHICLE_OPTIONS = [
  "WB894170", 
  "WB25K1322", 
  "WB25K2982", 
  "WB25L6365", 
  "WB25K1326", 
  "WB25K1341", 
  "WB47J7275", 
  "WB35H3960"
];

export const Billing: React.FC<Props> = ({ parties, setParties, products, specialRates, setSpecialRates, onInvoiceSaved, initialData }) => {
  // Helper to get draft from localStorage
  const getDraft = useCallback(() => {
    const draft = localStorage.getItem('gfb_billing_draft');
    if (draft) {
      try {
        return JSON.parse(draft);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, []);

  const draft = getDraft();

  const [selectedPartyId, setSelectedPartyId] = useState<string>(() => {
    if (initialData) return initialData.partyId;
    return draft?.selectedPartyId || '';
  });
  
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (initialData) {
      return initialData.items.map(item => {
        let pId = item.productId;
        if (!pId && products.length > 0) {
            const found = products.find(p => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase());
            if (found) pId = found.id;
        }
        return {
          ...item,
          productId: pId || '',
          quantity: isNaN(item.quantity) ? 0 : item.quantity,
          rate: isNaN(item.rate) ? 0 : item.rate,
          total: isNaN(item.total) ? 0 : item.total,
          gstPercent: isNaN(item.gstPercent || 0) ? 0 : item.gstPercent
        };
      });
    }
    return draft?.items || [];
  });
  
  const [invoiceDate, setInvoiceDate] = useState(() => {
    if (initialData) return initialData.date;
    return getLocalDateString();
  });
  
  const [customInvoiceNo, setCustomInvoiceNo] = useState(() => {
    if (initialData) return initialData.invoiceNumber;
    return draft?.customInvoiceNo || '';
  });
  
  const [refNo, setRefNo] = useState(() => {
    if (initialData) return initialData.poNumber || '';
    return draft?.refNo || '';
  }); 
  
  const [globalDiscount, setGlobalDiscount] = useState<number>(() => {
    if (initialData) return initialData.globalDiscount || 0;
    return draft?.globalDiscount || 0;
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [hasCloudConfig, setHasCloudConfig] = useState(false);

  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  
  const [lastInvoice, setLastInvoice] = useState<Invoice | null>(null);

  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState(''); 
  const [newPartyCode, setNewPartyCode] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyCity, setNewPartyCity] = useState('');
  const [newPartyGst, setNewPartyGst] = useState('');
  const [newPartyAadhar, setNewPartyAadhar] = useState('');
  const [newPartyPan, setNewPartyPan] = useState('');
  const [newPartyEmail, setNewPartyEmail] = useState('');
  const [newPartyState, setNewPartyState] = useState('');
  const [newPartyPincode, setNewPartyPincode] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done'>('idle');

  // Helper to generate code for quick add
  const generateSmartCode = (name: string) => {
    if (!name || name.trim().length === 0) return '';
    const cleanName = name.trim().toUpperCase();
    const firstChar = cleanName.charAt(0);
    const lastChar = cleanName.charAt(cleanName.length - 1);
    const prefix = `${firstChar}${lastChar}`.replace(/[^A-Z0-9]/g, 'X'); 
    const existingCodes = parties
        .filter(p => p.code && p.code.startsWith(prefix))
        .map(p => p.code!);
    let maxNum = 0;
    existingCodes.forEach(code => {
        const numPartStr = code.substring(prefix.length);
        const numPart = parseInt(numPartStr);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
    });
    return `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
  };

  const handleNewPartyNameChange = (val: string) => {
    setNewPartyName(val);
    if (val.trim()) {
      setNewPartyCode(generateSmartCode(val));
    } else {
      setNewPartyCode('');
    }
  };

  // Helper state for showing active rates list
  const [showActiveRates, setShowActiveRates] = useState(false);

  const [partySearch, setPartySearch] = useState(() => {
    if (initialData) {
        const p = parties.find(party => party.id === initialData.partyId);
        return p ? p.name : initialData.partyName;
    }
    return draft?.partySearch || '';
  });
  
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);
  const [partyHighlightIndex, setPartyHighlightIndex] = useState(0);

  const [vehicleNo, setVehicleNo] = useState(() => {
    if (initialData) return initialData.vehicleNumber || '';
    return draft?.vehicleNo || '';
  });
  
  const [totalWeight, setTotalWeight] = useState(() => {
    if (initialData) return initialData.totalWeight || '';
    return draft?.totalWeight || '';
  });

  const [isManualBalance, setIsManualBalance] = useState(() => {
    return draft?.isManualBalance || false;
  });
  
  const [manualBalance, setManualBalance] = useState<number>(() => {
    if (initialData) return initialData.previousBalance || 0;
    return draft?.manualBalance || 0;
  });
  
  const [showLedgerOnBill, setShowLedgerOnBill] = useState<boolean>(() => {
    if (initialData && initialData.showLedger !== undefined) return initialData.showLedger;
    return draft?.showLedgerOnBill ?? false;
  });

  // AUTO-CALCULATE TOTAL WEIGHT
  useEffect(() => {
    const total = items.reduce((sum, item) => {
      if (!item.weight) return sum;
      const weightNum = parseFloat(item.weight.replace(/[^0-9.]/g, ''));
      if (isNaN(weightNum)) return sum;
      return sum + (weightNum * item.quantity);
    }, 0);
    
    if (total > 0) {
      setTotalWeight(total.toFixed(2)); // Store as numeric string
    } else {
      setTotalWeight('');
    }
  }, [items]);

  const [showVehicleSuggestions, setShowVehicleSuggestions] = useState(false);
  const [vehicleHighlightIndex, setVehicleHighlightIndex] = useState(0);

  const [currentProductId, setCurrentProductId] = useState('');
  const [productSearch, setProductSearch] = useState(''); 
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [productHighlightIndex, setProductHighlightIndex] = useState(0);

  const [currentQty, setCurrentQty] = useState(0);
  const [currentRate, setCurrentRate] = useState(0); 
  const [currentWeight, setCurrentWeight] = useState('');
  
  const [stdRate, setStdRate] = useState(0);

  const [rateType, setRateType] = useState<'standard' | 'special' | 'manual'>('standard');

  const partyInputRef = useRef<HTMLInputElement>(null);
  const invoiceNoInputRef = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const totalWeightInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const weightItemInputRef = useRef<HTMLInputElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const printBtnRef = useRef<HTMLButtonElement>(null);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (isPreviewOpen && lastInvoice) {
      const timer = setTimeout(() => {
        window.print();
      }, 1500); 
      return () => clearTimeout(timer);
    }
  }, [isPreviewOpen, lastInvoice]);

  useEffect(() => {
    setHasCloudConfig(!!Cloud.getScriptUrl());
  }, []);

  useEffect(() => {
    if (initialData) {
      setSelectedPartyId(initialData.partyId);
      
      const p = parties.find(party => party.id === initialData.partyId);
      if(p) setPartySearch(p.name);
      else setPartySearch(initialData.partyName);

      const cleanItems = initialData.items.map(item => {
        let pId = item.productId;
        if (!pId && products.length > 0) {
            const found = products.find(p => p.name.trim().toLowerCase() === item.productName.trim().toLowerCase());
            if (found) pId = found.id;
        }

        return {
          ...item,
          productId: pId || '',
          quantity: isNaN(item.quantity) ? 0 : item.quantity,
          rate: isNaN(item.rate) ? 0 : item.rate,
          total: isNaN(item.total) ? 0 : item.total,
          gstPercent: isNaN(item.gstPercent || 0) ? 0 : item.gstPercent
        };
      });
      
      setItems(cleanItems);
      setInvoiceDate(initialData.date);
      setCustomInvoiceNo(initialData.invoiceNumber);
      setVehicleNo(initialData.vehicleNumber || '');
      setRefNo(initialData.poNumber || '');
      setGlobalDiscount(initialData.globalDiscount || 0);
    }
    setIsInitialLoad(false);
  }, [initialData, products]);

  // Save draft to localStorage
  useEffect(() => {
    if (!initialData && !isInitialLoad) {
      const draft = {
        selectedPartyId,
        partySearch,
        items,
        invoiceDate,
        customInvoiceNo,
        vehicleNo,
        totalWeight,
        isManualBalance,
        manualBalance,
        showLedgerOnBill,
        refNo,
        globalDiscount
      };
      localStorage.setItem('gfb_billing_draft', JSON.stringify(draft));
    }
  }, [selectedPartyId, partySearch, items, invoiceDate, customInvoiceNo, vehicleNo, totalWeight, isManualBalance, manualBalance, showLedgerOnBill, refNo, globalDiscount, initialData, isInitialLoad]);

  useEffect(() => {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQty > 0) {
      setRefNo(totalQty.toString());
    } else {
      setRefNo('');
    }
  }, [items]);
  
  const filteredParties = useMemo(() => parties.filter(p => 
      p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(partySearch.toLowerCase()))
  ), [parties, partySearch]);

  const filteredVehicles = useMemo(() => VEHICLE_OPTIONS.filter(v => 
    v.toLowerCase().includes(vehicleNo.toLowerCase())
  ), [vehicleNo]);

  // Filter AND Sort Products (Special Rates first)
  const filteredProducts = useMemo(() => products
    .filter(p => {
      const terms = productSearch.toLowerCase().split(' ').filter(t => t);
      const pName = p.name.toLowerCase();
      return terms.every(term => pName.includes(term));
    })
    .sort((a, b) => {
        // If a party is selected, show items with special rates first
        if (!selectedPartyId) return 0;
        
        const hasSpecialA = specialRates.some(r => r.partyId === selectedPartyId && r.productId === a.id);
        const hasSpecialB = specialRates.some(r => r.partyId === selectedPartyId && r.productId === b.id);
        
        if (hasSpecialA && !hasSpecialB) return -1;
        if (!hasSpecialA && hasSpecialB) return 1;
        return 0;
    }), [products, productSearch, selectedPartyId, specialRates]);
    
  // Get active special rates for current party
  const currentPartySpecialRates = specialRates.filter(r => r.partyId === selectedPartyId);

  // --- ROBUST PRICING ENGINE ---
  useEffect(() => {
    if (!currentProductId) {
        setStdRate(0);
        setCurrentRate(0);
        return;
    }

    const product = products.find(p => p.id === currentProductId);
    if (!product) return;

    // 1. Get Standard Rate
    const standard = product.standardRate;
    setStdRate(standard);

    // 2. Check for Special Rate
    let finalRate = standard;
    let type: 'standard' | 'special' = 'standard';

    if (selectedPartyId) {
        const special = specialRates.find(r => r.partyId === selectedPartyId && r.productId === currentProductId);
        if (special) {
            finalRate = special.rate;
            type = 'special';
        }
    }

    // 3. Apply
    setCurrentRate(finalRate);
    setRateType(type);

  }, [currentProductId, selectedPartyId, products, specialRates]);

  // --- KEYBOARD HANDLERS ---
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === 'Insert') {
        e.preventDefault();
        if (isPreviewOpen) {
          handlePrint();
        } else {
          setShowSaveConfirm(true);
        }
      }
      if (isPreviewOpen && (e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isPreviewOpen, items, selectedPartyId]); 

  const handleGenericKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  const handlePartyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPartyHighlightIndex(prev => Math.min(prev + 1, filteredParties.length - 1));
        setShowPartySuggestions(true);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPartyHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (showPartySuggestions && filteredParties.length > 0) {
            selectParty(filteredParties[partyHighlightIndex]);
        } else {
            const exactMatch = filteredParties.find(p => p.name.toLowerCase() === partySearch.toLowerCase());
            if (exactMatch) selectParty(exactMatch);
            else invoiceNoInputRef.current?.focus(); 
        }
    } else if (e.key === 'Escape') {
        setShowPartySuggestions(false);
    }
  };

  const handleVehicleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setVehicleHighlightIndex(prev => Math.min(prev + 1, filteredVehicles.length - 1));
      setShowVehicleSuggestions(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setVehicleHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showVehicleSuggestions && filteredVehicles.length > 0) {
        setVehicleNo(filteredVehicles[vehicleHighlightIndex]);
      }
      setShowVehicleSuggestions(false);
      productInputRef.current?.focus();
    } else if (e.key === 'Escape') {
      setShowVehicleSuggestions(false);
    }
  };

  const handleProductKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setProductHighlightIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
      setShowProductSuggestions(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setProductHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showProductSuggestions && filteredProducts.length > 0) {
        selectProduct(filteredProducts[productHighlightIndex]);
      } else {
         if (currentProductId) qtyInputRef.current?.focus();
      }
    } else if (e.key === 'Escape') {
      setShowProductSuggestions(false);
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
       e.preventDefault();
       rateInputRef.current?.focus();
    }
  };

  const handleRateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem(e);
    } else if (e.key.toLowerCase() === 'm') {
      if (rateType === 'manual' && selectedPartyId && currentProductId) {
        e.preventDefault();
        saveManualRateAsSpecial();
      }
    }
  };

  const handleWeightKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem(e);
    }
  };

  const selectParty = (p: Party) => {
      setSelectedPartyId(p.id);
      setPartySearch(p.name);
      setShowPartySuggestions(false);
      invoiceNoInputRef.current?.focus();
  };

  const selectProduct = (p: Product) => {
    setProductSearch(p.name);
    setCurrentProductId(p.id);
    setCurrentWeight(p.weight || '');
    setShowProductSuggestions(false);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const handleProductSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProductSearch(e.target.value);
    setCurrentProductId(''); 
    setProductHighlightIndex(0);
    setShowProductSuggestions(true);
  };

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newPartyName.trim() || saveStatus === 'saving') return;
    
    setSaveStatus('saving');
    try {
      const newParty: Party = {
        id: crypto.randomUUID(),
        name: newPartyName.trim(),
        code: newPartyCode.trim() || generateSmartCode(newPartyName.trim()),
        phone: newPartyPhone.trim(), 
        address: newPartyAddress.trim(),
        city: newPartyCity.trim(),
        gstNumber: newPartyGst.trim(),
        aadharNumber: newPartyAadhar.trim(),
        panNumber: newPartyPan.trim(),
        email: newPartyEmail.trim(),
        state: newPartyState.trim(),
        pincode: newPartyPincode.trim()
      };
      
      const updatedParties = [...parties, newParty];
      setParties(updatedParties);
      Store.saveParties(updatedParties);
      
      // Attempt immediate sync to ensure foreign key constraint won't fail down the line
      await Cloud.syncMasterData(updatedParties, Store.getProducts(), Store.getRates(), Store.getUsers());
      
      setSaveStatus('done');
      setSelectedPartyId(newParty.id); 
      setPartySearch(newParty.name);
      
      setTimeout(() => {
        // Reset all fields
        setNewPartyName('');
        setNewPartyPhone('');
        setNewPartyCode('');
        setNewPartyAddress('');
        setNewPartyCity('');
        setNewPartyGst('');
        setNewPartyAadhar('');
        setNewPartyPan('');
        setNewPartyEmail('');
        setNewPartyState('');
        setNewPartyPincode('');
        setIsPartyModalOpen(false);
        setSaveStatus('idle');
        invoiceNoInputRef.current?.focus();
      }, 1000); // show Done for 1s
    } catch (error) {
      console.error("[Billing] Party creation failed:", error);
      alert("Failed to save party. Please try again.");
      setSaveStatus('idle');
    }
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProductId || currentQty <= 0) return;
    const product = products.find(p => p.id === currentProductId);
    if (!product) return;
    
    const gstPercent = product.gstPercent || 0;
    const inclusiveRate = currentRate;
    const baseRate = inclusiveRate / (1 + (gstPercent / 100));
    const grossTotal = currentQty * inclusiveRate; 

    const newItem: InvoiceItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      quantity: currentQty,
      rate: inclusiveRate,
      baseRate: baseRate,  
      total: grossTotal,   
      hsn: product.hsn,
      gstPercent: gstPercent,
      weight: currentWeight
    };
    
    setItems([...items, newItem]);
    
    setProductSearch('');
    setCurrentProductId('');
    setCurrentQty(0); 
    setCurrentRate(0);
    setCurrentWeight('');
    setRateType('standard');
    productInputRef.current?.focus();
  };
  
  // NEW FEATURE: Save the manually entered rate as a special rate for this party
  const saveManualRateAsSpecial = () => {
    if (!selectedPartyId || !currentProductId) return;
    
    // 1. Remove existing rate for this product/party combo (if any)
    const otherRates = specialRates.filter(r => !(r.partyId === selectedPartyId && r.productId === currentProductId));
    
    // 2. Add new rate
    const newRate: SpecialRate = {
        partyId: selectedPartyId,
        productId: currentProductId,
        rate: currentRate
    };
    
    setSpecialRates([...otherRates, newRate]);
    setRateType('special'); // UI feedback: now it's special
  };

  const updateItem = (id: string, updates: Partial<InvoiceItem>) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };
      
      // Recalculate totals if qty or rate changed
      if (updates.quantity !== undefined || updates.rate !== undefined) {
        const qty = updated.quantity;
        const rate = updated.rate;
        const gst = updated.gstPercent || 0;
        updated.total = qty * rate;
        updated.baseRate = rate / (1 + (gst / 100));
      }
      
      return updated;
    }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleSaveInvoice = useCallback(async () => {
    if (!selectedPartyId || items.length === 0) return;
    
    setIsSaving(true);
    setShowSaveConfirm(false);

    const party = parties.find(p => p.id === selectedPartyId);

    const subTotal = items.reduce((sum, item) => sum + item.total, 0);
    
    const taxAmount = items.reduce((sum, item) => {
       const taxable = item.total / (1 + (item.gstPercent || 0)/100);
       return sum + (item.total - taxable);
    }, 0);

    const grandTotal = Math.round(subTotal - globalDiscount);

    const savedPhone = (party && party.phone) ? party.phone : (initialData?.partyPhone || '');

    // Calculate Ledger Balance
    let previousBalance = 0;
    if (isManualBalance) {
      previousBalance = manualBalance;
    } else {
      const allInvoices = Store.getInvoices();
      const partyInvoices = allInvoices.filter(i => i.partyId === selectedPartyId && i.id !== (initialData?.id || ''));
      previousBalance = partyInvoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
    }
    const totalBalance = previousBalance + grandTotal;

    const newInvoice: Invoice = {
      id: initialData ? initialData.id : crypto.randomUUID(), 
      invoiceNumber: customInvoiceNo,
      partyId: selectedPartyId,
      partyName: party?.name || 'Unknown Party',
      date: invoiceDate,
      items: items,
      subTotal: subTotal,
      taxPercent: 0,
      taxAmount: taxAmount,
      globalDiscount: globalDiscount,
      grandTotal: grandTotal,
      vehicleNumber: vehicleNo,
      poNumber: refNo,
      totalWeight: totalWeight,
      partyAddress: party ? [party.address, party.city, party.state, party.pincode].filter(Boolean).join(', ') : '',
      partyGst: party?.gstNumber || '',
      partyPan: party?.panNumber || '',
      partyAadhar: party?.aadharNumber || '',
      partyPhone: savedPhone,
      previousBalance: previousBalance,
      totalBalance: totalBalance,
      showLedger: showLedgerOnBill
    };

    try {
        if (initialData) {
            Store.updateInvoice(newInvoice);
        } else {
            Store.saveInvoice(newInvoice);
        }

        setLastInvoice(newInvoice);
        setIsPreviewOpen(true); 
        onInvoiceSaved(); 

        setItems([]);
        setSelectedPartyId('');
        setPartySearch('');
        setCustomInvoiceNo('');
        setVehicleNo('');
        setTotalWeight('');
        setRefNo('');
        setGlobalDiscount(0);
        setIsManualBalance(false);
        setManualBalance(0);
        setShowLedgerOnBill(false);
        setInvoiceDate(getLocalDateString());
        localStorage.removeItem('gfb_billing_draft');
        setTimeout(() => partyInputRef.current?.focus(), 100);

        // IMMEDIATE SYNC: Send to cloud right away when saved
        if (hasCloudConfig) {
             console.log("[Billing] Triggering immediate cloud sync for invoice:", newInvoice.invoiceNumber);
             try {
                 await Cloud.syncMasterData(Store.getParties(), Store.getProducts(), Store.getRates(), Store.getUsers());
             } catch (e) {
                 console.error("[Billing] Master data sync fail:", e);
             }
             Cloud.syncInvoice(newInvoice).then(res => {
                 if (res.success) {
                     // Check again to see if status updated locally
                     const logs = Store.getInvoices();
                     const idx = logs.findIndex(i => i.id === newInvoice.id);
                     if (idx !== -1) {
                         logs[idx].syncStatus = 'synced';
                         Store.saveInvoices(logs);
                     }
                 }
             }).catch(err => {
                 console.error("[Billing] Immediate sync failed, background manager will retry.", err);
             });
        }

    } catch (error) {
        console.error("Save failed", error);
        alert("Error saving locally.");
    } finally {
        setIsSaving(false);
    }
  }, [selectedPartyId, items, globalDiscount, customInvoiceNo, invoiceDate, vehicleNo, refNo, initialData, parties, onInvoiceSaved, hasCloudConfig]);

  // Global Keyboard Shortcuts for Modals
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (showSaveConfirm) {
          e.preventDefault();
          handleSaveInvoice();
        } else if (isPreviewOpen) {
          e.preventDefault();
          handlePrint();
        }
      } else if (e.key === 'Escape') {
        if (showSaveConfirm) setShowSaveConfirm(false);
        else if (isPreviewOpen) setIsPreviewOpen(false);
        else if (isPartyModalOpen) setIsPartyModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showSaveConfirm, isPreviewOpen, isPartyModalOpen, handleSaveInvoice, handlePrint]);

  // Focus confirm button when modal opens
  useEffect(() => {
    if (showSaveConfirm) {
      setTimeout(() => confirmBtnRef.current?.focus(), 100);
    }
  }, [showSaveConfirm]);

  // Focus print button when preview opens
  useEffect(() => {
    if (isPreviewOpen) {
      setTimeout(() => printBtnRef.current?.focus(), 100);
    }
  }, [isPreviewOpen]);

  return (
    <div className="flex h-full flex-col md:flex-row bg-slate-50">
      
      {/* Save Confirmation Modal */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-sky-600">
              <div className="w-12 h-12 bg-sky-50 rounded-full flex items-center justify-center">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Invoice?</h3>
                <p className="text-sm text-slate-500">Are you sure you want to save this bill?</p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Party:</span>
                <span className="font-bold text-slate-900">{parties.find(p => p.id === selectedPartyId)?.name}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Items:</span>
                <span className="font-bold text-slate-900">{items.length}</span>
              </div>
              <div className="flex justify-between text-lg font-black border-t border-slate-200 mt-2 pt-2">
                <span className="text-slate-900">Total:</span>
                <span className="text-sky-600">₹{Math.round(items.reduce((sum, item) => sum + item.total, 0) - globalDiscount).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                ref={confirmBtnRef}
                onClick={handleSaveInvoice}
                className="flex-1 px-4 py-2.5 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 shadow-lg shadow-sky-100 transition-all active:scale-95"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT: Billing Form */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
           <div>
             <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               {initialData ? <Edit3 size={20} className="text-orange-500"/> : <FileText size={20} className="text-sky-600" />} 
               {initialData ? 'Edit Invoice' : 'New Invoice'}
             </h2>
             <div className="text-xs text-slate-400 font-mono mt-0.5">{invoiceDate} • {customInvoiceNo}</div>
           </div>
           
           <div className="flex items-center gap-2">
              <div className="text-right mr-2 hidden md:block">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Amount</div>
                  <div className="text-xl font-black text-slate-800">
                    ₹{Math.round(items.reduce((sum, item) => sum + item.total, 0) - globalDiscount).toLocaleString('en-IN')}
                  </div>
              </div>
              <button 
                onClick={() => setShowSaveConfirm(true)}
                disabled={isSaving || !selectedPartyId || items.length === 0}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-slate-200 transition-all active:scale-95"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                <span>{initialData ? 'Update' : 'Save'}</span>
              </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
           
           {/* Section 1: Party Selection */}
           <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">BILL TO</label>
                 <button onClick={() => setIsPartyModalOpen(true)} className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-1">
                   <Plus size={10} /> New Party
                 </button>
              </div>
              
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    ref={partyInputRef}
                    type="text" 
                    value={partySearch}
                    onChange={(e) => {
                        setPartySearch(e.target.value);
                        setSelectedPartyId(''); // Reset selection if typing
                        setPartyHighlightIndex(0);
                        setShowPartySuggestions(true);
                    }}
                    onFocus={() => setShowPartySuggestions(true)}
                    onBlur={() => setTimeout(() => setShowPartySuggestions(false), 200)}
                    onKeyDown={handlePartyKeyDown}
                    placeholder="Type party name or code..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-semibold text-slate-900 bg-white shadow-sm"
                  />
                  
                  {/* Party Suggestions */}
                  {showPartySuggestions && filteredParties.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {filteredParties.map((p, idx) => (
                          <div 
                            key={p.id}
                            className={`px-4 py-2 text-sm cursor-pointer border-b border-slate-50 last:border-0 hover:bg-sky-50 ${idx === partyHighlightIndex ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-800'}`}
                            onMouseDown={() => selectParty(p)}
                          >
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                   {p.code && <span className="text-[10px] font-mono bg-slate-100 px-1 rounded text-slate-500 border border-slate-200">{p.code}</span>}
                                   {p.name}
                                </span>
                                <span className="text-xs text-slate-400">{p.city}</span>
                            </div>
                            {/* HELPER TO SEE PHONE */}
                            {p.phone && <div className="text-xs text-slate-400 flex items-center gap-1"><Phone size={10}/> {p.phone}</div>}
                          </div>
                        ))}
                    </div>
                  )}
              </div>

              <AnimatePresence mode="wait">
                {selectedPartyId && (
                   <motion.div 
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     exit={{ opacity: 0, height: 0 }}
                     className="mt-4 pt-2 overflow-hidden"
                   >
                      {(() => {
                          const p = parties.find(party => party.id === selectedPartyId);
                          return p ? (
                              <div>
                                  <h3 className="text-xl font-black text-slate-900 uppercase mb-2 leading-none flex items-center gap-2">
                                      {p.name}
                                      {p.code && <span className="text-sm font-normal text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-full">{p.code}</span>}
                                  </h3>
                                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-slate-500 uppercase mb-3 items-center">
                                     <div className="flex items-center gap-1.5 text-slate-700">
                                        <MapPin size={14} className="text-red-500" fill="currentColor" fillOpacity={0.2} />
                                        <span>{p.address ? `${p.address}, ${p.city}` : 'NO ADDRESS'}</span>
                                     </div>
                                     <div className="flex items-center gap-1.5 text-slate-700">
                                        <Phone size={14} className="text-red-500" fill="currentColor" fillOpacity={0.2} />
                                        <span>{p.phone || 'NO PHONE'}</span>
                                     </div>
                                  </div>
                                  
                                  {/* VISUAL AID: Special Rates Summary */}
                                  {currentPartySpecialRates.length > 0 && (
                                     <div className="mb-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                        <div 
                                          className="flex justify-between items-center cursor-pointer"
                                          onClick={() => setShowActiveRates(!showActiveRates)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Sparkles size={14} className="text-emerald-500" />
                                                <span className="text-xs font-bold text-emerald-800 uppercase">
                                                    {currentPartySpecialRates.length} Special Prices Configured
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-emerald-600 font-bold hover:underline">
                                                {showActiveRates ? 'Hide List' : 'Show List'}
                                            </div>
                                        </div>
                                        
                                        <AnimatePresence>
                                          {showActiveRates && (
                                              <motion.div 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1"
                                              >
                                                  {currentPartySpecialRates.map(r => {
                                                      const prod = products.find(p => p.id === r.productId);
                                                      return prod ? (
                                                          <div key={r.productId} className="flex justify-between items-center text-[10px] bg-white border border-emerald-100 rounded px-2 py-1 shadow-sm">
                                                              <span className="font-medium text-slate-700 truncate">{prod.name}</span>
                                                              <div className="flex items-center gap-1">
                                                                  <span className="text-slate-400 line-through">₹{prod.standardRate}</span>
                                                                  <span className="font-bold text-emerald-600">₹{r.rate}</span>
                                                              </div>
                                                          </div>
                                                      ) : null;
                                                  })}
                                              </motion.div>
                                          )}
                                        </AnimatePresence>
                                     </div>
                                  )}

                                  <div className="flex flex-wrap gap-2">
                                      <div className="border border-slate-200 bg-white px-2 py-1 rounded flex items-center gap-2 shadow-sm">
                                          <span className="text-[10px] font-bold text-slate-400">GST</span>
                                          <span className="text-xs font-bold text-slate-900 uppercase">{p.gstNumber || '-'}</span>
                                      </div>
                                      <div className="border border-slate-200 bg-white px-2 py-1 rounded flex items-center gap-2 shadow-sm">
                                          <span className="text-[10px] font-bold text-slate-400">PAN</span>
                                          <span className="text-xs font-bold text-slate-900 uppercase">{p.panNumber || '-'}</span>
                                      </div>
                                  </div>
                              </div>
                          ) : null;
                      })()}
                   </motion.div>
                )}
              </AnimatePresence>
           </div>

           {/* Section 2: Invoice Details */}
           <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice No</label>
                 <div className="relative">
                    <input 
                      ref={invoiceNoInputRef}
                      type="text" 
                      value={customInvoiceNo}
                      onChange={(e) => setCustomInvoiceNo(e.target.value)}
                      onKeyDown={(e) => handleGenericKeyDown(e, vehicleInputRef)}
                      className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-mono text-sm font-bold text-slate-700 bg-white"
                    />
                 </div>
              </div>
              <div className="md:col-span-3">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                 <input 
                    type="date" 
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-medium text-slate-700 bg-white"
                 />
              </div>
              <div className="md:col-span-3">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vehicle No</label>
                 <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><CreditCard size={14} /></div>
                    <input 
                      ref={vehicleInputRef}
                      type="text" 
                      value={vehicleNo}
                      onChange={(e) => {
                         setVehicleNo(e.target.value);
                         setShowVehicleSuggestions(true);
                      }}
                      onFocus={() => setShowVehicleSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowVehicleSuggestions(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !showVehicleSuggestions) {
                            e.preventDefault();
                            totalWeightInputRef.current?.focus();
                        } else {
                            handleVehicleKeyDown(e);
                        }
                      }}
                      placeholder="Vehicle..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-medium uppercase bg-white"
                    />
                    {/* Vehicle Suggestions */}
                    {showVehicleSuggestions && filteredVehicles.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                        {filteredVehicles.map((v, idx) => (
                          <div 
                            key={v}
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-sky-50 ${idx === vehicleHighlightIndex ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-700'}`}
                            onMouseDown={() => {
                              setVehicleNo(v);
                              productInputRef.current?.focus();
                            }}
                          >
                            {v}
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
              </div>
              <div className="md:col-span-3">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Qty (Ref)</label>
                 <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Box size={14} /></div>
                    <input 
                      type="text" 
                      value={refNo}
                      onChange={(e) => setRefNo(e.target.value)}
                      placeholder="Auto"
                      readOnly
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-medium"
                    />
                 </div>
              </div>
              <div className="md:col-span-3">
                 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Weight</label>
                 <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Tag size={14} /></div>
                    <input 
                      ref={totalWeightInputRef}
                      type="text" 
                      value={formatWeight(totalWeight)}
                      readOnly
                      placeholder="Weight..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold uppercase"
                    />
                 </div>
              </div>
              <div className="md:col-span-6 border-l md:pl-4 border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Ledger Adjustment</label>
                        <label className="flex items-center gap-1 cursor-pointer" title="Show Ledger on Print">
                          <input 
                            type="checkbox" 
                            checked={showLedgerOnBill} 
                            onChange={(e) => setShowLedgerOnBill(e.target.checked)}
                            className="w-3 h-3 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                          />
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Print</span>
                        </label>
                      </div>
                      <button 
                        onClick={() => {
                          if (!isManualBalance) {
                            const calculated = Store.getInvoices()
                              .filter(i => i.partyId === selectedPartyId && i.id !== (initialData?.id || ''))
                              .reduce((sum, i) => sum + (i.grandTotal || 0), 0);
                            setManualBalance(calculated);
                          }
                          setIsManualBalance(!isManualBalance);
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${isManualBalance ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                      >
                        {isManualBalance ? 'MANUAL MODE' : 'AUTO MODE'}
                      </button>
                  </div>
                  <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</div>
                      <input 
                        type="number" 
                        value={isManualBalance ? manualBalance : (
                           // Just a preview calculation for the UI
                           Store.getInvoices()
                             .filter(i => i.partyId === selectedPartyId && i.id !== (initialData?.id || ''))
                             .reduce((sum, i) => sum + (i.grandTotal || 0), 0)
                        )}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setManualBalance(val);
                          if (!isManualBalance) setIsManualBalance(true);
                        }}
                        onFocus={(e) => {
                           if (!isManualBalance) {
                             const calculated = Store.getInvoices()
                               .filter(i => i.partyId === selectedPartyId && i.id !== (initialData?.id || ''))
                               .reduce((sum, i) => sum + (i.grandTotal || 0), 0);
                             setManualBalance(calculated);
                             setIsManualBalance(true);
                           }
                           e.target.select();
                        }}
                        placeholder="Previous balance..."
                        className={`w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 outline-none text-sm font-bold transition-all ${
                          isManualBalance 
                            ? 'border-orange-300 bg-white text-orange-700 ring-2 ring-orange-50' 
                            : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 cursor-text'
                        }`}
                      />
                      {isManualBalance && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <Edit3 size={12} className="text-orange-400 animate-pulse" />
                        </div>
                      )}
                  </div>
              </div>
           </div>

           {/* Row 3: Product Entry (Combobox + Inputs) */}
           <div className={`p-4 rounded-xl border shadow-inner transition-colors ${rateType === 'special' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-sky-50/50 border-sky-100'}`}>
               <div className="flex justify-between items-center mb-2">
                 <label className={`block text-[10px] font-bold uppercase ${rateType === 'special' ? 'text-emerald-700' : 'text-sky-700'}`}>Add Items</label>
                 {rateType === 'special' && (
                    <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold shadow-sm flex items-center gap-1 animate-in fade-in">
                       <Sparkles size={10} fill="currentColor" /> SPECIAL PARTY RATE ACTIVE
                    </span>
                 )}
               </div>
               
               <div className="flex flex-col md:flex-row gap-3 items-end">
                   
                   {/* Product Combobox */}
                   <div className="flex-1 w-full relative">
                      <div className="text-[10px] font-bold text-slate-400 mb-1 ml-1">Product Name</div>
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            ref={productInputRef}
                            type="text" 
                            value={productSearch}
                            onChange={handleProductSearchChange}
                            onFocus={() => setShowProductSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                            onKeyDown={handleProductKeyDown}
                            placeholder="Type product name..."
                            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-semibold text-slate-900 bg-white shadow-sm"
                          />
                          {/* Suggestions Dropdown */}
                          {showProductSuggestions && filteredProducts.length > 0 && (
                            <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                              {filteredProducts.map((p, idx) => {
                                // SHOW SPECIAL RATE IN DROPDOWN
                                const special = specialRates.find(r => r.partyId === selectedPartyId && r.productId === p.id);
                                return (
                                <div 
                                  key={p.id}
                                  className={`px-4 py-2 text-sm cursor-pointer border-b border-slate-50 last:border-0 hover:bg-sky-50 ${idx === productHighlightIndex ? 'bg-sky-50' : ''}`}
                                  onMouseDown={() => selectProduct(p)}
                                >
                                  <div className="font-bold text-slate-800">{p.name}</div>
                                  <div className="text-xs text-slate-500 flex justify-between mt-0.5">
                                     <div className="flex gap-2">
                                        <span>Code: {p.code}</span>
                                        {p.weight && (
                                          <span className="text-sky-600 font-medium">({formatWeight(p.weight)})</span>
                                        )}
                                     </div>
                                     <div className="flex items-center gap-2">
                                         {special ? (
                                             <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                                                Special Rate: ₹{special.rate}
                                             </span>
                                         ) : (
                                             <span className="font-mono text-sky-600 font-bold">₹{p.standardRate}</span>
                                         )}
                                     </div>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )}
                      </div>
                   </div>

                   {/* Qty */}
                   <div className="w-20">
                      <div className="text-[10px] font-bold text-slate-400 mb-1 ml-1 text-center">Qty</div>
                      <input 
                         ref={qtyInputRef}
                         type="number" 
                         value={currentQty || ''}
                         onChange={e => setCurrentQty(parseFloat(e.target.value) || 0)}
                         onFocus={(e) => e.target.select()}
                         onKeyDown={handleQtyKeyDown}
                         placeholder="0"
                         className="w-full px-2 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-center text-slate-900 bg-white shadow-sm"
                      />
                   </div>

                   {/* Rate */}
                   <div className="w-32 relative">
                      <div className="text-[10px] font-bold text-slate-400 mb-1 ml-1 text-center">Rate</div>
                      
                      {/* Rate Type Badge */}
                      <div className="absolute top-[-24px] left-0 w-full text-center">
                          {rateType === 'standard' && currentProductId && (
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
                                 Standard
                              </span>
                          )}
                          {rateType === 'manual' && (
                              <span className="text-[9px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">
                                 Manual
                              </span>
                          )}
                      </div>

                      <input 
                         ref={rateInputRef}
                         type="number" 
                         value={currentRate}
                         onChange={e => {
                             setCurrentRate(parseFloat(e.target.value) || 0);
                             setRateType('manual');
                         }}
                         onFocus={(e) => e.target.select()}
                         onKeyDown={handleRateKeyDown}
                         className={`w-full px-2 py-2.5 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-bold text-center shadow-sm transition-colors ${
                             rateType === 'special' ? 'border-emerald-400 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100' :
                             rateType === 'manual' ? 'border-orange-300 bg-orange-50 text-orange-800' : 
                             'border-slate-300 bg-white text-slate-900'
                         }`}
                      />
                      
                      {/* NEW: QUICK SAVE RATE BUTTON */}
                       {rateType === 'manual' && selectedPartyId && currentProductId && (
                          <button 
                            onClick={saveManualRateAsSpecial}
                            className="absolute -bottom-6 left-0 w-full text-[10px] font-bold text-sky-600 hover:text-sky-800 uppercase"
                          >
                            Save as Special
                          </button>
                       )}

                       {/* Comparison Helper (Only show if not manual to avoid overlap) */}
                       {rateType !== 'manual' && currentProductId && (
                           <div className="absolute top-[105%] left-0 w-full text-[9px] text-center text-slate-400 font-mono whitespace-nowrap">
                               Std: {stdRate} {rateType === 'special' ? `| Spl: ${currentRate}` : ''}
                           </div>
                       )}
                    </div>

                   {/* Add Button */}
                   <button 
                     ref={addBtnRef}
                     onClick={addItem}
                     disabled={!currentProductId || currentQty <= 0}
                     className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:bg-slate-300 text-white p-2.5 rounded-lg shadow-sm transition-colors mb-[1px]"
                   >
                     <Plus size={20} />
                   </button>
               </div>
           </div>

           {/* Items Table */}
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[200px] flex flex-col">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                    <th className="px-4 py-3 font-bold">#</th>
                    <th className="px-4 py-3 font-bold w-1/2">Item</th>
                    <th className="px-4 py-3 font-bold text-center">Qty</th>
                    <th className="px-4 py-3 font-bold text-right">Rate</th>
                    <th className="px-4 py-3 font-bold text-right">Total</th>
                    <th className="px-4 py-3 font-bold text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                   {items.map((item, index) => (
                     <tr key={item.id} className="hover:bg-slate-50 group transition-colors">
                       <td className="px-4 py-3 text-slate-400 font-mono text-xs">{index + 1}</td>
                       <td className="px-4 py-3">
                         <div className="font-semibold text-slate-800">{item.productName}</div>
                         <div className="text-[10px] text-slate-400 font-mono">
                           GST: {item.gstPercent}% | Base: {item.baseRate.toFixed(2)}
                         </div>
                       </td>
                       <td className="px-4 py-3 text-center bg-slate-50/50">
                          <input 
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                            onFocus={(e) => e.target.select()}
                            className="w-16 text-center font-bold text-slate-700 bg-transparent border-b border-slate-200 focus:border-sky-500 outline-none p-0"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input 
                            type="number"
                            value={item.rate || ''}
                            onChange={(e) => updateItem(item.id, { rate: parseFloat(e.target.value) || 0 })}
                            onFocus={(e) => e.target.select()}
                            className="w-20 text-right text-slate-600 font-mono bg-transparent border-b border-slate-200 focus:border-sky-500 outline-none p-0"
                          />
                        </td>
                       <td className="px-4 py-3 text-right font-bold text-slate-800">{item.total.toFixed(2)}</td>
                       <td className="px-4 py-3 text-center">
                          <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                             <Trash2 size={16} />
                          </button>
                       </td>
                     </tr>
                   ))}
                   {items.length === 0 && (
                     <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-300">
                           <div className="flex flex-col items-center gap-2">
                              <ShoppingCart size={40} className="text-slate-200" />
                              <span className="text-sm font-medium text-slate-400">Cart is empty</span>
                           </div>
                        </td>
                     </tr>
                   )}
                </tbody>
              </table>
              
              {/* Footer Totals */}
              <div className="mt-auto bg-slate-50 border-t border-slate-200 p-4">
                 <div className="flex justify-end gap-8 text-sm">
                    <div className="text-right">
                       <div className="text-slate-500 text-xs uppercase font-bold mb-1">Sub Total</div>
                       <div className="font-bold text-slate-800">₹{items.reduce((s, i) => s + i.total, 0).toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-slate-500 text-xs uppercase font-bold mb-1">Discount (₹)</div>
                        <input 
                            type="number" 
                            value={globalDiscount} 
                            onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                            className="w-20 text-right font-bold text-red-600 bg-transparent border-b border-red-200 focus:border-red-500 outline-none p-0"
                        />
                    </div>
                    <div className="text-right pl-6 border-l border-slate-200">
                       <div className="text-slate-500 text-xs uppercase font-bold mb-1">Grand Total</div>
                       <div className="font-black text-xl text-slate-900">₹{Math.round(items.reduce((s, i) => s + i.total, 0) - globalDiscount).toFixed(2)}</div>
                    </div>

                    {selectedPartyId && (
                      <div className="text-right pl-6 border-l border-slate-200">
                         <div className="text-slate-500 text-xs uppercase font-bold mb-1 text-sky-600">Total Outstanding</div>
                         <div className="font-black text-xl text-sky-600">
                           ₹{(
                             (isManualBalance ? manualBalance : Store.getInvoices()
                               .filter(i => i.partyId === selectedPartyId && i.id !== (initialData?.id || ''))
                               .reduce((sum, i) => sum + (i.grandTotal || 0), 0))
                             + Math.round(items.reduce((s, i) => s + i.total, 0) - globalDiscount)
                           ).toLocaleString('en-IN')}.00
                         </div>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      </div>
      
        {isPartyModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Add New Party</h3>
                <button onClick={() => setIsPartyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreateParty} className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Party Name *</label>
                      <input 
                        autoFocus
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none font-bold text-slate-800"
                        value={newPartyName}
                        onChange={e => handleNewPartyNameChange(e.target.value)}
                        placeholder="Enter customer name..."
                        required
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Party Code</label>
                      <input 
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none font-mono bg-slate-50"
                        value={newPartyCode}
                        onChange={e => setNewPartyCode(e.target.value)}
                        placeholder="Auto-generated"
                      />
                    </div>
                    
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                      <input 
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                        value={newPartyPhone}
                        onChange={e => setNewPartyPhone(e.target.value)}
                        placeholder="Contact number"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                      <input 
                        type="email"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                        value={newPartyEmail}
                        onChange={e => setNewPartyEmail(e.target.value)}
                        placeholder="Optional email"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">City</label>
                      <input 
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                        value={newPartyCity}
                        onChange={e => setNewPartyCity(e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">State</label>
                      <input 
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                        value={newPartyState}
                        onChange={e => setNewPartyState(e.target.value)}
                        placeholder="State"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pincode</label>
                      <input 
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                        value={newPartyPincode}
                        onChange={e => setNewPartyPincode(e.target.value)}
                        placeholder="Pincode"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
                      <input 
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                        value={newPartyAddress}
                        onChange={e => setNewPartyAddress(e.target.value)}
                        placeholder="Full address"
                      />
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="md:col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-[-8px]">Tax & Identity Details</div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST Number</label>
                          <input 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none uppercase text-xs"
                            value={newPartyGst}
                            onChange={e => setNewPartyGst(e.target.value)}
                            placeholder="GSTIN"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">PAN Number</label>
                          <input 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none uppercase text-xs"
                            value={newPartyPan}
                            onChange={e => setNewPartyPan(e.target.value)}
                            placeholder="PAN"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Aadhar Number</label>
                          <input 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none text-xs"
                            value={newPartyAadhar}
                            onChange={e => setNewPartyAadhar(e.target.value)}
                            placeholder="Aadhar UID"
                          />
                        </div>
                    </div>
                 </div>
                 
                 <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setIsPartyModalOpen(false)} disabled={saveStatus !== 'idle'} className="px-6 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold transition-colors">Cancel</button>
                    <button type="submit" disabled={saveStatus !== 'idle'} className="px-8 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold shadow-lg shadow-sky-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {saveStatus === 'saving' ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : saveStatus === 'done' ? 'Done!' : 'Create Party'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {isPreviewOpen && lastInvoice && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
           <div className="flex justify-between items-center p-4 text-white no-print">
               <div>
                  <h2 className="text-lg font-bold flex items-center gap-2"><CheckCircleIcon /> Invoice Saved!</h2>
                  <p className="text-xs text-slate-400">Ready to print or download.</p>
               </div>
               <div className="flex gap-3">
                  <button 
                     ref={printBtnRef}
                     onClick={handlePrint} 
                     className="bg-white text-slate-900 hover:bg-slate-200 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ring-2 ring-white/20"
                   >
                      <Printer size={18} /> Print
                   </button>
                   <button onClick={() => setIsPreviewOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg transition-colors">
                      <X size={20} />
                   </button>
               </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-slate-800/50">
                <div className="print-only-container shadow-2xl scale-100 origin-top bg-white">
                  <InvoiceTemplate invoice={lastInvoice} parties={parties} />
                </div>
           </div>
           <style>{`
              @media print {
                body * { visibility: hidden; }
                .print-only-container, .print-only-container * { visibility: visible; }
                .print-only-container { position: absolute; left: 0; top: 0; width: 100%; height: auto; min-height: 100%; margin: 0; padding: 0; box-shadow: none; }
                @page { size: A4; margin: 0; }
              }
           `}</style>
        </div>
      )}

    </div>
  );
};

const ShoppingBagIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-20"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
);

const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
);
