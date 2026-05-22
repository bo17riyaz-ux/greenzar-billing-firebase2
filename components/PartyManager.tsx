
import React, { useState } from 'react';
import { Party } from '../types';
import { Plus, Edit2, User, MapPin, Phone, CreditCard, FileText, Search, X, Hash, RefreshCw, Mail, Loader2 } from 'lucide-react';
import { Store } from '../services/store';
import { Cloud } from '../services/cloud';

interface Props {
  parties: Party[];
  setParties: (p: Party[]) => void;
}

export const PartyManager: React.FC<Props> = ({ parties, setParties }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Party>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done'>('idle');

  // --- NEW LOGIC: First Letter + Last Letter + Number (RZ01, RZ02...) ---
  const generateSmartCode = (name: string, excludeId?: string) => {
    if (!name || name.trim().length === 0) return '';
    
    const cleanName = name.trim().toUpperCase();
    const firstChar = cleanName.charAt(0);
    // If name is 1 char, last char is same as first
    const lastChar = cleanName.charAt(cleanName.length - 1);
    
    // Only use letters/numbers for prefix to be safe
    const prefix = `${firstChar}${lastChar}`.replace(/[^A-Z0-9]/g, 'X'); 

    // Find all existing codes that start with this prefix (RZ...)
    // Exclude the current party if we are editing (though usually we don't regen on edit)
    const existingCodes = parties
        .filter(p => p.id !== excludeId && p.code && p.code.startsWith(prefix))
        .map(p => p.code!);

    let maxNum = 0;
    existingCodes.forEach(code => {
        // Extract the part after the prefix (RZ01 -> 01)
        const numPartStr = code.substring(prefix.length);
        const numPart = parseInt(numPartStr);
        if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
        }
    });

    const nextNum = maxNum + 1;
    // Pad with zero (1 -> 01, 10 -> 10)
    return `${prefix}${String(nextNum).padStart(2, '0')}`;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      
      // If we are ADDING a new party (not editing), auto-generate the code
      if (!editingId) {
          const autoCode = generateSmartCode(newName);
          setFormData(prev => ({ ...prev, name: newName, code: autoCode }));
      } else {
          // If editing, just update name, don't change code automatically
          setFormData(prev => ({ ...prev, name: newName }));
      }
  };

  // Bulk Regenerate Button Logic
  const handleRegenAllCodes = () => {
    if(!confirm("This will regenerate codes for ALL parties (RZ01 format). Proceed?")) return;

    // We must process them one by one to handle duplicates correctly
    // Sort roughly by name so RZ01 goes to the "first" Riyaz
    const sortedParties = [...parties].sort((a, b) => a.name.localeCompare(b.name));
    const newPartiesList: Party[] = [];

    // We need a temporary lookup of generated codes to ensure uniqueness during this batch process
    // However, the helper function relies on 'parties' state which isn't updated yet.
    // So we implement a local tracker.
    
    const usedPrefixCounts: Record<string, number> = {};

    sortedParties.forEach(p => {
        const cleanName = p.name.trim().toUpperCase();
        const prefix = (cleanName.length > 0) 
            ? `${cleanName.charAt(0)}${cleanName.charAt(cleanName.length - 1)}`.replace(/[^A-Z0-9]/g, 'X') 
            : 'XX';

        if (!usedPrefixCounts[prefix]) usedPrefixCounts[prefix] = 0;
        usedPrefixCounts[prefix]++;
        
        const num = usedPrefixCounts[prefix];
        const newCode = `${prefix}${String(num).padStart(2, '0')}`;

        newPartiesList.push({ ...p, code: newCode });
    });

    setParties(newPartiesList);
    alert("Codes regenerated successfully!");
  };

  const handleAddNew = () => {
      setFormData({});
      setEditingId(null);
      setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || saveStatus === 'saving') return;
    
    setSaveStatus('saving');
    
    try {
      // Final safety check: if code is empty for some reason, gen it now
      let finalCode = formData.code;
      if (!finalCode) {
          finalCode = generateSmartCode(formData.name, editingId || undefined);
      }

      let updatedParties;
      if (editingId) {
        updatedParties = parties.map(p => p.id === editingId ? { ...p, ...formData, code: finalCode } as Party : p);
      } else {
        const newParty: Party = {
          id: crypto.randomUUID(),
          name: formData.name!,
          code: finalCode!,
          phone: formData.phone || '',
          address: formData.address || '',
          city: formData.city || '',
          gstNumber: formData.gstNumber || '',
          aadharNumber: formData.aadharNumber || '',
          panNumber: formData.panNumber || '',
          email: formData.email || '',
          state: formData.state || '',
          pincode: formData.pincode || '',
        };
        updatedParties = [...parties, newParty];
      }
      
      setParties(updatedParties);
      Store.saveParties(updatedParties);
      
      await Cloud.syncMasterData(updatedParties, Store.getProducts(), Store.getRates(), Store.getUsers());
      
      setSaveStatus('done');
      setTimeout(() => {
        closeForm();
        setSaveStatus('idle');
      }, 1000);
    } catch (err) {
      console.error("Party save failed", err);
      alert("Failed to save party. Please try again.");
      setSaveStatus('idle');
    }
  };

  const openEdit = (party: Party) => {
    setFormData(party);
    setEditingId(party.id);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setFormData({});
    setEditingId(null);
    setIsFormOpen(false);
  };

  // Filter Logic
  const filteredParties = parties.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.code && p.code.toLowerCase().includes(term)) ||
      (p.phone && String(p.phone).toLowerCase().includes(term)) ||
      (p.city && p.city.toLowerCase().includes(term)) ||
      (p.gstNumber && p.gstNumber.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Parties List</h2>
          <p className="text-slate-500">Manage customer details (GST, PAN, Aadhar).</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
               type="text" 
               placeholder="Search parties..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900 shadow-sm"
             />
             {searchTerm && (
               <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
               >
                 <X size={14} />
               </button>
             )}
          </div>
          
          <button 
             onClick={handleRegenAllCodes}
             className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium whitespace-nowrap text-xs"
             title="Regenerate all party codes to RZ01 format"
          >
             <RefreshCw size={16} /> Regen Codes
          </button>

          <button 
            onClick={handleAddNew}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium whitespace-nowrap"
          >
            <Plus size={18} /> Add Party
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4 text-slate-800">{editingId ? 'Edit Party' : 'New Party'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* NAME - Triggers Auto Code */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Party Name *</label>
                  <input 
                    autoFocus
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                    value={formData.name || ''}
                    onChange={handleNameChange}
                    placeholder="Enter name (e.g. Riyaz)"
                    required
                  />
                </div>

                {/* CODE - Auto Generated but editable */}
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Party Code</label>
                   <div className="relative">
                       <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                       <input 
                         className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-mono font-bold text-slate-700 focus:ring-2 focus:ring-sky-500 outline-none"
                         value={formData.code || ''}
                         onChange={e => setFormData({...formData, code: e.target.value})}
                         placeholder="Auto-generated"
                       />
                   </div>
                </div>
                
                {/* CONTACT */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                        <input 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                            value={formData.phone || ''}
                            onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input 
                            type="email"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                            value={formData.email || ''}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            placeholder="Optional"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                        <input 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                            value={formData.city || ''}
                            onChange={e => setFormData({...formData, city: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                        <input 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                            value={formData.state || ''}
                            onChange={e => setFormData({...formData, state: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
                        <input 
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                            value={formData.pincode || ''}
                            onChange={e => setFormData({...formData, pincode: e.target.value})}
                        />
                    </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <textarea 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                    value={formData.address || ''}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    rows={2}
                  />
                </div>

                <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="md:col-span-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-[-8px]">
                    Tax & Identity
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">GST Number</label>
                    <input 
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none uppercase bg-white text-slate-900"
                      value={formData.gstNumber || ''}
                      onChange={e => setFormData({...formData, gstNumber: e.target.value})}
                      placeholder="GSTIN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">PAN Number</label>
                    <input 
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none uppercase bg-white text-slate-900"
                      value={formData.panNumber || ''}
                      onChange={e => setFormData({...formData, panNumber: e.target.value})}
                      placeholder="PAN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Aadhar No</label>
                    <input 
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-900"
                      value={formData.aadharNumber || ''}
                      onChange={e => setFormData({...formData, aadharNumber: e.target.value})}
                      placeholder="UID"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={closeForm} disabled={saveStatus !== 'idle'} className="text-slate-500 hover:text-slate-700 px-4 py-2">Cancel</button>
                <button type="submit" disabled={saveStatus !== 'idle'} className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {saveStatus === 'saving' ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : saveStatus === 'done' ? 'Done!' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Code</th>
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">City / Address</th>
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Phone / Email</th>
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider">GST / PAN</th>
              <th className="px-6 py-4 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredParties.map((party, index) => (
              <tr key={party.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-600 font-mono font-bold px-2 py-1 rounded text-xs border border-slate-200">
                        {party.code || '-'}
                    </span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-800">{party.name}</div>
                  {party.aadharNumber && <div className="text-xs text-slate-400">Aadhar: {party.aadharNumber}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-700">{[party.city, party.state].filter(Boolean).join(', ') || '-'}</div>
                  <div className="text-xs text-slate-500 truncate max-w-[200px]">{[party.address, party.pincode].filter(Boolean).join(' - ')}</div>
                </td>
                <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                  <div>{party.phone || '-'}</div>
                  {party.email && <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Mail size={10}/> {party.email}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    {party.gstNumber ? (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-mono w-fit">
                        GST: {party.gstNumber}
                      </span>
                    ) : <span className="text-xs text-slate-400">-</span>}
                    {party.panNumber && (
                      <span className="text-xs text-slate-500 font-mono">PAN: {party.panNumber}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(party)} className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-full transition-colors"><Edit2 size={16} /></button>
                    {/* Delete button removed per user request */}
                  </div>
                </td>
              </tr>
            ))}
            {filteredParties.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  {searchTerm ? 'No parties matching search.' : 'No parties found. Add one to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
