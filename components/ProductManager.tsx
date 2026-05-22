
import React, { useState } from 'react';
import { Product } from '../types';
import { Plus, Edit2, Search, X, Package, ClipboardList, Check, AlertCircle } from 'lucide-react';
import { formatWeight } from '../utils';

interface Props {
  products: Product[];
  setProducts: (p: Product[]) => void;
}

export const ProductManager: React.FC<Props> = ({ products, setProducts }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [detectedProducts, setDetectedProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    gstPercent: 0,
    qtyPerCase: 1,
    standardRate: 0,
    unit: 'Case'
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    let updatedProducts = [...products];
    const productData: Product = {
      id: editingId || crypto.randomUUID(),
      name: formData.name.toUpperCase(),
      code: (formData.code || '').toUpperCase(),
      standardRate: Number(formData.standardRate) || 0,
      unit: formData.unit || 'Case',
      hsn: formData.hsn || '2201',
      gstPercent: Number(formData.gstPercent) || 0,
      qtyPerCase: Number(formData.qtyPerCase) || 1,
      weight: formData.weight || ''
    };

    if (editingId) {
      updatedProducts = products.map(p => p.id === editingId ? productData : p);
    } else {
      updatedProducts.push(productData);
    }
    setProducts(updatedProducts);
    closeForm();
  };

  const handleDetect = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split('\n');
    const newDetected: Product[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 3) return;

      // Extract all numbers
      const numbers = trimmed.match(/(\d+\.?\d*)/g) || [];
      let price = 0;
      let gst = 0;
      let hsn = '2201';
      let name = trimmed;

      // Heuristic for GST (look for number followed by % or just common GST rates)
      const gstMatch = trimmed.match(/(\d+)\s*%/);
      if (gstMatch) {
        gst = parseInt(gstMatch[1]);
        name = name.replace(gstMatch[0], '');
      }

      // Heuristic for Price: 
      // 1. Look for a number with a decimal point
      // 2. Or the largest number that isn't HSN-like (4-8 digits)
      const decimalMatch = trimmed.match(/(\d+\.\d{2})/);
      if (decimalMatch) {
        price = parseFloat(decimalMatch[1]);
        name = name.replace(decimalMatch[0], '');
      } else if (numbers.length > 0) {
        // If no decimal, take the last number that isn't too long (HSN)
        for (let i = numbers.length - 1; i >= 0; i--) {
          const num = numbers[i];
          if (num.length < 4 || num.includes('.')) {
            price = parseFloat(num);
            name = name.replace(num, '');
            break;
          }
        }
      }

      // Heuristic for HSN: Look for 4-8 digit number
      const hsnMatch = trimmed.match(/\b(\d{4,8})\b/);
      if (hsnMatch) {
        hsn = hsnMatch[1];
        name = name.replace(hsnMatch[0], '');
      }

      // Clean up the name
      name = name.replace(/[,|;:\-]/g, ' ').replace(/\s+/g, ' ').trim();

      if (name && name.length > 1) {
        newDetected.push({
          id: crypto.randomUUID(),
          name: name.toUpperCase(),
          code: '',
          standardRate: price,
          unit: 'Case',
          hsn: hsn,
          gstPercent: gst,
          qtyPerCase: 1
        });
      }
    });

    setDetectedProducts(newDetected);
  };

  const confirmImport = () => {
    setProducts([...products, ...detectedProducts]);
    setPasteText('');
    setDetectedProducts([]);
    setIsPasteOpen(false);
  };

  const openEdit = (product: Product) => {
    setFormData(product);
    setEditingId(product.id);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setFormData({ gstPercent: 0, qtyPerCase: 1, standardRate: 0, unit: 'Case' });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* COMPACT HEADER */}
      <div className="flex justify-between items-center mb-4 border-b pb-3">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Package size={20} className="text-[#0088cc]" /> Products
        </h2>
        <div className="flex gap-2">
          <div className="relative">
             <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
             <input 
               type="text" 
               placeholder="Search..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-8 pr-2 py-1.5 border rounded text-sm w-40 md:w-60 outline-none focus:ring-1 focus:ring-[#0088cc]"
             />
          </div>
          <button 
            onClick={() => setIsPasteOpen(true)}
            className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded flex items-center gap-1 font-bold text-sm hover:bg-slate-200"
          >
            <ClipboardList size={16} /> Import
          </button>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-[#0088cc] text-white px-3 py-1.5 rounded flex items-center gap-1 font-bold text-sm"
          >
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      {/* PASTE IMPORT SECTION */}
      {isPasteOpen && (
        <div className="mb-6 bg-sky-50 border border-sky-100 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sky-800 flex items-center gap-2">
              <ClipboardList size={18} /> Paste Product Details
            </h3>
            <button onClick={() => { setIsPasteOpen(false); setDetectedProducts([]); }} className="text-sky-400 hover:text-sky-600">
              <X size={18} />
            </button>
          </div>
          
          <div className="space-y-3">
            <textarea 
              className="w-full h-32 border rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-sky-500 outline-none"
              placeholder="Paste details here... e.g.&#10;COKE 500ML 45.00&#10;PEPSI 250ML 25.00"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-sky-600 uppercase font-bold">
                Tip: Each line should contain a product name and its rate.
              </p>
              <button 
                onClick={handleDetect}
                className="bg-sky-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-sky-700 transition-colors"
              >
                Detect Products
              </button>
            </div>

            {detectedProducts.length > 0 && (
              <div className="mt-4 border-t border-sky-200 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-sky-800 uppercase tracking-wider">Detected ({detectedProducts.length})</h4>
                  <button 
                    onClick={confirmImport}
                    className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-emerald-700 flex items-center gap-1"
                  >
                    <Check size={16} /> Add All
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto border rounded bg-white divide-y">
                  {detectedProducts.map((p, idx) => (
                    <div key={idx} className="p-2 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{p.name}</span>
                      <span className="font-mono text-emerald-600 font-bold">₹{p.standardRate.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMPACT TABLE */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr className="text-[10px] text-slate-400 uppercase font-bold text-left">
              <th className="px-4 py-2">Item Name</th>
              <th className="px-4 py-2 text-center">HSN</th>
              <th className="px-4 py-2 text-center">GST</th>
              <th className="px-4 py-2 text-center">Weight</th>
              <th className="px-4 py-2 text-right">Std. Rate</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredProducts.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-bold uppercase text-slate-800">{p.name}</td>
                <td className="px-4 py-2 text-center font-mono text-slate-500">{p.hsn || '-'}</td>
                <td className="px-4 py-2 text-center font-bold text-sky-600">{p.gstPercent}%</td>
                <td className="px-4 py-2 text-center text-slate-500 font-medium">{formatWeight(p.weight)}</td>
                <td className="px-4 py-2 text-right font-bold text-slate-900">₹{(p.standardRate || 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => openEdit(p)} className="text-slate-300 hover:text-slate-900 p-1"><Edit2 size={14} /></button>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">No items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MINIMAL FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">{editingId ? 'Edit Item' : 'Add Item'}</h3>
                <button onClick={closeForm} className="text-slate-400"><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input 
                autoFocus 
                className="w-full border rounded px-3 py-2 text-sm uppercase font-bold" 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="Product Name" 
                required 
              />
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="number" 
                  step="0.01" 
                  className="w-full border rounded px-3 py-2 text-sm font-bold" 
                  value={formData.standardRate || ''} 
                  onChange={e => setFormData({...formData, standardRate: parseFloat(e.target.value)})} 
                  placeholder="Rate (₹)" 
                  required 
                />
                <input 
                  type="number" 
                  className="w-full border rounded px-3 py-2 text-sm font-bold" 
                  value={formData.gstPercent || ''} 
                  onChange={e => setFormData({...formData, gstPercent: parseInt(e.target.value)})} 
                  placeholder="GST %" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input 
                  className="w-full border rounded px-3 py-2 text-sm font-bold" 
                  value={formData.hsn || ''} 
                  onChange={e => setFormData({...formData, hsn: e.target.value})} 
                  placeholder="HSN Code" 
                />
                <input 
                  className="w-full border rounded px-3 py-2 text-sm font-bold" 
                  value={formData.unit || ''} 
                  onChange={e => setFormData({...formData, unit: e.target.value})} 
                  placeholder="Unit (Case)" 
                />
              </div>
              <input 
                className="w-full border rounded px-3 py-2 text-sm font-bold" 
                value={formData.weight || ''} 
                onChange={e => setFormData({...formData, weight: e.target.value})} 
                placeholder="Default Item Weight" 
              />
              <button type="submit" className="w-full bg-[#0088cc] text-white py-2 rounded font-bold">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
