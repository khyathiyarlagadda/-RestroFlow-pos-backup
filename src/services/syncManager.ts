import { supabase } from '../utils/supabaseClient';
import { networkManager } from '../utils/networkManager';
import { formatToISODate } from '../utils/dateUtils';
import {
  getPendingSyncQueue,
  updateSyncStatus,
  type SyncQueueItem,
  type OfflineSaleRecord,
  type OfflineKOTRecord,
  type InventoryOperationRecord,
  type LocalTokenSeqRecord
} from '../db/indexedDB';

class SyncManager {
  private isSyncing = false;

  constructor() {
    console.log('Sync service initialized');

    networkManager.subscribe((isOnline) => {
      if (isOnline) {
        this.syncPending();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncPending();
      });
    }
  }

  /**
   * Triggers processing of all pending records in the local sync queue.
   */
  public async syncPending(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress. Skipping duplicate run.');
      return { synced: 0, failed: 0 };
    }

    const isOnline = (typeof navigator !== 'undefined' && navigator.onLine) || networkManager.isOnline;
    if (!isOnline) {
      console.log('[SyncManager] Offline mode active. Sync postponed until network returns.');
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingItems = await getPendingSyncQueue();
      if (pendingItems.length === 0) {
        this.isSyncing = false;
        return { synced: 0, failed: 0 };
      }

      console.log('Pending records found');
      console.log(`[SyncManager] Found ${pendingItems.length} pending items to synchronize.`);

      for (const item of pendingItems) {
        const checkOnline = (typeof navigator !== 'undefined' && navigator.onLine) || networkManager.isOnline;
        if (!checkOnline) {
          console.warn('[SyncManager] Connection lost mid-sync. Pausing sync queue.');
          break;
        }

        const success = await this.processSyncItem(item);
        if (success) {
          syncedCount++;
        } else {
          failedCount++;
        }
      }
    } catch (err) {
      console.error('[SyncManager] Fatal error during sync cycle:', err);
    } finally {
      this.isSyncing = false;
    }

    if (syncedCount > 0 || failedCount > 0) {
      console.log(`[SyncManager] Sync cycle completed: ${syncedCount} synced, ${failedCount} failed.`);
      window.dispatchEvent(new CustomEvent('syncCompleted', { detail: { syncedCount, failedCount } }));
    }

    return { synced: syncedCount, failed: failedCount };
  }

  /**
   * Processes a single pending sync queue item idempotently.
   */
  private async processSyncItem(item: SyncQueueItem): Promise<boolean> {
    console.log('Uploading record...', item.id, item.actionType);
    try {
      switch (item.actionType) {
        case 'TOKEN_SEQ':
          await this.syncTokenSeq(item.payload as LocalTokenSeqRecord);
          break;

        case 'SALE':
          await this.syncSale(item.payload as OfflineSaleRecord);
          break;

        case 'KOT':
          await this.syncKOT(item.payload as OfflineKOTRecord);
          break;

        case 'INVENTORY_DELTA':
          await this.syncInventoryDelta(item.payload as InventoryOperationRecord);
          break;

        default:
          console.warn(`[SyncManager] Unknown actionType: ${item.actionType}`);
          break;
      }

      await updateSyncStatus(item.id, 'synced');
      console.log('Upload successful');
      return true;
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.log('Upload failed', errorMsg);
      await updateSyncStatus(item.id, 'failed', errorMsg);
      return false;
    }
  }

  /**
   * Synchronizes daily token sequences to Supabase.
   */
  private async syncTokenSeq(payload: LocalTokenSeqRecord): Promise<void> {
    const isoDateStr = formatToISODate(payload.dateStr);

    const { data: existing } = await supabase
      .from('token_sequences')
      .select('seq')
      .eq('restaurant_id', payload.restaurantId)
      .or(`date_str.eq.${isoDateStr},date_str.eq.${payload.dateStr}`)
      .maybeSingle();

    const maxSeq = existing ? Math.max(existing.seq, payload.seq) : payload.seq;

    const { error } = await supabase.from('token_sequences').upsert({
      restaurant_id: payload.restaurantId,
      date_str: isoDateStr,
      seq: maxSeq
    });

    if (error) throw error;
  }

  /**
   * Synchronizes sales invoices idempotently to Supabase.
   */
  private async syncSale(sale: OfflineSaleRecord): Promise<void> {
    const { data: existing } = await supabase
      .from('sales_invoices')
      .select('id, token_no')
      .eq('restaurant_id', sale.restaurantId)
      .eq('token_no', sale.tokenNo)
      .maybeSingle();

    const insertData: any = {
      restaurant_id: sale.restaurantId,
      token_no: sale.tokenNo,
      date_time: sale.dateTime,
      customer_id: sale.customerId,
      customer_name: sale.customerName,
      order_type: sale.orderType,
      table_no: sale.tableNo || null,
      items: sale.items,
      subtotal: sale.subtotal,
      cgst: sale.cgst,
      sgst: sale.sgst,
      discount: sale.discount,
      round_off: sale.roundOff,
      container_charge: sale.containerCharge,
      tips: sale.tips,
      grand_total: sale.grandTotal,
      payment_method: sale.paymentMethod,
      payment_details: sale.paymentDetails
    };

    if (sale.id && sale.id.length > 20) {
      insertData.id = sale.id;
    } else if (existing?.id) {
      insertData.id = existing.id;
    }

    const { error } = await supabase.from('sales_invoices').upsert(insertData);
    if (error) throw error;
  }

  /**
   * Synchronizes KOTs idempotently to Supabase.
   */
  private async syncKOT(kot: OfflineKOTRecord): Promise<void> {
    const insertData: any = {
      restaurant_id: kot.restaurantId,
      token_no: kot.tokenNo,
      table_no: kot.tableNo || null,
      order_type: kot.orderType,
      time_created: kot.timeCreated,
      items: kot.items,
      status: kot.status
    };

    if (kot.id && kot.id.length > 20) {
      insertData.id = kot.id;
    }

    const { error } = await supabase.from('kots').upsert(insertData);
    if (error) throw error;
  }

  /**
   * Applies inventory operation deltas chronologically to prevent lost stock updates.
   */
  private async syncInventoryDelta(op: InventoryOperationRecord): Promise<void> {
    const { data: invItem, error: fetchErr } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('id', op.inventoryId)
      .eq('restaurant_id', op.restaurantId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!invItem) {
      console.warn(`[SyncManager] Inventory item ${op.inventoryId} not found in Supabase. Skipping delta.`);
      return;
    }

    const currentQty = Number(invItem.quantity) || 0;
    const newQty = Math.max(0, currentQty + op.delta);

    const { error: updateErr } = await supabase
      .from('inventory')
      .update({ quantity: newQty })
      .eq('id', op.inventoryId)
      .eq('restaurant_id', op.restaurantId);

    if (updateErr) throw updateErr;
  }
}

export const syncManager = new SyncManager();
export default syncManager;
