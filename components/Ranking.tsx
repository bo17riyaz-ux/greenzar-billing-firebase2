import React, { useState, useMemo } from 'react';
import { Invoice, Party } from '../types';
import { Search, Trophy, Filter, Download, DollarSign, ListOrdered, X, Scale } from 'lucide-react';
import { formatWeight, getLocalDateString } from '../utils';

interface Props {
  invoices: Invoice[];
  parties: Party[];
}

export const Ranking: React.FC<Props> = ({ invoices, parties }) => {
  // Default to current month
  const today = new Date();
  const firstDay = getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDay = getLocalDateString(today);

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [sortBy, setSortBy] = useState<'amount' | 'count'>('amount');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Calculate Aggregates for Date Range
  const topParties = useMemo(() => {
    const agg: Record<string, { partyId: string, partyName: string, total: number, count: number, weight: number }> = {};
    
    invoices.forEach(inv => {
      if (inv.date >= startDate && inv.date <= endDate) {
        const totalAmount = Number(inv.grandTotal) || 0;
        
        // Calculate weight for this invoice if not explicitly stored
        const invWeight = (inv.items || []).reduce((sum, item) => {
          if (!item.weight) return sum;
          const w = parseFloat(item.weight.replace(/[^0-9.]/g, ''));
          return isNaN(w) ? sum : sum + (w * (item.quantity || 0));
        }, 0);
        
        if (!agg[inv.partyId]) {
          agg[inv.partyId] = { 
             partyId: inv.partyId, 
             partyName: inv.partyName || 'Unknown', 
             total: 0, 
             count: 0,
             weight: 0
          };
        }
        agg[inv.partyId].total += totalAmount;
        agg[inv.partyId].count += 1;
        agg[inv.partyId].weight += invWeight;
      }
    });

    return Object.values(agg).sort((a, b) => {
        if (sortBy === 'amount') {
            return b.total - a.total;
        } else {
            return b.count - a.count;
        }
    });
  }, [invoices, startDate, endDate, sortBy]);

  // 2. Filter List by Search Term
  const displayedParties = useMemo(() => {
      if (!searchTerm) return topParties.slice(0, 50); // Show top 50 by default
      return topParties.filter(p => p.partyName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [topParties, searchTerm]);

  // 3. Calculate Totals (Logic Update: If searching, use filtered list. If not, use ALL parties in date range)
  const summarySource = searchTerm ? displayedParties : topParties;
  const totalVolume = summarySource.reduce((sum, p) => sum + p.total, 0);
  const totalInvoices = summarySource.reduce((sum, p) => sum + p.count, 0);

  const handleDownload = () => {
     let csv = "Rank,Party Name,Invoice Count,Total Weight,Total Sales\n";
     const listToExport = searchTerm ? displayedParties : topParties;
     
     listToExport.forEach((p, idx) => {
         csv += `${idx + 1},"${p.partyName}",${p.count},"${p.weight > 0 ? formatWeight(p.weight.toString()) : '-'}",${p.total}\n`;
     });
     
     const link = document.createElement("a");
     link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv));
     link.setAttribute("download", `Ranking_Report_${startDate}_to_${endDate}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Trophy className="text-yellow-500" /> Sales Ranking
          </h2>
          <p className="text-slate-500">Analyze performance by Customer (Party) for specific dates.</p>
        </div>
        
        <button 
            onClick={handleDownload}
            disabled={topParties.length === 0}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
        >
            <Download size={18} /> Download Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
        
        {/* Filters */}
        <div className="md:col-span-5 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-500 font-bold uppercase text-xs mb-3">
                <Filter size={14} /> Date Range
            </div>
            <div className="flex items-end gap-2">
                <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">From</label>
                    <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                </div>
                <div className="pb-2 text-slate-400 font-bold">-</div>
                <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">To</label>
                    <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                </div>
            </div>
        </div>

        {/* Sort & Search */}
        <div className="md:col-span-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
             <div className="flex items-center gap-2 text-slate-500 font-bold uppercase text-xs mb-3">
                <ListOrdered size={14} /> Sort & Find
            </div>
            <div className="flex gap-2">
                <div className="flex bg-slate-100 rounded-lg p-1 shrink-0">
                    <button 
                    onClick={() => setSortBy('amount')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${sortBy === 'amount' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <DollarSign size={14} />
                    </button>
                    <button 
                    onClick={() => setSortBy('count')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${sortBy === 'count' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        #
                    </button>
                </div>
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search Party Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-6 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none font-medium"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Total Summary Card */}
        <div className={`md:col-span-3 border p-4 rounded-xl flex flex-col justify-center transition-colors ${searchTerm ? 'bg-emerald-50 border-emerald-100' : 'bg-sky-50 border-sky-100'}`}>
            <p className={`text-[10px] uppercase font-bold mb-1 ${searchTerm ? 'text-emerald-600' : 'text-sky-600'}`}>
                {searchTerm ? 'Selected Total' : `Total ${sortBy === 'amount' ? 'Sales' : 'Invoices'}`}
            </p>
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">
                    {sortBy === 'amount' ? `₹${totalVolume.toLocaleString('en-IN')}` : totalInvoices}
                </h3>
                <div className={`p-2 rounded-lg ${searchTerm ? 'bg-emerald-200 text-emerald-700' : 'bg-sky-200 text-sky-700'}`}>
                    {sortBy === 'amount' ? <DollarSign size={16} /> : <ListOrdered size={16} />}
                </div>
            </div>
        </div>
      </div>

      {/* Ranking List */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
         <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
             <div className="col-span-2 text-center">Rank</div>
             <div className="col-span-4">Party Name</div>
             <div className="col-span-2 text-center">Invoices</div>
             <div className="col-span-2 text-center">Total Weight</div>
             <div className={`col-span-2 text-right ${sortBy === 'amount' ? 'text-sky-700 font-black' : ''}`}>Total Sales</div>
         </div>
         
         <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
             {displayedParties.map((party, index) => {
                 let medalColor = "bg-slate-100 text-slate-500";
                 // Highlight ranks only if not searching (since searching breaks rank order relative to global)
                 if (!searchTerm) {
                    if (index === 0) medalColor = "bg-yellow-100 text-yellow-700 border border-yellow-200";
                    if (index === 1) medalColor = "bg-slate-200 text-slate-600 border border-slate-300";
                    if (index === 2) medalColor = "bg-orange-100 text-orange-700 border border-orange-200";
                 }

                 return (
                    <div key={party.partyId} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                        <div className="col-span-2 flex justify-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${medalColor}`}>
                                {index + 1}
                            </div>
                        </div>
                        <div className="col-span-4">
                            <div className="font-bold text-slate-800 text-base">{party.partyName}</div>
                            {searchTerm && <div className="text-[10px] text-emerald-600 font-bold uppercase flex items-center gap-1">Match Found</div>}
                        </div>
                        <div className={`col-span-2 text-center font-medium ${sortBy === 'count' ? 'text-lg text-slate-800 font-bold' : 'text-slate-600'}`}>
                            {party.count}
                        </div>
                        <div className="col-span-2 text-center">
                            <div className="text-xs font-bold text-slate-600 bg-slate-100 py-1 px-2 rounded-full inline-flex items-center gap-1">
                                <Scale size={10} className="text-slate-400" />
                                {party.weight > 0 ? formatWeight(party.weight.toString()) : '-'}
                            </div>
                        </div>
                        <div className={`col-span-2 text-right ${sortBy === 'amount' ? 'font-black text-slate-800 text-lg' : 'text-slate-600 font-medium'}`}>
                            ₹{party.total.toLocaleString('en-IN')}
                        </div>
                    </div>
                 );
             })}
             
             {displayedParties.length === 0 && (
                 <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                    <Trophy size={48} className="mb-4 opacity-20" />
                    <p>{searchTerm ? 'No parties found matching your search.' : 'No billing data found for this date range.'}</p>
                 </div>
             )}
         </div>
      </div>
    </div>
  );
};