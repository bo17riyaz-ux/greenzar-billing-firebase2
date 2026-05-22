
import React, { useState, useMemo, useRef } from 'react';
import { Invoice, Party } from '../types';
import { Search, Download, ChevronDown, ChevronUp, FileText, Package, Calendar, Truck, User, Filter, FileDown, Loader2 } from 'lucide-react';
import { exportInvoicesToCSV } from '../services/csv';
import { getLocalDateString } from '../utils';

interface Props {
  invoices: Invoice[];
  parties: Party[];
}

export const InvoiceLogs: React.FC<Props> = ({ invoices, parties = [] }) => {
  // Default Date Range: Current Month
  const today = new Date();
  const firstDay = getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDay = getLocalDateString(today);

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Filter Logic: Combine Search + Date Range + Party
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = 
        (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.partyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.vehicleNumber && inv.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesDate = inv.date >= startDate && inv.date <= endDate;
      const matchesParty = selectedPartyId ? inv.partyId === selectedPartyId : true;

      return matchesSearch && matchesDate && matchesParty;
    });
  }, [invoices, searchTerm, startDate, endDate, selectedPartyId]);

  // Calculate Summaries
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalCount = filteredInvoices.length;
  
  // Safe find with optional chaining logic handled by default prop
  const selectedParty = parties.find(p => p.id === selectedPartyId);

  const toggleExpand = (id: string) => {
    if (expandedId === id) setExpandedId(null);
    else setExpandedId(id);
  };

  const calculateQty = (inv: Invoice) => {
      return inv.items.reduce((acc, item) => acc + (item.quantity || 0), 0);
  };

  const handleDownloadCSV = () => {
    const csv = exportInvoicesToCSV(filteredInvoices);
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv));
    link.setAttribute("download", `Invoice_Logs_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    if (!pdfRef.current || !window.html2pdf || !selectedParty) return;
    setIsGeneratingPdf(true);

    const element = pdfRef.current;
    const opt = {
      margin: 10,
      filename: `${selectedParty.name}_Statement.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().set(opt).from(element).save().then(() => {
      setIsGeneratingPdf(false);
    }).catch((err: any) => {
      console.error("PDF Failed", err);
      setIsGeneratingPdf(false);
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
      {/* Hidden PDF Template */}
      <div className="fixed top-0 left-0 z-[-1] opacity-0 pointer-events-none w-[210mm]">
          <div ref={pdfRef} className="p-8 bg-white text-slate-900 font-sans">
              <div className="border-b-2 border-slate-800 pb-4 mb-6">
                 <h1 className="text-2xl font-black uppercase text-slate-800">{selectedParty?.name || 'Party Statement'}</h1>
                 <p className="text-sm font-medium text-slate-600 mt-1">{selectedParty?.address} {selectedParty?.city}</p>
                 <div className="flex gap-4 text-xs font-mono text-slate-500 mt-1">
                    <span>Ph: {selectedParty?.phone}</span>
                    <span>GST: {selectedParty?.gstNumber}</span>
                 </div>
              </div>
              
              <div className="flex justify-between items-end mb-4">
                  <div>
                     <p className="text-xs font-bold uppercase text-slate-500">Statement Period</p>
                     <p className="font-bold text-slate-800">{startDate} to {endDate}</p>
                  </div>
                  <div className="text-right">
                      <p className="text-xs font-bold uppercase text-slate-500">Total Invoices</p>
                      <p className="font-bold text-slate-800">{filteredInvoices.length}</p>
                  </div>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-sm">
                  <thead>
                      <tr className="bg-slate-100 uppercase text-xs font-bold text-slate-700">
                          <th className="border border-slate-300 p-2 text-left">Date</th>
                          <th className="border border-slate-300 p-2 text-left">Invoice #</th>
                          <th className="border border-slate-300 p-2 text-center">Total Qty</th>
                          <th className="border border-slate-300 p-2 text-right">Amount</th>
                      </tr>
                  </thead>
                  <tbody>
                      {filteredInvoices.map(inv => (
                          <tr key={inv.id}>
                              <td className="border border-slate-300 p-2 text-slate-700">{inv.date}</td>
                              <td className="border border-slate-300 p-2 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                              <td className="border border-slate-300 p-2 text-center text-slate-600">{calculateQty(inv)}</td>
                              <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                          </tr>
                      ))}
                      {filteredInvoices.length === 0 && (
                          <tr><td colSpan={4} className="border border-slate-300 p-4 text-center text-slate-400">No records found.</td></tr>
                      )}
                  </tbody>
                  {filteredInvoices.length > 0 && (
                      <tfoot>
                          <tr className="bg-slate-50 font-bold">
                             <td colSpan={2} className="border border-slate-300 p-2 text-right uppercase text-xs">Total</td>
                             <td className="border border-slate-300 p-2 text-center">{filteredInvoices.reduce((sum, inv) => sum + calculateQty(inv), 0)}</td>
                             <td className="border border-slate-300 p-2 text-right">₹{totalAmount.toLocaleString('en-IN')}</td>
                          </tr>
                      </tfoot>
                  )}
              </table>
          </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-slate-600" /> All Logs & Audit
          </h2>
          <p className="text-slate-500 text-sm">View, search, and audit transaction history.</p>
        </div>
        <div className="flex gap-2">
             {selectedPartyId && (
                 <button
                 onClick={handleDownloadPDF}
                 disabled={filteredInvoices.length === 0 || isGeneratingPdf}
                 className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
                 >
                 {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                 Download Statement PDF
                 </button>
             )}
            <button
            onClick={handleDownloadCSV}
            disabled={filteredInvoices.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
            >
            <Download size={18} /> Download CSV
            </button>
        </div>
      </div>

      {/* Filters & Summary Dashboard */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
             
             {/* Party Filter (New) */}
             <div className="md:col-span-3">
                 <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Filter By Party</label>
                 <div className="relative">
                    <select 
                        value={selectedPartyId}
                        onChange={(e) => setSelectedPartyId(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-medium text-slate-700 bg-white appearance-none cursor-pointer"
                    >
                        <option value="">All Parties</option>
                        {parties.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                 </div>
             </div>

             {/* Search Input */}
             <div className="md:col-span-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search Invoice #, Vehicle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-slate-900 font-medium bg-white"
                />
             </div>

             {/* Date Range Inputs */}
             <div className="md:col-span-3 flex items-center gap-2">
                 <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">From</label>
                    <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none text-slate-700 bg-white"
                    />
                 </div>
                 <div className="flex-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">To</label>
                    <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none text-slate-700 bg-white"
                    />
                 </div>
             </div>

             {/* Live Summary Stats */}
             <div className={`md:col-span-3 flex items-center justify-between md:justify-end gap-6 rounded-lg px-4 py-2 border ${searchTerm || selectedPartyId ? 'bg-sky-50 border-sky-100' : 'bg-slate-50 border-slate-100'}`}>
                 <div className="text-right">
                     <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Invoices</div>
                     <div className="text-lg font-bold text-slate-800 leading-none">{totalCount}</div>
                 </div>
                 <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                 <div className="text-right">
                     <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{searchTerm || selectedPartyId ? 'Filtered' : 'Total'} Value</div>
                     <div className="text-lg font-black text-emerald-600 leading-none">₹{totalAmount.toLocaleString('en-IN')}</div>
                 </div>
             </div>
          </div>
      </div>

      {/* Invoice List Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b border-slate-200">
                <tr>
                <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Party</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider text-center">Qty</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">Items</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider text-center">Details</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map(inv => (
                <React.Fragment key={inv.id}>
                    <tr className={`transition-colors cursor-pointer ${expandedId === inv.id ? 'bg-sky-50/50' : 'hover:bg-slate-50'}`} onClick={() => toggleExpand(inv.id)}>
                    <td className="px-6 py-4 font-mono text-sm font-bold text-slate-700">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2"><Calendar size={14} className="text-slate-400"/> {inv.date}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                        <div className="flex items-center gap-2"><User size={14} className="text-slate-400"/> {inv.partyName}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-center text-slate-600 bg-slate-50/50">
                        {calculateQty(inv)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-slate-500">{(inv.items || []).length}</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-slate-800">₹{(inv.grandTotal || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                        <button className={`p-1 rounded-full transition-colors ${expandedId === inv.id ? 'bg-sky-200 text-sky-700' : 'text-slate-400 hover:bg-slate-100'}`}>
                        {expandedId === inv.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                    </td>
                    </tr>
                    {expandedId === inv.id && (
                    <tr className="bg-slate-50/50 shadow-inner">
                        <td colSpan={7} className="px-6 py-4">
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-2 duration-200">
                            <div className="bg-slate-50 p-3 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                    <span className="text-slate-500 font-bold block uppercase text-[10px]">Vehicle No</span>
                                    <span className="text-slate-800 flex items-center gap-1"><Truck size={14}/> {inv.vehicleNumber || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-bold block uppercase text-[10px]">Reference / PO</span>
                                    <span className="text-slate-800">{inv.poNumber || '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-bold block uppercase text-[10px]">Tax Amount</span>
                                    <span className="text-slate-800">₹{(inv.taxAmount || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 font-bold block uppercase text-[10px]">Discount</span>
                                    <span className="text-red-600">₹{(inv.globalDiscount || 0).toFixed(2)}</span>
                                </div>
                            </div>
                            
                            <table className="w-full text-sm">
                            <thead className="bg-slate-100/50 text-slate-500 text-xs uppercase font-semibold">
                                <tr>
                                <th className="px-4 py-2 text-left">Product</th>
                                <th className="px-4 py-2 text-center">Weight</th>
                                <th className="px-4 py-2 text-center">Qty</th>
                                <th className="px-4 py-2 text-right">Rate</th>
                                <th className="px-4 py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {inv.items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="px-4 py-2 text-slate-700 flex items-center gap-2">
                                        <Package size={14} className="text-slate-300" />
                                        {item.productName}
                                    </td>
                                    <td className="px-4 py-2 text-center text-slate-500 font-medium">
                                        {item.weight ? item.weight : '-'}
                                    </td>
                                    <td className="px-4 py-2 text-center text-slate-600 font-mono">{item.quantity}</td>
                                    <td className="px-4 py-2 text-right text-slate-600 font-mono">₹{(item.rate || 0).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right font-medium text-slate-800 font-mono">₹{(item.total || 0).toFixed(2)}</td>
                                </tr>
                                ))}
                            </tbody>
                            </table>
                        </div>
                        </td>
                    </tr>
                    )}
                </React.Fragment>
                ))}
            </tbody>
            </table>
            {filteredInvoices.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                    <FileText size={48} className="mb-4 opacity-20" />
                    <p>No logs found matching your search.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
