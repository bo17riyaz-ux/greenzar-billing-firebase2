
import React from 'react';
import { Invoice, Party } from '../types';
import { formatWeight } from '../utils';

const numberToWords = (num: number): string => {
  const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  const convert = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + convert(n % 100);
    if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + convert(n % 1000);
    if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + convert(n % 100000);
    return convert(Math.floor(n / 10000000)) + 'Crore ' + convert(n % 10000000);
  };

  const numInt = Math.floor(num || 0);
  if (numInt === 0) return 'Zero Rupees Only';
  return `Rupees ${convert(numInt)}Only`; 
};

interface Props {
  invoice: Invoice;
  parties?: Party[];
}

export const InvoiceTemplate: React.FC<Props> = ({ invoice, parties = [] }) => {
  const party = parties.find(p => p.id === invoice.partyId);

  // Recalculate display totals from items
  let displayTaxable = 0;
  let displayCGST = 0;
  let displaySGST = 0;
  let totalCalculatedQty = 0;
  
  (invoice.items || []).forEach(item => {
    const rateVal = item.rate || 0;
    const gstVal = item.gstPercent || 0;
    const rate = item.baseRate || (rateVal / (1 + gstVal/100));
    
    const qty = Number(item.quantity) || 0; 
    const taxableVal = rate * qty;
    const itemTotal = item.total || 0;
    const taxAmount = itemTotal - taxableVal;
    
    displayTaxable += taxableVal;
    displayCGST += taxAmount / 2;
    displaySGST += taxAmount / 2;
    totalCalculatedQty += qty;
  });

  const exactTotal = (invoice.subTotal || 0) - (invoice.globalDiscount || 0);
  const grandTotal = invoice.grandTotal || 0;
  const roundOff = grandTotal - exactTotal;

  const displayGst = invoice.partyGst || party?.gstNumber || 'NO';
  const displayPan = invoice.partyPan || party?.panNumber || '-';
  const displayAadhar = invoice.partyAadhar || party?.aadharNumber || '-';
  
  const cleanPhone = (p?: string) => {
      if (!p) return null;
      const s = p.trim();
      return (s === '-' || s === '0' || s === '') ? null : s;
  };

  const snapshotPhone = cleanPhone(invoice.partyPhone);
  const livePhone = cleanPhone(party?.phone);
  const displayPhone = snapshotPhone || livePhone || '-';

  const displayTotalQty = totalCalculatedQty; 
  
  // FALLBACK: Calculate total weight from items if the totalWeight field is missing from DB
  const autoWeight = (invoice.items || []).reduce((sum, item) => {
    if (!item.weight) return sum;
    const w = parseFloat(item.weight.replace(/[^0-9.]/g, ''));
    return isNaN(w) ? sum : sum + (w * (item.quantity || 0));
  }, 0);
  
  const displayTotalWeight = invoice.totalWeight || (autoWeight > 0 ? autoWeight.toString() : '');

  const partyName = party?.name || invoice.partyName;

  let addressString = invoice.partyAddress || '';
  if (!addressString && party) {
      addressString = [party.address, party.city, party.state, party.pincode].filter(Boolean).join(', ');
  }
  const fullAddress = addressString.toUpperCase();

  return (
      <div className="bg-white text-slate-900 p-8 max-w-[210mm] mx-auto leading-tight font-sans box-border relative min-h-[297mm]">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { margin: 5mm; size: A4; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
            table { width: 100%; border-collapse: collapse; }
            thead { display: table-header-group; }
            tbody { display: table-row-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
          }
        `}} />
        
        {/* Header */}
        <div className="flex justify-between items-start mb-4 border-b border-slate-200 pb-4">
            <div className="flex-1 pr-4">
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2 whitespace-nowrap overflow-hidden">
                GREENZAR FOOD AND BEVERAGE
                </h1>
                
                <div className="text-slate-600 text-[10px] font-medium leading-snug">
                    <div>Jhampa, Deganga, North 24 Parganas</div>
                    <div>Pin: 743423, West Bengal</div>
                    <div>GSTIN: <span className="font-bold text-slate-800">19AASFG3766F1ZW</span></div>
                    <div>Ph: 9874682388 / 9609085462</div>
                    <div>Email: greenzarfood@gmail.com</div>
                </div>
            </div>
            
            <div className="w-auto flex flex-col items-end shrink-0">
                <div className="flex flex-col items-end mb-4">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${invoice.invoiceNumber}`} 
                        alt="QR" 
                        className="w-16 h-16 object-contain mb-1"
                    />
                    <div className="bg-slate-900 text-white font-bold px-3 py-1 tracking-widest text-[10px] uppercase">
                        Tax Invoice
                    </div>
                </div>

                <div className="w-full">
                    <div className="grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-1 text-right text-[10px]">
                        <span className="font-bold text-slate-500 uppercase tracking-wide">Invoice #</span>
                        <span className="font-bold text-slate-900">{invoice.invoiceNumber}</span>
                        
                        <span className="font-bold text-slate-500 uppercase tracking-wide">Date</span>
                        <span className="font-bold text-slate-900">{invoice.date.split('-').reverse().join('/')}</span>
                        
                        <span className="font-bold text-slate-500 uppercase tracking-wide">Vehicle</span>
                        <span className="font-medium text-slate-900">{invoice.vehicleNumber || '-'}</span>
                        
                        <span className="font-bold text-slate-500 uppercase tracking-wide">Total Qty</span>
                        <span className="font-bold text-slate-900">{displayTotalQty}</span>

                        {displayTotalWeight && (
                            <>
                                <span className="font-bold text-slate-500 uppercase tracking-wide">Total Weight</span>
                                <span className="font-bold text-slate-900">{formatWeight(displayTotalWeight)}</span>
                            </>
                        )}

                        <span className="font-bold text-slate-500 uppercase tracking-wide">Party Code</span>
                        <span className="font-bold text-slate-900 font-mono">{party?.code || '-'}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="flex gap-8 mb-6 border-b border-slate-200 pb-4 print:break-inside-avoid">
            <div className="w-1/2">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Bill To</h3>
                <div className="text-sm font-bold text-slate-900 uppercase mb-1">{partyName}</div>
                
                <div className="text-xs mb-2 flex items-center gap-1">
                    <span className="font-medium text-slate-600 text-[10px] uppercase">Ph :</span> 
                    <span className="font-medium text-slate-500">{displayPhone}</span>
                </div>
                
                <div className="text-[10px] text-slate-800 uppercase leading-relaxed mb-3 max-w-[250px] font-medium">{fullAddress}</div>
                
                <div className="text-[10px] space-y-1 text-slate-800 border-t border-slate-100 pt-2">
                    <div className="flex gap-2">
                        <span className="font-bold w-12 text-slate-500">GSTIN</span>
                        <span className="font-mono font-bold">{displayGst}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="font-bold w-12 text-slate-500">Pan</span>
                        <span className="font-mono font-bold">{displayPan}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="font-bold w-12 text-slate-500">Aadhar</span>
                        <span className="font-mono font-bold">{displayAadhar}</span>
                    </div>
                </div>
            </div>

            <div className="w-1/2">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Ship To</h3>
                <div className="text-sm font-bold text-slate-900 uppercase mb-1">{partyName}</div>
                
                <div className="text-xs mb-2 flex items-center gap-1">
                    <span className="font-medium text-slate-500 text-[10px] uppercase">Ph :</span> 
                    <span className="font-medium text-slate-500">{displayPhone}</span>
                </div>

                <div className="text-[10px] text-slate-800 uppercase leading-relaxed mb-2 max-w-[250px] font-medium">{fullAddress}</div>
            </div>
        </div>

        {/* Table - Compact Version */}
        <div className="mb-4">
            <table className="w-full text-right border-collapse">
                <thead>
                    <tr className="bg-slate-100 text-[9px] font-bold uppercase text-slate-600 tracking-wider border-b border-t border-slate-200">
                        <th className="py-1 pl-2 text-left w-8">#</th>
                        <th className="py-1 text-left">Item Description</th>
                        <th className="py-1 text-center">HSN</th>
                        <th className="py-1 text-center">GST</th>
                        <th className="py-1 text-center">Qty</th>
                        <th className="py-1">Rate</th>
                        <th className="py-1">Taxable</th>
                        <th className="py-1">CGST</th>
                        <th className="py-1">SGST</th>
                        <th className="py-1 pr-2">Total</th>
                    </tr>
                </thead>
                <tbody className="text-[9px] font-medium text-slate-800">
                {(invoice.items || []).map((item, idx) => {
                    const gst = item.gstPercent || 0;
                    const itemRate = item.rate || 0;
                    const rate = item.baseRate || (itemRate / (1 + gst/100));
                    const qty = Number(item.quantity) || 0;
                    const taxableVal = rate * qty;
                    const itemTotal = item.total || 0;
                    const taxAmount = itemTotal - taxableVal;
                    const halfTaxAmount = taxAmount / 2;

                    return (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-1 pl-2 text-left text-slate-500">{idx + 1}</td>
                        <td className="py-1 text-left font-bold text-slate-900">{item.productName}</td>
                        <td className="py-1 text-center">{item.hsn || '2201'}</td>
                        <td className="py-1 text-center">{gst}%</td>
                        <td className="py-1 text-center font-bold text-slate-900">{qty}</td>
                        <td className="py-1">{rate.toFixed(2)}</td>
                        <td className="py-1">{taxableVal.toFixed(2)}</td>
                        <td className="py-1">{halfTaxAmount.toFixed(2)}</td>
                        <td className="py-1">{halfTaxAmount.toFixed(2)}</td>
                        <td className="py-1 pr-2 font-bold text-slate-900">{itemTotal.toFixed(2)}</td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
        </div>

        {/* Footer Section - Avoid Page Break Inside */}
        <div className="flex gap-8 items-start border-t border-slate-200 pt-4 print:break-inside-avoid">
            
            {/* Bank Details & Terms */}
            <div className="w-1/2">
                <h4 className="text-[9px] font-bold uppercase tracking-wider text-slate-600 mb-2">Bank Details</h4>
                <div className="bg-slate-50/50 rounded p-3 text-[10px] border border-slate-200 space-y-1 mb-4 text-slate-800">
                    <div className="flex justify-between"><span className="text-slate-600 font-medium">Account Name</span><span className="font-bold">Greenzar Food And Beverage</span></div>
                    <div className="flex justify-between"><span className="text-slate-600 font-medium">Bank Name</span><span className="font-bold">UCO BANK</span></div>
                    <div className="flex justify-between"><span className="text-slate-600 font-medium">Branch</span><span className="font-bold">BADU BR.</span></div>
                    <div className="flex justify-between"><span className="text-slate-600 font-medium">A/C No</span><span className="font-bold font-mono">06710510011188</span></div>
                    <div className="flex justify-between"><span className="text-slate-600 font-medium">IFSC</span><span className="font-bold font-mono">UCBA0000671</span></div>
                </div>

                <div className="text-[9px] text-slate-600 space-y-1 leading-relaxed">
                    <p><span className="font-bold text-slate-800">Terms:</span> 1. Goods once sold will not be taken back.</p>
                    <p>2. Interest @ 18% p.a. charged if payment delayed.</p>
                    <p>3. Complete payment within 7 days of the billing date.</p>
                </div>
            </div>

            {/* Totals */}
            <div className="w-1/2 pl-8">
                <div className="space-y-2 text-[11px] border-b border-slate-200 pb-3 mb-2">
                    <div className="flex justify-between text-slate-600">
                        <span>Taxable Amount</span>
                        <span className="font-semibold text-slate-900">₹{displayTaxable.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                        <span>Add: CGST</span>
                        <span className="font-semibold text-slate-900">₹{displayCGST.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                        <span>Add: SGST</span>
                        <span className="font-semibold text-slate-900">₹{displaySGST.toFixed(2)}</span>
                    </div>
                    {(invoice.globalDiscount || 0) > 0 && (
                        <div className="flex justify-between text-slate-600">
                            <span>Less: Discount</span>
                            <span className="font-medium text-red-600">- {(invoice.globalDiscount || 0).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                        <span>Round Off / Adj.</span>
                        <span className="font-medium text-slate-900">{roundOff.toFixed(2)}</span>
                    </div>
                </div>

                <div className="flex justify-between items-center py-2 mb-4">
                    <span className="font-bold text-sm text-slate-900 uppercase">Grand Total</span>
                    <span className="font-black text-2xl text-slate-900">₹{(invoice.grandTotal || 0).toLocaleString('en-IN')}.00</span>
                </div>

                <div className="text-right mb-8">
                    <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Amount in Words</p>
                    <p className="text-sm font-serif italic text-slate-900 font-medium">{numberToWords(invoice.grandTotal || 0)}</p>
                </div>

                <div className="text-center flex flex-col items-end">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-800 mb-1">Authorized Signatory</p>
                    <p className="text-[8px] text-slate-500">For GREENZAR FOOD AND BEVERAGE</p>
                </div>
            </div>
        </div>
        
        {/* Ledger Summary */}
        {(invoice.showLedger === true && invoice.previousBalance && invoice.previousBalance > 0) && (
            <div className="mt-2 border-t-2 border-dashed border-slate-200 pt-3 print:break-inside-avoid">
                <div className="grid grid-cols-3 gap-6">
                    <div className="text-center border-r border-slate-100">
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Previous Balance</div>
                        <div className="text-xs font-bold text-slate-700">₹{(invoice.previousBalance || 0).toLocaleString('en-IN')}.00</div>
                    </div>
                    <div className="text-center border-r border-slate-100">
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Bill</div>
                        <div className="text-xs font-bold text-slate-700">₹{(invoice.grandTotal || 0).toLocaleString('en-IN')}.00</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[8px] font-bold text-sky-500 uppercase tracking-widest mb-1">Total Outstanding</div>
                        <div className="text-sm font-black text-slate-900 bg-sky-50 py-0.5 rounded px-2 -mx-2">
                           ₹{(invoice.totalBalance || (invoice.previousBalance || 0) + (invoice.grandTotal || 0)).toLocaleString('en-IN')}.00
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Footer Note */}
        <div className="mt-8 pt-4 text-center border-t border-slate-50 print:break-inside-avoid">
             <p className="text-[8px] text-slate-400 font-medium">This Invoice Is Generated Using GREENZAR F & B Official Billing Software.</p>
        </div>

      </div>
  );
};
