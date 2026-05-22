
import React, { useState, useEffect, useRef } from 'react';
import { Party, Product, SpecialRate, Invoice } from '../types';
import { Database, AlertTriangle, CheckCircle, CloudLightning, ArrowUpCircle, RefreshCw, XCircle, Copy, UploadCloud } from 'lucide-react';
import { Cloud } from '../services/cloud';
import { parsePartiesFromCSV, parseProductsFromCSV, parseRatesMatrixFromCSV, parseInvoicesFromCSV } from '../services/csv';

interface Props {
  parties: Party[];
  products: Product[];
  specialRates: SpecialRate[];
  invoices: Invoice[];
  refreshData: () => void;
  onUrlChange?: (url: string) => void;
  onForcePush?: () => void;
  onImportData?: (type: string, data: any[]) => void;
}

export const DataManager: React.FC<Props> = ({ parties, products, onForcePush, onImportData }) => {
  const [statusMsg, setStatusMsg] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  const fileRefParties = useRef<HTMLInputElement>(null);
  const fileRefProducts = useRef<HTMLInputElement>(null);
  const fileRefRates = useRef<HTMLInputElement>(null);
  const fileRefInvoices = useRef<HTMLInputElement>(null);

  const handleFileUpload = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      try {
        let parsed: any[] = [];
        if (type === 'PARTIES') {
          parsed = parsePartiesFromCSV(text);
          setStatusMsg({ msg: `Imported ${parsed.length} Parties!`, type: 'success' });
        } else if (type === 'PRODUCTS') {
          parsed = parseProductsFromCSV(text);
          setStatusMsg({ msg: `Imported ${parsed.length} Products!`, type: 'success' });
        } else if (type === 'RATES') {
          parsed = parseRatesMatrixFromCSV(text, parties, products);
          setStatusMsg({ msg: `Imported matrix mapping!`, type: 'success' });
        } else if (type === 'INVOICES') {
          parsed = parseInvoicesFromCSV(text, parties, products);
          setStatusMsg({ msg: `Imported ${parsed.length} Invoices!`, type: 'success' });
        }
        
        if (onImportData) {
          onImportData(type, parsed);
        }
      } catch (err) {
        console.error(err);
        setStatusMsg({ msg: `Failed to import: Invalid CSV format.`, type: 'error' });
      }
      // reset
      e.target.value = '';
    };
    reader.readAsText(file);
  };
   
  // Connection State
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    checkSupabaseConnection();
  }, []);

  const checkSupabaseConnection = async () => {
    setConnectionStatus('checking');
    const result = await Cloud.testConnection();
    if (result.success) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('error');
      setConnectionError(result.error || 'Unknown Error');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto pb-20">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Database className="text-sky-600" /> Data Management
        </h2>
        <p className="text-slate-500">
          Sync status and database schema maintenance.
        </p>
      </div>

      {statusMsg && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-5 duration-300 ${statusMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'}`}>
          {statusMsg.type === 'success' ? <CheckCircle /> : <AlertTriangle />}
          <span className="font-bold">{statusMsg.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* CLOUD CONFIG */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 h-fit">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <CloudLightning className="text-sky-500" /> Connection
              </h3>
              <button 
                  onClick={checkSupabaseConnection} 
                  className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 bg-sky-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                  <RefreshCw size={12} className={connectionStatus === 'checking' ? 'animate-spin' : ''} />
                  Test
              </button>
            </div>
            
            <div className="space-y-4">
               {connectionStatus === 'checking' && (
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 animate-pulse">
                      <RefreshCw className="text-slate-400 animate-spin" size={20} />
                      <div>
                        <h4 className="font-bold text-slate-700 text-sm">Connecting...</h4>
                      </div>
                  </div>
               )}

               {connectionStatus === 'connected' && (
                  <div className="flex items-center gap-3 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                      <CheckCircle className="text-emerald-600" size={20} />
                      <div>
                        <h4 className="font-bold text-emerald-900 text-sm">Connected</h4>
                        <p className="text-[10px] text-emerald-700">Database is active.</p>
                      </div>
                  </div>
               )}

               {connectionStatus === 'error' && (
                  <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-200">
                      <XCircle className="text-red-600" size={20} />
                      <div className="flex-1 overflow-hidden">
                        <h4 className="font-bold text-red-900 text-sm">Failed</h4>
                        <p className="text-[10px] text-red-800 truncate">{connectionError}</p>
                      </div>
                  </div>
               )}
            </div>

            <div className="mt-8 border-t border-slate-100 pt-6">
                <h3 className="text-sm font-bold text-slate-600 mb-3">Manual Sync</h3>
                <button 
                  onClick={onForcePush} 
                  disabled={connectionStatus !== 'connected'}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-md transition-all flex justify-center items-center gap-2"
                >
                    <ArrowUpCircle size={18} />
                    Force Upload Local Data
                </button>
                <p className="text-[10px] text-slate-400 mt-2 text-center uppercase font-bold">Use this if the cloud is behind your local data</p>
            </div>
        </div>

        {/* CSV IMPORTER */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                <UploadCloud className="text-sky-500" /> Import Backup Data
            </h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">
                Restore your previous system data by uploading your exported CSV backup files.
            </p>
            
            <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-sm text-slate-700">Parties</h4>
                        <p className="text-[10px] text-slate-400">Import customers and vendors</p>
                    </div>
                    <button 
                        onClick={() => fileRefParties.current?.click()}
                        className="bg-white border border-slate-200 text-slate-700 hover:text-sky-600 hover:border-sky-200 px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
                    >
                        <UploadCloud size={14} /> Upload CSV
                    </button>
                    <input type="file" ref={fileRefParties} accept=".csv" className="hidden" onChange={(e) => handleFileUpload('PARTIES', e)} />
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-sm text-slate-700">Products</h4>
                        <p className="text-[10px] text-slate-400">Import inventory items</p>
                    </div>
                    <button 
                        onClick={() => fileRefProducts.current?.click()}
                        className="bg-white border border-slate-200 text-slate-700 hover:text-sky-600 hover:border-sky-200 px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
                    >
                        <UploadCloud size={14} /> Upload CSV
                    </button>
                    <input type="file" ref={fileRefProducts} accept=".csv" className="hidden" onChange={(e) => handleFileUpload('PRODUCTS', e)} />
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-sm text-slate-700">Special Rates</h4>
                        <p className="text-[10px] text-slate-400">Import matrix mappings</p>
                    </div>
                    <button 
                        onClick={() => fileRefRates.current?.click()}
                        className="bg-white border border-slate-200 text-slate-700 hover:text-sky-600 hover:border-sky-200 px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
                    >
                        <UploadCloud size={14} /> Upload CSV
                    </button>
                    <input type="file" ref={fileRefRates} accept=".csv" className="hidden" onChange={(e) => handleFileUpload('RATES', e)} />
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-sm text-slate-700">Invoices</h4>
                        <p className="text-[10px] text-slate-400">Import invoice histories</p>
                    </div>
                    <button 
                        onClick={() => fileRefInvoices.current?.click()}
                        className="bg-white border border-slate-200 text-slate-700 hover:text-sky-600 hover:border-sky-200 px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
                    >
                        <UploadCloud size={14} /> Upload CSV
                    </button>
                    <input type="file" ref={fileRefInvoices} accept=".csv" className="hidden" onChange={(e) => handleFileUpload('INVOICES', e)} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};