import React, { useState, useEffect } from 'react';
import { Party, Product, SpecialRate } from '../types';
import { Search, Check, CloudLightning, Grid, LayoutList, ArrowLeft } from 'lucide-react';

interface Props {
  parties: Party[];
  products: Product[];
  specialRates: SpecialRate[];
  setSpecialRates: (r: SpecialRate[]) => void;
}

export const RateManager: React.FC<Props> = ({ parties, products, specialRates, setSpecialRates }) => {
  // CHANGED: Default is now 'matrix' to show rows of products per party
  const [viewMode, setViewMode] = useState<'detail' | 'matrix'>('matrix');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  
  // Search States
  const [filterText, setFilterText] = useState('');
  const [partySearch, setPartySearch] = useState('');
  
  // Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'pending'>('saved');

  // --- MATRIX STATE ---
  // We store a local copy of rates for the matrix to allow fast edits
  // Key: `${partyId}_${productId}` -> rate
  const [matrixMap, setMatrixMap] = useState<Record<string, number>>({});

  useEffect(() => {
    // Flatten rates for O(1) lookup
    const map: Record<string, number> = {};
    specialRates.forEach(r => {
      map[`${r.partyId}_${r.productId}`] = r.rate;
    });
    setMatrixMap(map);
  }, [specialRates]);

  // --- SAVING LOGIC ---
  // We debounce the save operation so we don't spam the parent/API
  useEffect(() => {
    if (saveStatus !== 'pending') return;

    const timer = setTimeout(() => {
        setSaveStatus('saving');
        
        // Convert matrixMap back to array
        const newRates: SpecialRate[] = [];
        Object.entries(matrixMap).forEach(([key, val]) => {
           const rate = val as number;
           const [pId, prodId] = key.split('_');
           if (rate > 0) {
               newRates.push({ partyId: pId, productId: prodId, rate });
           }
        });

        setSpecialRates(newRates);
        setSaveStatus('saved');
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timer);
  }, [matrixMap, saveStatus, setSpecialRates]);

  const handleRateChange = (partyId: string, productId: string, val: string) => {
    setSaveStatus('pending');
    const num = parseFloat(val);
    const key = `${partyId}_${productId}`;
    const newMap = { ...matrixMap };
    
    if (!isNaN(num) && val !== '') {
        newMap[key] = num;
    } else {
        delete newMap[key];
    }
    setMatrixMap(newMap);
  };

  // --- FILTERING ---
  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(partySearch.toLowerCase())
  );
  
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(filterText.toLowerCase()) || 
    p.code.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
      
      {/* TOOLBAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm z-20">
         <div className="flex items-center gap-4">
             <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button 
                  onClick={() => setViewMode('matrix')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'matrix' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Grid size={16} /> Grid Matrix
                </button>
                <button 
                  onClick={() => setViewMode('detail')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'detail' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutList size={16} /> Detail View
                </button>
             </div>

             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                saveStatus === 'saved' ? 'text-slate-400 bg-slate-50' : 
                saveStatus === 'saving' ? 'text-emerald-600 bg-emerald-50' :
                'text-orange-500 bg-orange-50'
             }`}>
                {saveStatus === 'saved' ? <Check size={14}/> : <CloudLightning size={14} className={saveStatus === 'saving' ? 'animate-pulse' : ''} />}
                {saveStatus === 'saved' ? 'All Changes Saved' : saveStatus === 'saving' ? 'Syncing...' : 'Unsaved Changes'}
             </div>
         </div>

         <div className="flex items-center gap-3">
             {viewMode === 'detail' ? (
                 <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search items..." 
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                 </div>
             ) : (
                 <div className="text-xs text-slate-400 font-medium italic">
                    Grid View: {parties.length} Parties x {products.length} Products
                 </div>
             )}
         </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
         
         {/* --- DETAIL VIEW (Original) --- */}
         {viewMode === 'detail' && (
            <div className="flex h-full">
                {/* Sidebar */}
                <div className="w-72 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden">
                   <div className="p-3 border-b border-slate-100 bg-slate-50">
                       <input 
                         type="text" 
                         placeholder="Search Party..." 
                         value={partySearch}
                         onChange={e => setPartySearch(e.target.value)}
                         className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md outline-none focus:border-sky-400"
                       />
                   </div>
                   <div className="overflow-y-auto flex-1">
                      {filteredParties.map(p => {
                         const isActive = selectedPartyId === p.id;
                         return (
                            <button 
                              key={p.id}
                              onClick={() => setSelectedPartyId(p.id)}
                              className={`w-full text-left px-4 py-3 border-b border-slate-50 text-sm font-medium transition-colors ${isActive ? 'bg-sky-50 text-sky-700 border-sky-200' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                {p.name}
                            </button>
                         )
                      })}
                   </div>
                </div>

                {/* Main */}
                <div className="flex-1 overflow-y-auto bg-slate-50/30 p-0">
                    {selectedPartyId ? (
                        <div className="bg-white min-h-full">
                           <table className="w-full text-left">
                              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm text-xs uppercase font-bold text-slate-500">
                                 <tr>
                                    <th className="px-6 py-3 w-1/4">Product</th>
                                    <th className="px-6 py-3 w-1/4 text-right">Std Rate</th>
                                    <th className="px-6 py-3 w-1/4 text-center">Your Rate</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {filteredProducts.map(prod => {
                                     const key = `${selectedPartyId}_${prod.id}`;
                                     const rate = matrixMap[key];
                                     const isCustom = rate !== undefined;
                                     return (
                                        <tr key={prod.id} className="hover:bg-slate-50">
                                           <td className="px-6 py-2">
                                              <div className="font-medium text-slate-800 text-sm">{prod.name}</div>
                                              <div className="text-[10px] text-slate-400">{prod.code}</div>
                                           </td>
                                           <td className="px-6 py-2 text-right font-mono text-sm text-slate-400">
                                               {prod.standardRate}
                                           </td>
                                           <td className="px-6 py-2 text-center">
                                              <input 
                                                type="number"
                                                className={`w-24 text-center py-1.5 rounded border text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500 ${isCustom ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-slate-200 text-slate-800'}`}
                                                value={rate ?? ''}
                                                placeholder="-"
                                                onChange={(e) => handleRateChange(selectedPartyId, prod.id, e.target.value)}
                                              />
                                           </td>
                                        </tr>
                                     );
                                 })}
                              </tbody>
                           </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <ArrowLeft size={24} className="mb-2" />
                            <p>Select a party to edit rates</p>
                        </div>
                    )}
                </div>
            </div>
         )}

         {/* --- MATRIX VIEW (New) --- */}
         {viewMode === 'matrix' && (
             <div className="overflow-auto h-full w-full bg-white">
                <table className="w-max border-collapse">
                   <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                      <tr>
                         <th className="sticky left-0 z-20 bg-slate-100 border-b border-r border-slate-300 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider min-w-[200px] text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                             Party Name
                         </th>
                         {products.map(prod => (
                             <th key={prod.id} className="px-2 py-3 border-b border-slate-300 text-[10px] font-bold text-slate-500 uppercase min-w-[100px] text-center">
                                 <div className="truncate w-24 mx-auto" title={prod.name}>{prod.name}</div>
                                 <div className="text-[9px] text-slate-400">Std: {prod.standardRate}</div>
                             </th>
                         ))}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {parties.map(party => (
                         <tr key={party.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 px-4 py-2 text-xs font-bold text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                {party.name}
                            </td>
                            {products.map(prod => {
                                const key = `${party.id}_${prod.id}`;
                                const rate = matrixMap[key];
                                const isCustom = rate !== undefined;
                                return (
                                    <td key={prod.id} className={`p-1 border-r border-slate-100 text-center ${isCustom ? 'bg-sky-50/30' : ''}`}>
                                        <input 
                                          type="number"
                                          className={`w-full text-center py-1.5 rounded text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500 transition-all ${
                                            isCustom ? 'text-sky-700 font-bold bg-white border border-sky-200 shadow-sm' : 'text-slate-400 bg-transparent hover:bg-white border border-transparent hover:border-slate-200'
                                          }`}
                                          value={rate ?? ''}
                                          placeholder="-"
                                          onChange={(e) => handleRateChange(party.id, prod.id, e.target.value)}
                                        />
                                    </td>
                                );
                            })}
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
         )}

      </div>
    </div>
  );
};