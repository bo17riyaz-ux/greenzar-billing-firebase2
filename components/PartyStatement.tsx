
import React, { useState, useMemo, useRef } from 'react';
import { Invoice, Party } from '../types';
import { Search, Printer, FileText, Calendar, ArrowRight, User, Hash, Box, Download, Loader2 } from 'lucide-react';
import { getLocalDateString } from '../utils';

interface Props {
  invoices: Invoice[];
  parties: Party[];
}

export const PartyStatement: React.FC<Props> = ({ invoices, parties }) => {
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [partySearch, setPartySearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // PDF Generation State
  const statementRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Default to current month
  const today = new Date();
  const firstDay = getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDay = getLocalDateString(today);

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
    (p.code && p.code.toLowerCase().includes(partySearch.toLowerCase()))
  );

  const selectedParty = parties.find(p => p.id === selectedPartyId);

  // Filter invoices for the selected party and date range
  const statementData = useMemo(() => {
    if (!selectedPartyId) return [];

    return invoices
      .filter(inv => {
        return (
          inv.partyId === selectedPartyId &&
          inv.date >= startDate &&
          inv.date <= endDate
        );
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by Date Ascending
  }, [invoices, selectedPartyId, startDate, endDate]);

  // Calculate Totals
  const totalAmount = statementData.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalQty = statementData.reduce((sum, inv) => {
     const invQty = inv.items.reduce((q, item) => q + (item.quantity || 0), 0);
     return sum + invQty;
  }, 0);

  const selectParty = (p: Party) => {
    setSelectedPartyId(p.id);
    setPartySearch(p.name);
    setShowSuggestions(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!selectedParty || !statementRef.current || !window.html2pdf) return;
    setIsDownloading(true);

    const element = statementRef.current;
    const opt = {
      margin: [10, 10, 10, 10], // Top, Left, Bottom, Right margins in mm
      filename: `${selectedParty.name.replace(/\s+/g, '_')}_Statement.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(element).save().then(() => {
      setIsDownloading(false);
    }).catch((err: any) => {
      console.error("PDF Generation failed", err);
      setIsDownloading(false);
      alert("Failed to generate PDF. Please try printing instead.");
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 no-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-sky-600" /> Party Bill Statement
          </h2>
          <p className="text-slate-500 text-sm">View day-to-day billing history per customer.</p>
        </div>
        
        <div className="flex gap-3">
            <button 
            onClick={handleDownloadPdf}
            disabled={!selectedPartyId || statementData.length === 0 || isDownloading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
            >
            {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {isDownloading ? 'Generating...' : 'Download PDF'}
            </button>

            <button 
            onClick={handlePrint}
            disabled={!selectedPartyId || statementData.length === 0}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
            >
            <Printer size={18} /> Print
            </button>
        </div>
      </div>

      {/* Controls Section (Hidden on Print) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Party Selector */}
          <div className="relative">
             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Party</label>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  value={partySearch}
                  onChange={(e) => {
                    setPartySearch(e.target.value);
                    setSelectedPartyId('');
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Search party by name or code..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-medium"
                />
                {showSuggestions && filteredParties.length > 0 && (
                   <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {filteredParties.map(p => (
                        <div 
                          key={p.id}
                          className="px-4 py-2 text-sm cursor-pointer hover:bg-sky-50 text-slate-700"
                          onMouseDown={() => selectParty(p)}
                        >
                           <div className="font-bold">{p.name}</div>
                           <div className="text-xs text-slate-400">{p.city} {p.code ? `• ${p.code}` : ''}</div>
                        </div>
                      ))}
                   </div>
                )}
             </div>
          </div>

          {/* Date Range */}
          <div className="flex gap-4">
             <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">From Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-medium"
                />
             </div>
             <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">To Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-medium"
                />
             </div>
          </div>
        </div>
      </div>

      {/* Statement View (Printable / PDF Source) */}
      <div 
        ref={statementRef}
        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col print:shadow-none print:border-none"
      >
        
        {/* Printable Header */}
        {selectedParty && (
          <div className="bg-slate-50 p-6 border-b border-slate-200 print:bg-white print:px-0">
             <div className="flex justify-between items-start">
                <div>
                   <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">{selectedParty.name}</h1>
                   <div className="text-sm text-slate-500 mb-2">{selectedParty.address} {selectedParty.city}</div>
                   <div className="flex gap-4 text-xs font-mono text-slate-400">
                      <span>Ph: {selectedParty.phone || 'N/A'}</span>
                      <span>GST: {selectedParty.gstNumber || 'N/A'}</span>
                   </div>
                </div>
                <div className="text-right">
                   <div className="text-xs font-bold text-slate-400 uppercase">Statement Period</div>
                   <div className="font-bold text-slate-800 text-sm">{startDate.split('-').reverse().join('/')} <span className="text-slate-400 mx-1">to</span> {endDate.split('-').reverse().join('/')}</div>
                </div>
             </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-y-auto flex-1">
           {selectedPartyId ? (
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-100 border-b border-slate-200 text-xs text-slate-500 uppercase font-bold print:bg-slate-50 print:text-black">
                   <th className="px-6 py-4 w-32">Date</th>
                   <th className="px-6 py-4">Invoice #</th>
                   <th className="px-6 py-4 text-right">Bill Amount</th>
                   <th className="px-6 py-4 text-center">Total Qty</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-sm">
                  {statementData.map((inv, idx) => {
                     // Calculate qty for this invoice row
                     const rowQty = inv.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
                     return (
                       <tr key={inv.id} className="hover:bg-slate-50 transition-colors print:hover:bg-white">
                         <td className="px-6 py-3 text-slate-600 font-mono">
                           <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-slate-300 no-print" />
                              {inv.date.split('-').reverse().join('-')}
                           </div>
                         </td>
                         <td className="px-6 py-3 font-bold text-slate-800">
                           <div className="flex items-center gap-2">
                             <Hash size={12} className="text-slate-300 no-print" />
                             {inv.invoiceNumber}
                           </div>
                         </td>
                         <td className="px-6 py-3 text-right font-bold text-slate-900">
                            ₹{inv.grandTotal.toLocaleString('en-IN')}
                         </td>
                         <td className="px-6 py-3 text-center text-slate-600 font-mono bg-slate-50/50 print:bg-transparent">
                            <div className="inline-flex items-center gap-1">
                               {rowQty}
                            </div>
                         </td>
                       </tr>
                     );
                  })}
                  {statementData.length === 0 && (
                    <tr>
                       <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                          No invoices found for this party in the selected date range.
                       </td>
                    </tr>
                  )}
               </tbody>
               
               {/* Footer / Totals */}
               {statementData.length > 0 && (
                 <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800 print:bg-white print:border-t-2 print:border-black">
                    <tr>
                       <td colSpan={2} className="px-6 py-4 text-right uppercase text-xs tracking-wider text-slate-500">Total</td>
                       <td className="px-6 py-4 text-right text-lg text-emerald-700 bg-emerald-50 print:bg-transparent print:text-black">₹{totalAmount.toLocaleString('en-IN')}</td>
                       <td className="px-6 py-4 text-center text-sky-700 bg-sky-50 border-x border-sky-100 print:bg-transparent print:border-none print:text-black">{totalQty}</td>
                    </tr>
                 </tfoot>
               )}
             </table>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12">
                <User size={48} className="mb-4 opacity-20" />
                <p>Please select a party to view their bill statement.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
