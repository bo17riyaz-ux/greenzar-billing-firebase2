import React from 'react';
import { Invoice, Party, Product, SpecialRate } from '../types';
import { FileSpreadsheet, Download, Shield, Database, FileText } from 'lucide-react';
import { exportInvoicesToCSV, exportPartiesToCSV, exportProductsToCSV } from '../services/csv';
import { getLocalDateString } from '../utils';

interface Props {
  invoices: Invoice[];
  parties: Party[];
  products: Product[];
}

export const MoreMenu: React.FC<Props> = ({ invoices, parties, products }) => {

  const downloadCSV = (content: string, filename: string) => {
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + content);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadInvoices = () => {
    const csv = exportInvoicesToCSV(invoices);
    const date = getLocalDateString(new Date());
    downloadCSV(csv, `Greenzar_Invoices_All_${date}.csv`);
  };

  const handleDownloadParties = () => {
    const csv = exportPartiesToCSV(parties);
    downloadCSV(csv, `Greenzar_Parties.csv`);
  };

  const handleDownloadProducts = () => {
    const csv = exportProductsToCSV(products);
    downloadCSV(csv, `Greenzar_Products.csv`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Database className="text-sky-600" /> More Options
        </h2>
        <p className="text-slate-500">
          Downloads, reports, and extended features.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Main Feature: Download All Invoices */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden group cursor-pointer transition-transform hover:scale-[1.01]" onClick={handleDownloadInvoices}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
                        <FileSpreadsheet size={24} className="text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Download All Invoices</h3>
                    <p className="text-slate-300 max-w-lg">
                        Export your complete invoice register to Excel/CSV format. Includes all line items, tax details, and party information in a single file.
                    </p>
                </div>
                <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20">
                    <Download size={20} />
                    Download CSV
                </button>
            </div>
        </div>

        {/* Secondary Downloads */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={handleDownloadParties}>
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <Shield size={24} />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800">Party List</h4>
                    <p className="text-xs text-slate-500">Master database export</p>
                </div>
            </div>
            <button className="w-full py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Export Parties
            </button>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={handleDownloadProducts}>
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                    <FileText size={24} />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800">Product List</h4>
                    <p className="text-xs text-slate-500">Item & Price database</p>
                </div>
            </div>
            <button className="w-full py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Export Products
            </button>
        </div>

      </div>

      <div className="mt-12 p-6 bg-slate-50 rounded-xl border border-slate-200 text-center">
         <h4 className="font-bold text-slate-700 mb-2">Need Help?</h4>
         <p className="text-sm text-slate-500 mb-4">
            For technical support regarding the billing software, please contact the administrator.
         </p>
         <div className="text-xs font-mono text-slate-400">
            Version 2.4.0 • Greenzar F&B
         </div>
      </div>
    </div>
  );
};