
import React, { useEffect, useState } from 'react';
import { Store } from '../services/store';
import { Cloud } from '../services/cloud';
import { Invoice } from '../types';
import { CloudOff, CloudSync, CheckCircle2, AlertCircle } from 'lucide-react';

export const SyncManager: React.FC = () => {
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncResult, setLastSyncResult] = useState<'success' | 'error' | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        const checkSync = async () => {
            const invoices = Store.getInvoices();
            const pending = invoices.filter(inv => inv.syncStatus === 'pending');
            setPendingCount(pending.length);

            if (pending.length === 0 || isSyncing) return;

            // Wait 1 second for data entry to "settle"
            const now = new Date();
            const invoicesToSync = pending.filter(inv => {
                if (!inv.lastUpdated) return true;
                const lastUpdated = new Date(inv.lastUpdated);
                const diff = (now.getTime() - lastUpdated.getTime()) / 1000;
                return diff >= 1; // 1 second delay
            });

            if (invoicesToSync.length > 0) {
                // If we've failed too many times, back off (wait longer)
                if (retryCount > 3) {
                    console.warn(`[SyncManager] Sync paused due to multiple failures (${retryCount}).`);
                    setRetryCount(0); 
                    return;
                }

                setIsSyncing(true);
                setSyncError(null);
                
                try {
                    // Sync master data first to avoid foreign key constraints
                    const parties = Store.getParties();
                    const products = Store.getProducts();
                    const rates = Store.getRates();
                    const users = Store.getUsers();
                    
                    try {
                        await Cloud.syncMasterData(parties, products, rates, users);
                    } catch (e: any) {
                        console.error("[SyncManager] Master data sync failed before batch invoicing.", e);
                        // We continue anyway, but if it fails here, the batch sync will likely fail with FK error.
                        // Throwing here would show a more accurate message to the user:
                        throw new Error(e.message || 'Master data sync failed');
                    }

                    const result = await Cloud.syncInvoicesBatch(invoicesToSync);
                    
                    if (result.success) {
                        const currentInvoices = Store.getInvoices();
                        invoicesToSync.forEach(syncedInv => {
                            const idx = currentInvoices.findIndex(i => i.id === syncedInv.id);
                            if (idx !== -1) {
                                currentInvoices[idx].syncStatus = 'synced';
                            }
                        });
                        Store.saveInvoices(currentInvoices);
                        setLastSyncResult('success');
                        setRetryCount(0);
                    } else {
                        setLastSyncResult('error');
                        setSyncError(result.error || 'Unknown server error');
                        setRetryCount(prev => prev + 1);
                    }
                } catch (e: any) {
                    console.error("[SyncManager] Critical batch sync failure", e);
                    setLastSyncResult('error');
                    setSyncError(e.message || 'Connection failed');
                    setRetryCount(prev => prev + 1);
                } finally {
                    setIsSyncing(false);
                    setTimeout(() => {
                        setLastSyncResult(null);
                        setSyncError(null);
                    }, 5000);
                }
            }
        };

        const interval = setInterval(checkSync, 2000); 
        return () => clearInterval(interval);
    }, [isSyncing, retryCount]);

    if (pendingCount === 0 && !isSyncing && !lastSyncResult) return null;

    return (
        <div className="fixed bottom-4 left-4 z-[999] flex flex-col gap-2 pointer-events-all">
            {isSyncing && (
                <div className="bg-slate-900 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-pulse">
                    <CloudSync size={16} className="animate-spin" />
                    <span>Syncing {pendingCount} entries...</span>
                </div>
            )}
            
            {pendingCount > 0 && !isSyncing && !lastSyncResult && (
                <div className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce">
                    <CloudOff size={16} />
                    <span>{pendingCount} Pending Sync</span>
                </div>
            )}

            {lastSyncResult === 'success' && (
                <div className="bg-emerald-500 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-left duration-300">
                    <CheckCircle2 size={16} />
                    <span>Cloud Sync Complete</span>
                </div>
            )}

            {lastSyncResult === 'error' && (
                <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-2xl flex flex-col gap-1 text-xs font-bold animate-in slide-in-from-left duration-300 max-w-xs">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>Cloud Sync Failed</span>
                    </div>
                    {syncError && <div className="text-[10px] opacity-90 font-mono border-t border-red-400 mt-1 pt-1 leading-tight">{syncError}</div>}
                </div>
            )}
        </div>
    );
};
