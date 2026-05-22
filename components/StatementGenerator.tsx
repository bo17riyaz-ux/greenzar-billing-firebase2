
import React, { useState, useMemo, useRef } from 'react';
import { Search, Printer, CheckCircle, ChevronRight, Calculator, FileText, Calendar, User, IndianRupee, FileDown, Loader2 } from 'lucide-react';
import { Party, Invoice, Statement } from '../types';
import { Store } from '../services/store';

interface Props {
  parties: Party[];
  invoices: Invoice[];
}

export const StatementGenerator: React.FC<Props> = ({ parties, invoices }) => {
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [isPrinting, setIsPrinting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const thermalPdfRef = useRef<HTMLDivElement>(null);

  const filteredParties = useMemo(() => {
    if (!partySearch.trim()) return [];
    return parties.filter(p => 
      p.name.toLowerCase().includes(partySearch.toLowerCase()) || 
      (p.code && p.code.toLowerCase().includes(partySearch.toLowerCase()))
    ).slice(0, 5);
  }, [parties, partySearch]);

  const selectedParty = useMemo(() => 
    parties.find(p => p.id === selectedPartyId), [parties, selectedPartyId]
  );

  const partyInvoices = useMemo(() => {
    if (!selectedPartyId) return [];
    return invoices
      .filter(inv => inv.partyId === selectedPartyId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, selectedPartyId]);

  const toggleInvoice = (id: string) => {
    const newSelected = new Set(selectedInvoiceIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedInvoiceIds(newSelected);
  };

  const selectedTotal = useMemo(() => {
    return partyInvoices
      .filter(inv => selectedInvoiceIds.has(inv.id))
      .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  }, [partyInvoices, selectedInvoiceIds]);

  const totalOutstanding = previousBalance + selectedTotal;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!selectedParty || !window.html2pdf || !thermalPdfRef.current) return;
    
    setIsGeneratingPdf(true);
    const element = thermalPdfRef.current;
    
    // Temporarily show the element for capturing if it's hidden
    const originalStyle = element.style.display;
    element.style.display = 'block';

    const opt = {
      margin: [5, 2], // Small margins for thermal
      filename: `${selectedParty.name}_Statement_${new Date().toLocaleDateString()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: [80, 200], orientation: 'portrait' } // 80mm width
    };

    window.html2pdf().set(opt).from(element).save().then(() => {
      element.style.display = originalStyle;
      setIsGeneratingPdf(false);
    }).catch((err: any) => {
      console.error(err);
      element.style.display = originalStyle;
      setIsGeneratingPdf(false);
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Calculator className="text-sky-600" size={24} />
            Ledger Statement
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Thermal Printer Optimized (3-inch)</p>
        </div>
        <div className="flex gap-2">
          <button 
             onClick={handleDownloadPdf}
             disabled={!selectedPartyId || isGeneratingPdf}
             className="flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-slate-200 hover:border-sky-500 hover:text-sky-600 text-slate-600 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
          >
            {isGeneratingPdf ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
            Download PDF
          </button>
          <button 
            onClick={handlePrint}
            disabled={!selectedPartyId}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-lg shadow-sky-100 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            <Printer size={18} />
            Print 3" Statement
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 no-print">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Left Column: Configuration */}
          <div className="md:col-span-5 space-y-6">
            {/* Party Selection */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Select Customer / Party</label>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    value={partySearch}
                    onChange={(e) => {
                      setPartySearch(e.target.value);
                      if (selectedPartyId) setSelectedPartyId('');
                    }}
                    placeholder="Search by name or code..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-sky-500 focus:bg-white rounded-xl outline-none transition-all font-bold text-slate-700"
                  />
                  {filteredParties.length > 0 && !selectedPartyId && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      {filteredParties.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => {
                            setSelectedPartyId(p.id);
                            setPartySearch(p.name);
                            // Auto-set previous balance to current calculated outstanding
                            const currentDue = invoices
                              .filter(inv => inv.partyId === p.id)
                              .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
                            setPreviousBalance(currentDue);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-sky-50 border-b border-slate-50 last:border-0 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-800">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{p.code || 'NO CODE'} • {p.city || 'LOCAL'}</div>
                          </div>
                          <ChevronRight size={16} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
               </div>

               {selectedParty && (
                 <div className="mt-4 p-4 bg-sky-50/50 rounded-xl border border-sky-100">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-white font-black">
                          {selectedParty.name[0]}
                       </div>
                       <div>
                          <div className="text-sm font-black text-slate-800">{selectedParty.name}</div>
                          <div className="text-[10px] font-bold text-slate-500">{selectedParty.phone || 'No Phone'}</div>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            {/* Manual Balance Adjustment */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Previous / Opening Balance</label>
               <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">₹</div>
                  <input 
                    type="number"
                    value={previousBalance}
                    onChange={(e) => setPreviousBalance(parseFloat(e.target.value) || 0)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-xl outline-none transition-all font-black text-slate-800 text-lg"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-500 uppercase tracking-tighter bg-orange-50 px-2 py-1 rounded">Manual Entry</div>
               </div>
               <p className="text-[10px] text-slate-400 mt-2 font-bold px-1 italic">* This amount will be added to the selected bills total.</p>
            </div>

            {/* Total Preview */}
            <div className="bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-200 text-white">
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-slate-400">
                     <span className="text-[10px] font-bold uppercase tracking-widest">Opening Balance</span>
                     <span className="font-bold font-mono">₹{previousBalance.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                     <span className="text-[10px] font-bold uppercase tracking-widest">Selected Bills ({selectedInvoiceIds.size})</span>
                     <span className="font-bold font-mono text-sky-400">+ ₹{selectedTotal.toLocaleString('en-IN')}.00</span>
                  </div>
                  <div className="h-px bg-slate-800 my-2"></div>
                  <div className="flex justify-between items-end">
                     <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500 mb-1">TOTAL OUTSTANDING</div>
                        <div className="text-3xl font-black tracking-tighter">₹{totalOutstanding.toLocaleString('en-IN')}.00</div>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          {/* Right Column: Bill Selection */}
          <div className="md:col-span-7">
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                   <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Select Bills to Include</h2>
                   <div className="flex gap-2">
                      <button 
                         onClick={() => setSelectedInvoiceIds(new Set(partyInvoices.map(i => i.id)))}
                         className="text-[10px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-2 py-1 rounded"
                      >
                         Select All
                      </button>
                      <button 
                         onClick={() => setSelectedInvoiceIds(new Set())}
                         className="text-[10px] font-bold text-slate-400 hover:text-slate-500 bg-slate-100 px-2 py-1 rounded"
                      >
                         Clear
                      </button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                   {partyInvoices.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <FileText size={48} className="opacity-20 mb-4" />
                        <p className="text-sm font-bold uppercase tracking-widest">No invoices found</p>
                        <p className="text-[10px] mt-1 font-bold">Please select a party first</p>
                     </div>
                   ) : (
                     <div className="space-y-1">
                        {partyInvoices.map(inv => (
                          <div 
                             key={inv.id}
                             onClick={() => toggleInvoice(inv.id)}
                             className={`group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                               selectedInvoiceIds.has(inv.id) 
                                 ? 'bg-sky-50 border-sky-200' 
                                 : 'bg-white border-transparent hover:bg-slate-50'
                             }`}
                          >
                             <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                               selectedInvoiceIds.has(inv.id) 
                                 ? 'bg-sky-600 border-sky-600 text-white' 
                                 : 'bg-white border-slate-200'
                             }`}>
                                {selectedInvoiceIds.has(inv.id) && <CheckCircle size={14} />}
                             </div>
                             
                             <div className="flex-1">
                                <div className="flex justify-between items-start">
                                   <div className="font-bold text-slate-800">{inv.invoiceNumber}</div>
                                   <div className="font-black text-slate-900">₹{inv.grandTotal.toLocaleString('en-IN')}.00</div>
                                </div>
                                <div className="flex gap-3 mt-1">
                                   <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                                      <Calendar size={10} />
                                      {new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                   </div>
                                   {inv.vehicleNumber && (
                                     <div className="text-[10px] font-bold text-slate-400 uppercase">
                                        • {inv.vehicleNumber}
                                     </div>
                                   )}
                                </div>
                             </div>
                          </div>
                        ))}
                     </div>
                   )}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* PDF / Hidden Container for thermal export */}
      <div className="hidden">
         <div ref={thermalPdfRef} className="p-4 bg-white font-mono text-[10px] leading-tight text-black" style={{ width: '75mm' }}>
            <div className="text-center font-black text-sm border-b-2 border-black pb-2 mb-2 uppercase">
               Statement
            </div>
            
            <div className="mb-4">
               <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{new Date().toLocaleDateString('en-IN')}</span>
               </div>
               <div className="font-black text-sm mt-1">{selectedParty?.name}</div>
               <div>{selectedParty?.phone}</div>
               <div className="text-[8px]">{selectedParty?.address}</div>
            </div>

            <div className="border-t border-b border-black py-1 mb-2">
               <div className="flex justify-between font-bold">
                  <span>PREV BALANCE:</span>
                  <span>₹{previousBalance.toFixed(2)}</span>
               </div>
            </div>

            <table className="w-full text-left mb-2">
               <thead>
                  <tr className="border-b border-black">
                     <th className="py-1">DESC/DATE</th>
                     <th className="py-1 text-right">AMOUNT</th>
                  </tr>
               </thead>
               <tbody>
                  {partyInvoices.filter(i => selectedInvoiceIds.has(i.id)).map(inv => (
                     <tr key={inv.id}>
                        <td className="py-1">
                           <div className="uppercase">{inv.invoiceNumber}</div>
                           <div className="text-[8px]">{new Date(inv.date).toLocaleDateString('en-IN')}</div>
                        </td>
                        <td className="py-1 text-right align-top">₹{inv.grandTotal.toFixed(2)}</td>
                     </tr>
                  ))}
               </tbody>
            </table>

            <div className="border-t-2 border-black pt-2">
               <div className="flex justify-between font-black text-xs">
                  <span>TOTAL DUE:</span>
                  <span>₹{totalOutstanding.toFixed(2)}</span>
               </div>
            </div>

            <div className="mt-6 text-center text-[8px] uppercase border-t border-slate-200 pt-2">
               <p>Thank You For Your Business</p>
               <p className="mt-1 font-bold">Generated via GREENZAR F&B</p>
            </div>
         </div>
      </div>

      {/* PRINT VIEW (Thermal Style) */}
      <div className="hidden print:block thermal-container mx-auto p-4 bg-white font-mono text-[10px] leading-tight text-black" style={{ width: '80mm', maxWidth: '3in' }}>
          <div className="text-center font-black text-sm border-b-2 border-black pb-2 mb-2 uppercase">
             Statement
          </div>
          
          <div className="mb-4">
             <div className="flex justify-between">
                <span>DATE:</span>
                <span>{new Date().toLocaleDateString('en-IN')}</span>
             </div>
             <div className="font-black text-sm mt-1">{selectedParty?.name}</div>
             <div>{selectedParty?.phone}</div>
             <div className="text-[8px]">{selectedParty?.address}</div>
          </div>

          <div className="border-t border-b border-black py-1 mb-2">
             <div className="flex justify-between font-bold">
                <span>PREV BALANCE:</span>
                <span>₹{previousBalance.toFixed(2)}</span>
             </div>
          </div>

          <table className="w-full text-left mb-2">
             <thead>
                <tr className="border-b border-black">
                   <th className="py-1">DESC/DATE</th>
                   <th className="py-1 text-right">AMOUNT</th>
                </tr>
             </thead>
             <tbody>
                {partyInvoices.filter(i => selectedInvoiceIds.has(i.id)).map(inv => (
                   <tr key={inv.id}>
                      <td className="py-1">
                         <div className="uppercase">{inv.invoiceNumber}</div>
                         <div className="text-[8px]">{new Date(inv.date).toLocaleDateString('en-IN')}</div>
                      </td>
                      <td className="py-1 text-right align-top">₹{inv.grandTotal.toFixed(2)}</td>
                   </tr>
                ))}
             </tbody>
          </table>

          <div className="border-t-2 border-black pt-2">
             <div className="flex justify-between font-black text-xs">
                <span>TOTAL DUE:</span>
                <span>₹{totalOutstanding.toFixed(2)}</span>
             </div>
          </div>

          <div className="mt-6 text-center text-[8px] uppercase border-t border-slate-200 pt-2">
             <p>Thank You For Your Business</p>
             <p className="mt-1 font-bold">Generated via GREENZAR F&B</p>
          </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .thermal-container, .thermal-container * { visibility: visible; }
          .thermal-container { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 80mm !important; 
            margin: 0 !important;
            padding: 10px !important;
          }
          @page { size: auto; margin: 0; }
          .no-print { display: none !important; }
        }
      `}} />
    </div>
  );
};
