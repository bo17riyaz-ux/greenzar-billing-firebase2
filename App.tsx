
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Package, DollarSign, FileText, History, Menu, X, Database, CheckCircle, RefreshCw, Loader2, LayoutDashboard, Printer, LogOut, User as UserIcon, Edit3, Download, MoreHorizontal, FileDown, Search, Trophy, ClipboardList, CloudLightning, Calculator } from 'lucide-react';
import { PartyManager } from './components/PartyManager';
import { ProductManager } from './components/ProductManager';
import { RateManager } from './components/RateManager';
import { Billing } from './components/Billing';
import { DataManager } from './components/DataManager';
import { UserManager } from './components/UserManager';
import { MoreMenu } from './components/MoreMenu';
import { InvoiceLogs } from './components/InvoiceLogs';
import { Ranking } from './components/Ranking';
import { Login } from './components/Login';
import { Store } from './services/store';
import { Cloud } from './services/cloud';
import { Party, Product, SpecialRate, Invoice, ViewState, User } from './types';
import { formatWeight } from './utils';
import { InvoiceTemplate } from './components/InvoiceTemplate';
import { exportInvoicesToCSV } from './services/csv';
import { StatementGenerator } from './components/StatementGenerator';

import { auth } from './services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { SyncManager } from './components/SyncManager';

declare global {
  interface Window {
    html2pdf: any;
  }
}

// Helper to fill missing codes (Legacy)
const migratePartyCodes = (currentParties: Party[]): Party[] | null => {
    if (!currentParties || currentParties.length === 0) return null;
    const missingCodes = currentParties.some(p => !p.code);
    if (!missingCodes) return null; 

    const prefixHighScores: Record<string, number> = {};
    
    currentParties.forEach(p => {
        if (p.code && p.code.length >= 3) {
             const prefix = p.code.substring(0, 2);
             const numPart = parseInt(p.code.substring(2));
             if (!isNaN(numPart)) {
                 if (!prefixHighScores[prefix] || numPart > prefixHighScores[prefix]) {
                     prefixHighScores[prefix] = numPart;
                 }
             }
        }
    });

    let changed = false;
    const newParties = currentParties.map(p => {
        if (p.code) return p; 

        changed = true;
        const cleanName = p.name ? p.name.trim().toUpperCase() : 'UNKNOWN';
        
        let prefix = 'XX';
        if (cleanName.length > 0) {
             const firstChar = cleanName.charAt(0);
             const lastChar = cleanName.charAt(cleanName.length - 1);
             prefix = `${firstChar}${lastChar}`.replace(/[^A-Z0-9]/g, 'X');
        }
        
        if (!prefixHighScores[prefix]) prefixHighScores[prefix] = 0;
        prefixHighScores[prefix]++;
        
        const nextNum = prefixHighScores[prefix];
        const newCode = `${prefix}${String(nextNum).padStart(2, '0')}`;
        
        return { ...p, code: newCode };
    });

    return changed ? newParties : null;
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [validUsers, setValidUsers] = useState<User[]>(() => Store.getUsers());
  const [parties, setParties] = useState<Party[]>(() => Store.getParties());
  const [products, setProducts] = useState<Product[]>(() => Store.getProducts());
  const [specialRates, setSpecialRates] = useState<SpecialRate[]>(() => Store.getRates());
  const [invoices, setInvoices] = useState<Invoice[]>(() => Store.getInvoices());
  
  const [currentView, setCurrentView] = useState<ViewState>('billing');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(invoiceSearch), 400);
    return () => clearTimeout(timer);
  }, [invoiceSearch]);

  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; invoice: Invoice | null }>({
    visible: false,
    x: 0,
    y: 0,
    invoice: null,
  });

  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'pulling'>('idle');
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [cloudUrl] = useState(() => Cloud.getScriptUrl()); 
  const [authLoaded, setAuthLoaded] = useState(false);
  
  const isFirstLoad = useRef(true);
  const isRemoteUpdate = useRef(false);
  const lastPushTime = useRef(0); 
  const isWiping = useRef(false);

  // --- AUTOMATIC SERVER WIPE LOGIC ---
  useEffect(() => {
     // Check if we have wiped server data for version 2.3 (Stable ID reset)
     const WIPE_KEY = 'greenzar_server_wiped_v2_3';
     const hasWiped = localStorage.getItem(WIPE_KEY);

     if (!hasWiped) {
         console.log("Triggering automatic server wipe for v2.3...");
         isWiping.current = true;
         setSyncStatus('syncing');
         Cloud.clearAllData().then(() => {
             console.log("Server wipe complete.");
             localStorage.setItem(WIPE_KEY, 'true');
             isWiping.current = false;
             setSyncStatus('idle');
             // Reload to ensure a clean state if any old data lingered
             window.location.reload();
         }).catch(err => {
             console.error("Wipe failed", err);
             isWiping.current = false;
             setSyncStatus('idle');
         });
     }
  }, []);

  const loadLocalData = () => {
    setParties(Store.getParties());
    setProducts(Store.getProducts());
    setSpecialRates(Store.getRates());
    setInvoices(Store.getInvoices());
    setValidUsers(Store.getUsers());
  };

  useEffect(() => {
    const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  useEffect(() => {
    if (viewInvoice) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [viewInvoice]);

  useEffect(() => {
    if (pdfInvoice && pdfContainerRef.current && !isGeneratingPdf) {
      setIsGeneratingPdf(true);
      setTimeout(() => {
        const element = pdfContainerRef.current;
        if (!element || !window.html2pdf) {
            setIsGeneratingPdf(false);
            setPdfInvoice(null);
            return;
        }

        const opt = {
          margin: 0,
          filename: `Invoice_${pdfInvoice.invoiceNumber}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        window.html2pdf().set(opt).from(element).save().then(() => {
          setIsGeneratingPdf(false);
          setPdfInvoice(null);
        }).catch((err: any) => {
          console.error('PDF Generation Error:', err);
          setIsGeneratingPdf(false);
          setPdfInvoice(null);
        });
      }, 500);
    }
  }, [pdfInvoice, isGeneratingPdf]);



  // --- AUTO-PUSH ---
  useEffect(() => {
    if (isWiping.current) return;

    Store.saveParties(parties);
    Store.saveProducts(products);
    Store.saveRates(specialRates);
    Store.saveUsers(validUsers);

    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    if (isRemoteUpdate.current) {
       isRemoteUpdate.current = false; 
       return; 
    }

    // Allow manual sync even if empty, because user might have deleted everything manually
    if (!isFirstLoad.current && !isRemoteUpdate.current) {
        setHasPendingChanges(true);
    } else {
        isFirstLoad.current = false;
        isRemoteUpdate.current = false;
    }
  }, [parties, products, specialRates, validUsers]);

  const handleForcePush = async () => {
      setSyncStatus('syncing');
      try {
          await Cloud.syncMasterData(parties, products, specialRates, validUsers);
          lastPushTime.current = Date.now();
          setSyncStatus('synced');
          setHasPendingChanges(false);
          setTimeout(() => setSyncStatus('idle'), 2000);
          // alert("Data uploaded to Supabase."); // Removed alert for smoother flow
      } catch(e) {
          console.error(e);
          setSyncStatus('idle');
          alert("Upload failed. Check connection.");
      }
  };

  // --- AUTO-SYNC DEBOUNCED ---
  useEffect(() => {
    if (hasPendingChanges) {
      const timer = setTimeout(() => {
        handleForcePush();
      }, 1000); // 1 second delay before auto-syncing
      return () => clearTimeout(timer);
    }
  }, [hasPendingChanges]);

  const handleCloudPull = useCallback(async (isManual = false) => {
      // Don't pull if we are already syncing or have local changes waiting 
      if (!isManual) {
        if (syncStatus === 'syncing' || syncStatus === 'pulling' || hasPendingChanges || isWiping.current) return;
        if (Date.now() - lastPushTime.current < 2000) return; // Wait 2s after push
      }
      
      try {
        setSyncStatus('pulling');
        
        // Use cached fetches from Cloud service
        const [cloudParties, cloudProducts, cloudRates, cloudInvoices, cloudUsers] = await Promise.all([
           Cloud.fetchData('PARTIES', isManual),
           Cloud.fetchData('PRODUCTS', isManual),
           Cloud.fetchData('RATES', isManual),
           Cloud.fetchInvoices(isManual),
           Cloud.fetchUsers(isManual)
        ]);

        if (hasPendingChanges && !isManual) {
           setSyncStatus('idle');
           return;
        }

        let updateData = false;
        
        if (cloudParties.length !== parties.length || JSON.stringify(cloudParties) !== JSON.stringify(parties)) {
             setParties(cloudParties);
             Store.saveParties(cloudParties);
             updateData = true;
        }

        if (cloudProducts.length !== products.length || JSON.stringify(cloudProducts) !== JSON.stringify(products)) {
             // SMART MERGE: Keep local weights if cloud weights are missing
             const mergedProducts = cloudProducts.map((cp: Product) => {
                 const local = products.find(lp => lp.id === cp.id);
                 // Only use the cloud weight if it's actually set and non-empty
                 const cloudWeight = (cp.weight && String(cp.weight).trim() !== '') ? cp.weight : null;
                 return {
                     ...cp,
                     weight: cloudWeight || (local?.weight) || (cp.weight)
                 };
             });
             setProducts(mergedProducts);
             Store.saveProducts(mergedProducts);
             updateData = true;
        }

        if (cloudRates.length !== specialRates.length || JSON.stringify(cloudRates) !== JSON.stringify(specialRates)) {
             setSpecialRates(cloudRates);
             Store.saveRates(cloudRates);
             updateData = true;
        }
        
        if (cloudInvoices.length > 0 || (invoices && invoices.length > 0)) {
             const cloudInvoicesMap = new Map<string, Invoice>(cloudInvoices.map((i: Invoice) => [i.id, i]));
             const localInvoicesMap = new Map<string, Invoice>((invoices || []).map((i: Invoice) => [i.id, i]));
             
             // Combined IDs
             const allIds = new Set<string>([...Array.from(cloudInvoicesMap.keys()), ...Array.from(localInvoicesMap.keys())]);
             
             const mergedInvoices: Invoice[] = Array.from(allIds).map(id => {
                const ci = cloudInvoicesMap.get(id);
                const li = localInvoicesMap.get(id);
                
                if (ci && li) {
                  // If in both, cloud is truth but preserve local weight if newly added and cloud is empty
                  const cloudWeight = (ci.totalWeight && String(ci.totalWeight).trim() !== '') ? ci.totalWeight : null;
                  return {
                    ...ci,
                    totalWeight: cloudWeight || li.totalWeight || ci.totalWeight,
                    syncStatus: 'synced' as const
                  };
                } else if (ci) {
                   return { ...ci, syncStatus: 'synced' as const };
                } else {
                   // This is local-only (pending or failed to sync)
                   const localInv = li!; // We know it exists because id came from one of the maps
                   return { 
                     ...localInv, 
                     syncStatus: (localInv.syncStatus || 'pending') as 'pending' | 'synced' | 'failed'
                   };
                }
             });

             // Only update if they are actually different
             if (JSON.stringify(mergedInvoices) !== JSON.stringify(invoices)) {
                 setInvoices(mergedInvoices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                 Store.saveInvoices(mergedInvoices);
                 updateData = true;
             }
        }

        if (cloudUsers.length > 0 && JSON.stringify(cloudUsers) !== JSON.stringify(validUsers)) {
            setValidUsers(cloudUsers);
            Store.saveUsers(cloudUsers);
        }

        if (updateData) {
            isRemoteUpdate.current = true;
        }

        setSyncStatus('idle');

      } catch (e) {
        console.error("Supabase Pull Error", e);
        setSyncStatus('idle');
      }
  }, [parties, products, specialRates, invoices, validUsers, syncStatus, hasPendingChanges]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        sessionStorage.setItem('gfb_user', JSON.stringify({ username: user.displayName || user.email || 'User', role: 'user' }));
        if (!isWiping.current) handleCloudPull();
      } else {
        setIsAuthenticated(false);
        sessionStorage.removeItem('gfb_user');
      }
      setAuthLoaded(true);
    });
    return () => unsubscribe();
  }, [handleCloudPull]);

  useEffect(() => {
    // Check every 30 seconds for background updates from other clients
    const interval = setInterval(() => handleCloudPull(false), 30000); 
    return () => clearInterval(interval);
  }, [handleCloudPull]);

  const refreshInvoices = () => {
    setInvoices(Store.getInvoices());
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setCurrentView('billing');
  };
  
  const handleDownloadSingleInvoice = (invoice: Invoice) => {
    const csv = exportInvoicesToCSV([invoice]);
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv));
    link.setAttribute("download", `Invoice_${invoice.invoiceNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintOptions = (e: React.MouseEvent, invoice: Invoice) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.pageX - 120, 
      y: e.pageY,
      invoice: invoice
    });
  };

  const handleMenuAction = (action: 'print' | 'download') => {
    let inv = contextMenu.invoice;
    setContextMenu({ ...contextMenu, visible: false });
    
    if (inv) {
      const p = parties.find(party => party.id === inv?.partyId);
      if (p) {
         const clean = (val?: string) => (!val || val.trim() === '' || val.trim() === '-') ? null : val;
         inv = {
             ...inv,
             partyName: clean(inv.partyName) || p.name,
             partyAddress: clean(inv.partyAddress) || `${p.address}${p.city ? `, ${p.city}` : ''}`,
             partyPhone: clean(inv.partyPhone) || p.phone,
             partyGst: clean(inv.partyGst) || p.gstNumber,
             partyPan: clean(inv.partyPan) || p.panNumber,
             partyAadhar: clean(inv.partyAadhar) || p.aadharNumber,
         };
      }

      if (action === 'print') {
        setViewInvoice(inv);
      } else if (action === 'download') {
        setPdfInvoice(inv);
      }
    }
  };

  const handleLogin = (user: User) => {
    // handled by onAuthStateChanged
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    await signOut(auth);
    setShowLogoutConfirm(false);
  };

  const filteredInvoices = invoices.filter(inv => {
    const term = debouncedSearch.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(term) ||
      inv.partyName.toLowerCase().includes(term) ||
      (inv.vehicleNumber && inv.vehicleNumber.toLowerCase().includes(term))
    );
  });

  const handleImportData = (type: string, data: any[]) => {
    if (type === 'PARTIES') {
      const newParties = [...parties];
      data.forEach(d => {
        if (!newParties.find(p => p.id === d.id)) newParties.push(d);
      });
      setParties(newParties);
      Store.saveParties(newParties);
    } else if (type === 'PRODUCTS') {
      const newProducts = [...products];
      data.forEach(d => {
        if (!newProducts.find(p => p.id === d.id)) newProducts.push(d);
      });
      setProducts(newProducts);
      Store.saveProducts(newProducts);
    } else if (type === 'RATES') {
      const newRates = [...specialRates];
      data.forEach(d => {
        const existingInfo = newRates.findIndex(r => r.partyId === d.partyId && r.productId === d.productId);
        if (existingInfo > -1) {
          newRates[existingInfo] = d;
        } else {
          newRates.push(d);
        }
      });
      setSpecialRates(newRates);
      Store.saveRates(newRates);
    } else if (type === 'INVOICES') {
      const newInvoices = [...invoices];
      data.forEach(d => {
        if (!newInvoices.find(inv => inv.id === d.id)) newInvoices.push(d);
      });
      setInvoices(newInvoices);
      Store.saveInvoices(newInvoices);
    }
    setHasPendingChanges(true);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} validUsers={validUsers} />;
  }

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setEditingInvoice(null);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium mb-1 ${
        currentView === view 
          ? 'bg-sky-100 text-sky-800 shadow-sm ring-1 ring-sky-200' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-sky-600'
      }`}
    >
      <Icon size={18} strokeWidth={2} />
      <span>{label}</span>
    </button>
  );

  return (
    <>
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm scale-100">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                 <div className="p-3 bg-red-100 rounded-full">
                    <LogOut size={24} />
                 </div>
                 <h3 className="text-lg font-bold text-slate-800">Confirm Logout</h3>
              </div>
              <p className="text-slate-600 mb-6 text-sm font-medium">
                 Are you sure you want to end your current session? Unsaved changes might be lost.
              </p>
              <div className="flex justify-end gap-3">
                 <button 
                   onClick={() => setShowLogoutConfirm(false)}
                   className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={confirmLogout}
                   className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-md shadow-red-200 transition-colors"
                 >
                   Yes, Logout
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Context Menu (Dropdown) */}
      {contextMenu.visible && (
        <div 
          className="fixed z-[999] bg-white border border-slate-200 shadow-xl rounded-lg py-1 w-40 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
          style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 170) }}
        >
          <button 
            onClick={() => handleMenuAction('print')}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2"
          >
            <Printer size={14} /> Print
          </button>
          <button 
            onClick={() => handleMenuAction('download')}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-sky-50 hover:text-sky-700 flex items-center gap-2"
          >
            <FileDown size={14} /> Download PDF
          </button>
        </div>
      )}

      {/* Hidden Container for PDF Generation */}
      {pdfInvoice && (
        <div className="fixed top-0 left-0 z-[-1] w-[210mm] opacity-0 pointer-events-none">
          <div ref={pdfContainerRef}>
            <InvoiceTemplate invoice={pdfInvoice} parties={parties} />
          </div>
        </div>
      )}

      {/* --- FLOATING SYNC STATUS WIDGET --- */}
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 pr-4 flex items-center gap-3 min-w-[180px]">
          {syncStatus === 'syncing' || syncStatus === 'pulling' ? (
            <RefreshCw className="text-orange-500 animate-spin" size={20} />
          ) : (
            <CheckCircle className="text-emerald-500" size={20} />
          )}
          
          <div className="flex-1">
            <div className={`font-bold text-xs ${syncStatus === 'syncing' || syncStatus === 'pulling' ? 'text-orange-600' : 'text-slate-700'}`}>
              {syncStatus === 'syncing' ? 'Syncing...' : 
               syncStatus === 'pulling' ? 'Updating...' :
               syncStatus === 'synced' ? 'All Saved' : 'Connected'}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white z-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-sm no-print">
        <div className="font-bold text-sky-700 text-lg flex items-center gap-2">
            <LayoutDashboard size={20} /> GREENZAR
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className={`
        fixed md:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 z-[60] shadow-xl md:shadow-none no-print flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <div className="p-6">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 tracking-tight">
            <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-sky-200">G</div>
            GREENZAR
          </h1>
          <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-wider font-bold pl-10">Food & Beverage</p>
        </div>

        <nav className="px-4 py-2 flex-1 overflow-y-auto">
          <NavItem view="billing" icon={FileText} label="Create Invoice" />
          <NavItem view="history" icon={History} label="History" />
          <NavItem view="statement" icon={Calculator} label="Statement" />
          <NavItem view="ranking" icon={Trophy} label="Ranking" />
          <NavItem view="logs" icon={ClipboardList} label="All Logs" />
          
          <div className="mt-6 mb-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Database</div>
          
          <NavItem view="parties" icon={Users} label="Parties" />
          <NavItem view="products" icon={Package} label="Products" />
          <NavItem view="rates" icon={DollarSign} label="Price Lists" />
          
          <div className="mt-6 mb-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuration</div>
          <NavItem view="users" icon={UserIcon} label="Users" />
          <NavItem view="data" icon={Database} label="Data & Sync" />
          <NavItem view="more" icon={MoreHorizontal} label="More" />
          
          <div className="mt-8 px-4">
             {hasPendingChanges ? (
                <button 
                  onClick={handleForcePush}
                  disabled={syncStatus === 'syncing'}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all font-bold shadow-lg shadow-orange-100 active:scale-95 disabled:opacity-50 mb-2"
                >
                  <CloudLightning size={18} className={syncStatus === 'syncing' ? 'animate-pulse' : ''} />
                  <span>Syncing Changes...</span>
                </button>
             ) : (
                <div className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl transition-all font-bold mb-2">
                  <CheckCircle size={18} />
                  <span>Cloud Synced</span>
                </div>
             )}
             <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-wider">
               {hasPendingChanges ? 'Saving in background...' : 'Data is up to date'}
             </p>
          </div>
        </nav>

        {/* Simplified Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 backdrop-blur-sm">
           <button 
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
           >
             <LogOut size={14} /> Logout
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden pt-14 md:pt-0 bg-slate-50/50">
        
        {/* DESKTOP TOP HEADER (Optional but helpful for visibility) */}
        <div className="hidden md:flex bg-white border-b border-slate-200 px-8 py-3 justify-between items-center z-40 no-print">
            <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                    Active Session: <span className="text-slate-800">{JSON.parse(sessionStorage.getItem('gfb_user') || '{}').username || 'User'}</span>
                </span>
            </div>
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    syncStatus === 'syncing' || syncStatus === 'pulling' 
                    ? 'bg-orange-50 border-orange-200 text-orange-600' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                }`}>
                    {syncStatus === 'syncing' || syncStatus === 'pulling' ? (
                        <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Updating...</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle size={12} />
                            <span>Cloud Synced</span>
                        </>
                    )}
                </div>
            </div>
        </div>

        {currentView === 'billing' && (
          <Billing 
            parties={parties} 
            setParties={setParties}
            products={products} 
            specialRates={specialRates}
            setSpecialRates={setSpecialRates}
            onInvoiceSaved={() => {
              refreshInvoices();
              setEditingInvoice(null);
            }}
            initialData={editingInvoice}
          />
        )}

        {currentView === 'parties' && (
          <div className="h-full overflow-y-auto">
            <PartyManager parties={parties} setParties={setParties} />
          </div>
        )}

        {currentView === 'products' && (
          <div className="h-full overflow-y-auto">
            <ProductManager products={products} setProducts={setProducts} />
          </div>
        )}

        {currentView === 'rates' && (
          <RateManager 
            parties={parties} 
            products={products} 
            specialRates={specialRates} 
            setSpecialRates={setSpecialRates} 
          />
        )}

        {currentView === 'users' && (
          <div className="h-full overflow-y-auto">
             <UserManager users={validUsers} setUsers={setValidUsers} />
          </div>
        )}

        {currentView === 'more' && (
          <div className="h-full overflow-y-auto">
             <MoreMenu invoices={invoices} parties={parties} products={products} />
          </div>
        )}

        {currentView === 'logs' && (
          <div className="h-full overflow-y-auto">
             <InvoiceLogs invoices={invoices} parties={parties} />
          </div>
        )}

        {currentView === 'ranking' && (
          <div className="h-full overflow-y-auto">
             <Ranking invoices={invoices} parties={parties} />
          </div>
        )}

        {currentView === 'statement' && (
          <div className="h-full overflow-y-auto">
             <StatementGenerator parties={parties} invoices={invoices} />
          </div>
        )}

        {currentView === 'history' && (
          <div className="h-full overflow-y-auto p-4 md:p-8">
             {/* Print Invoice Modal */}
             {viewInvoice && (
              <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col no-print">
                <div className="flex justify-between items-center p-4 text-white">
                    <h2 className="text-lg font-bold">Print Invoice #{viewInvoice.invoiceNumber}</h2>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => window.print()} 
                        className="bg-white text-slate-900 hover:bg-slate-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ring-2 ring-white/20"
                      >
                          <Printer size={18} /> Print
                      </button>
                      <button onClick={() => setViewInvoice(null)} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg transition-colors">
                          <X size={20} />
                      </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-slate-800">
                    <div className="print-only-container shadow-2xl scale-100 origin-top bg-white">
                      <InvoiceTemplate invoice={viewInvoice} parties={parties} />
                    </div>
                </div>
                <style>{`
                  @media print {
                    body * { visibility: hidden; }
                    .print-only-container, .print-only-container * { visibility: visible; }
                    .print-only-container { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; padding: 0; box-shadow: none; }
                    @page { size: A4; margin: 0; }
                  }
                `}</style>
              </div>
            )}
            
             {/* Generating PDF Loader */}
             {isGeneratingPdf && (
               <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <div className="bg-white p-6 rounded-2xl flex flex-col items-center">
                     <Loader2 size={40} className="text-sky-600 animate-spin mb-4" />
                     <p className="font-bold text-slate-700">Generating PDF...</p>
                  </div>
               </div>
             )}

             <div className="max-w-6xl mx-auto print:max-w-none print:w-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 no-print">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Invoice History</h2>
                    <p className="text-slate-500 text-sm">View past transactions</p>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    {/* Search Bar */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="Search invoices..." 
                          value={invoiceSearch}
                          onChange={(e) => setInvoiceSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900 shadow-sm"
                        />
                        {invoiceSearch && (
                          <button 
                            onClick={() => setInvoiceSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X size={14} />
                          </button>
                        )}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50">
                        <Printer size={16} />
                        Print List
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ring-1 ring-slate-100 print:ring-0 print:border-none print:shadow-none overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/80 border-b border-slate-200 print:bg-white print:border-slate-900">
                      <tr>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap">Invoice #</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap">Date</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap">Party</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap">Vehicle</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap text-center">Qty</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap text-center">Items</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap text-right">Tax</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap text-right">Disc.</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider whitespace-nowrap text-right">Weight</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider text-right whitespace-nowrap">Total</th>
                        <th className="px-4 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider text-right whitespace-nowrap no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                      {filteredInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-sky-50/50 transition-colors print:hover:bg-transparent">
                          <td className="px-4 py-4 font-mono text-xs text-slate-600 font-bold whitespace-nowrap">{inv.invoiceNumber}</td>
                          <td className="px-4 py-4 text-xs text-slate-600 whitespace-nowrap">{inv.date}</td>
                          <td className="px-4 py-4 text-xs font-medium text-slate-800 whitespace-nowrap max-w-[150px] truncate" title={inv.partyName || 'Unknown'}>{inv.partyName || 'Unknown Party'}</td>
                          <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">{inv.vehicleNumber || '-'}</td>
                          <td className="px-4 py-4 text-xs text-slate-500 text-center whitespace-nowrap">{inv.poNumber || '-'}</td>
                          <td className="px-4 py-4 text-xs text-slate-500 text-center whitespace-nowrap">{(inv.items || []).length}</td>
                          <td className="px-4 py-4 text-xs text-slate-500 text-right whitespace-nowrap">₹{(inv.taxAmount || 0).toFixed(2)}</td>
                          <td className="px-4 py-4 text-xs text-red-400 text-right whitespace-nowrap">{(inv.globalDiscount || 0) > 0 ? `₹${inv.globalDiscount}` : '-'}</td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                             <div className="text-[10px] font-bold text-slate-700">
                                {(() => {
                                   const autoW = (inv.items || []).reduce((sum, item) => {
                                     if (!item.weight) return sum;
                                     const w = parseFloat(item.weight.replace(/[^0-9.]/g, ''));
                                     return isNaN(w) ? sum : sum + (w * (item.quantity || 0));
                                   }, 0);
                                   const wStr = inv.totalWeight || (autoW > 0 ? autoW.toString() : '');
                                   return wStr ? formatWeight(wStr) : '-';
                                })()}
                             </div>
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold text-slate-700 whitespace-nowrap">₹{(inv.grandTotal || 0).toFixed(2)}</td>
                          <td className="px-4 py-4 text-right whitespace-nowrap no-print">
                             <div className="flex justify-end gap-1">
                               <button 
                                onClick={() => handleEditInvoice(inv)}
                                className="text-slate-400 hover:text-orange-600 p-2 hover:bg-orange-50 rounded-lg transition-all"
                                title="Edit Invoice"
                                >
                                 <Edit3 size={16} />
                               </button>
                               <button 
                                onClick={(e) => handlePrintOptions(e, inv)}
                                className="text-slate-400 hover:text-sky-600 p-2 hover:bg-sky-50 rounded-lg transition-all"
                                title="Print / Download Options"
                               >
                                 <Printer size={16} />
                               </button>
                               <button 
                                onClick={() => handleDownloadSingleInvoice(inv)}
                                className="text-slate-400 hover:text-emerald-600 p-2 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Download CSV"
                               >
                                 <Download size={16} />
                               </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                      {filteredInvoices.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                             {invoiceSearch ? 'No invoices match your search.' : 'No invoices generated yet.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}

        {currentView === 'data' && (
          <div className="h-full overflow-y-auto">
            <DataManager 
              parties={parties}
              products={products}
              specialRates={specialRates}
              invoices={invoices}
              refreshData={loadLocalData}
              onForcePush={handleForcePush}
              onImportData={handleImportData}
            />
          </div>
        )}

      </div>
    </div>
    {authLoaded && <SyncManager />}
    </>
  );
};

export default App;
