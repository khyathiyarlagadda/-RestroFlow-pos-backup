import Dexie, { type Table as DexieTable } from 'dexie';
import { formatToISODate } from '../utils/dateUtils';
import type {
  SaleInvoice,
  KOT
} from '../types';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface MasterCacheEntry {
  key: string;
  value: any;
  updatedAt: number;
}

export interface OfflineSaleRecord extends SaleInvoice {
  id: string;
  restaurantId: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  lastError?: string;
}

export interface OfflineKOTRecord extends KOT {
  id: string;
  restaurantId: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  lastError?: string;
}

export interface InventoryOperationRecord {
  id: string;
  restaurantId: string;
  inventoryId: string;
  name: string;
  delta: number;
  operationType: 'stock_in' | 'stock_out' | 'sale_deduction';
  unit?: string;
  timestamp: string;
  syncStatus: SyncStatus;
  lastError?: string;
}

export interface LocalTokenSeqRecord {
  id: string; // `${restaurantId}_${dateStr}`
  restaurantId: string;
  dateStr: string;
  seq: number;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface SyncQueueItem {
  id: string;
  actionType: 'SALE' | 'KOT' | 'INVENTORY_DELTA' | 'TOKEN_SEQ' | 'CUSTOMER' | 'TABLE';
  restaurantId: string;
  payload: any;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  retries: number;
  lastError?: string;
}

export class RestroFlowDB extends Dexie {
  masterCache!: DexieTable<MasterCacheEntry, string>;
  offlineSales!: DexieTable<OfflineSaleRecord, string>;
  offlineKOTs!: DexieTable<OfflineKOTRecord, string>;
  inventoryOperations!: DexieTable<InventoryOperationRecord, string>;
  tokenSequences!: DexieTable<LocalTokenSeqRecord, string>;
  syncQueue!: DexieTable<SyncQueueItem, string>;

  constructor() {
    super('RestroFlowOfflineDB');
    this.version(1).stores({
      masterCache: 'key, updatedAt',
      offlineSales: 'id, tokenNo, syncStatus, createdAt, restaurantId',
      offlineKOTs: 'id, tokenNo, syncStatus, timeCreated, restaurantId',
      inventoryOperations: 'id, inventoryId, syncStatus, timestamp, restaurantId',
      tokenSequences: 'id, restaurantId, dateStr, syncStatus',
      syncQueue: 'id, actionType, syncStatus, createdAt, restaurantId'
    });
  }
}

export const db = new RestroFlowDB();

// --- Helper Database Functions ---

export async function saveMasterCache(key: string, value: any): Promise<void> {
  try {
    await db.masterCache.put({
      key,
      value: JSON.parse(JSON.stringify(value)),
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error(`[IndexedDB] Error caching key ${key}:`, err);
  }
}

export async function getMasterCache<T>(key: string): Promise<T | null> {
  try {
    const entry = await db.masterCache.get(key);
    return entry ? (entry.value as T) : null;
  } catch (err) {
    console.error(`[IndexedDB] Error reading cache key ${key}:`, err);
    return null;
  }
}

export async function saveOfflineSale(record: OfflineSaleRecord): Promise<void> {
  await db.offlineSales.put(record);
  await db.syncQueue.put({
    id: record.id,
    actionType: 'SALE',
    restaurantId: record.restaurantId,
    payload: record,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncStatus: record.syncStatus,
    retries: 0
  });
}

export async function saveOfflineKOT(record: OfflineKOTRecord): Promise<void> {
  await db.offlineKOTs.put(record);
  await db.syncQueue.put({
    id: record.id,
    actionType: 'KOT',
    restaurantId: record.restaurantId,
    payload: record,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncStatus: record.syncStatus,
    retries: 0
  });
}

export async function recordInventoryDelta(
  restaurantId: string,
  inventoryId: string,
  name: string,
  delta: number,
  operationType: 'stock_in' | 'stock_out' | 'sale_deduction',
  unit?: string
): Promise<InventoryOperationRecord> {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  
  const record: InventoryOperationRecord = {
    id,
    restaurantId,
    inventoryId,
    name,
    delta,
    operationType,
    unit,
    timestamp: now,
    syncStatus: 'pending'
  };

  await db.inventoryOperations.put(record);
  await db.syncQueue.put({
    id,
    actionType: 'INVENTORY_DELTA',
    restaurantId,
    payload: record,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    retries: 0
  });

  return record;
}

export async function saveTokenSequence(restaurantId: string, dateStr: string, seq: number): Promise<void> {
  const isoDate = formatToISODate(dateStr);
  const id = `${restaurantId}_${isoDate}`;
  const now = new Date().toISOString();
  
  const record: LocalTokenSeqRecord = {
    id,
    restaurantId,
    dateStr: isoDate,
    seq,
    updatedAt: now,
    syncStatus: 'pending'
  };

  await db.tokenSequences.put(record);
  await db.syncQueue.put({
    id,
    actionType: 'TOKEN_SEQ',
    restaurantId,
    payload: record,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    retries: 0
  });
}

export async function getPendingSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    return await db.syncQueue.where('syncStatus').equals('pending').sortBy('createdAt');
  } catch (err) {
    console.error('[IndexedDB] Error fetching pending sync queue:', err);
    return [];
  }
}

export async function updateSyncStatus(
  queueId: string,
  status: SyncStatus,
  errorMsg?: string
): Promise<void> {
  try {
    const item = await db.syncQueue.get(queueId);
    if (!item) return;

    item.syncStatus = status;
    item.updatedAt = new Date().toISOString();
    if (errorMsg) {
      item.lastError = errorMsg;
      item.retries = (item.retries || 0) + 1;
    }
    await db.syncQueue.put(item);

    // Also update corresponding entity table
    if (item.actionType === 'SALE') {
      const sale = await db.offlineSales.get(queueId);
      if (sale) {
        sale.syncStatus = status;
        if (errorMsg) sale.lastError = errorMsg;
        await db.offlineSales.put(sale);
      }
    } else if (item.actionType === 'KOT') {
      const kot = await db.offlineKOTs.get(queueId);
      if (kot) {
        kot.syncStatus = status;
        if (errorMsg) kot.lastError = errorMsg;
        await db.offlineKOTs.put(kot);
      }
    } else if (item.actionType === 'INVENTORY_DELTA') {
      const inv = await db.inventoryOperations.get(queueId);
      if (inv) {
        inv.syncStatus = status;
        if (errorMsg) inv.lastError = errorMsg;
        await db.inventoryOperations.put(inv);
      }
    } else if (item.actionType === 'TOKEN_SEQ') {
      const ts = await db.tokenSequences.get(queueId);
      if (ts) {
        ts.syncStatus = status;
        await db.tokenSequences.put(ts);
      }
    }
  } catch (err) {
    console.error(`[IndexedDB] Error updating sync status for ${queueId}:`, err);
  }
}
