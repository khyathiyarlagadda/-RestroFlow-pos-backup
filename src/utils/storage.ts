import type {
  User,
  Session,
  Category,
  MenuItem,
  Table,
  SaleInvoice,
  InventoryItem,
  Customer,
  SystemSettings,
  KOT
} from '../types';
import { supabase } from './supabaseClient';
import { networkManager } from './networkManager';
import { formatToISODate, formatFromISODate } from './dateUtils';
import {
  db,
  saveMasterCache,
  getMasterCache,
  saveOfflineSale,
  saveOfflineKOT,
  recordInventoryDelta,
  saveTokenSequence,
  type OfflineSaleRecord,
  type OfflineKOTRecord
} from '../db/indexedDB';
import { syncManager } from '../services/syncManager';

// Cache interface
interface StorageCache {
  auth: Session | null;
  users: User[];
  settings: SystemSettings | null;
  categories: Category[];
  menuItems: MenuItem[];
  tables: Table[];
  sales: SaleInvoice[];
  inventory: InventoryItem[];
  customers: Customer[];
  kots: KOT[];
  activeCart: any;
  tokenSeqs: { [dateStr: string]: number };
  holdSeq: number;
  restaurantId: string | null;
}

const defaultSettings: SystemSettings = {
  cgst: 0,
  sgst: 0,
  gstEnabled: false,
  restaurantName: 'RestroFlow POS',
  address: '',
  phone: '',
  email: '',
  currency: '₹',
  footerMessage: 'Thank you for dining with us!',
  printType: 'Thermal',
  autoPrint: true,
  containerChargeEnabled: false,
  defaultContainerCharge: 0,
  showFields: {
    gstinOnReceipt: false,
    phoneOnReceipt: true,
    emailOnReceipt: false,
    footerOnReceipt: true
  },
  defaultPaymentMethod: 'Cash'
};

const defaultTables: Table[] = [
  { id: 't1', number: '1', status: 'Available' },
  { id: 't2', number: '2', status: 'Available' },
  { id: 't3', number: '3', status: 'Available' },
  { id: 't4', number: '4', status: 'Available' },
  { id: 't5', number: '5', status: 'Available' }
];

let cache: StorageCache = {
  auth: null,
  users: [],
  settings: null,
  categories: [],
  menuItems: [],
  tables: [],
  sales: [],
  inventory: [],
  customers: [],
  kots: [],
  activeCart: {},
  tokenSeqs: {},
  holdSeq: 0,
  restaurantId: null
};

const REST_KEY = 'restroflow_restaurant_id';
const AUTH_KEY = 'restroflow_auth_session';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export const storage = {
  generateId,
  
  getRestaurantId: () => cache.restaurantId || localStorage.getItem(REST_KEY),

  getUserProfile: async (userId: string): Promise<any | null> => {
    try {
      if (networkManager.isOnline && typeof navigator !== 'undefined' && navigator.onLine) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch timeout')), 800)
        );
        const fetchPromise = supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        const res: any = await Promise.race([fetchPromise, timeoutPromise]);
        if (!res.error && res.data) {
          await saveMasterCache(`profile_${userId}`, res.data);
          return res.data;
        }
      }
      return await getMasterCache<any>(`profile_${userId}`);
    } catch (e) {
      console.warn("Using cached profile for user:", userId);
      return await getMasterCache<any>(`profile_${userId}`);
    }
  },

  createRestaurant: async (name: string, logoUrl?: string): Promise<string> => {
    let logoUrlColumnExists = false;
    try {
      const { error: columnError } = await supabase.from('restaurants').select('logo_url').limit(1);
      if (!columnError) {
        logoUrlColumnExists = true;
      } else if (columnError.code !== 'PGRST100' && !columnError.message.includes('does not exist')) {
        logoUrlColumnExists = true;
      }
    } catch {
      logoUrlColumnExists = true;
    }

    const insertRow: any = { name };
    if (logoUrlColumnExists && logoUrl) {
      insertRow.logo_url = logoUrl;
    }

    const { data, error } = await supabase.from('restaurants').insert(insertRow).select('id').single();
    if (error) throw error;
    return data.id;
  },

  initializeSupabase: async (restaurantId: string): Promise<void> => {
    cache.restaurantId = restaurantId;
    localStorage.setItem(REST_KEY, restaurantId);

    const isOffline = typeof navigator !== 'undefined' && (!navigator.onLine || !networkManager.isOnline);

    if (!isOffline) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Supabase fetch timeout')), 1000)
        );

        const fetchPromise = Promise.all([
          supabase.from('system_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
          supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order', { ascending: true }),
          supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
          supabase.from('tables').select('*').eq('restaurant_id', restaurantId),
          supabase.from('sales_invoices').select('*').eq('restaurant_id', restaurantId),
          supabase.from('inventory').select('*').eq('restaurant_id', restaurantId),
          supabase.from('customers').select('*').eq('restaurant_id', restaurantId),
          supabase.from('kots').select('*').eq('restaurant_id', restaurantId),
          supabase.from('profiles').select('*').eq('restaurant_id', restaurantId),
          supabase.from('token_sequences').select('*').eq('restaurant_id', restaurantId).order('date_str', { ascending: true }),
          supabase.from('hold_sequence').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
          supabase.from('active_carts').select('*').eq('restaurant_id', restaurantId).maybeSingle()
        ]);

        const [
          settingsRes,
          categoriesRes,
          menuItemsRes,
          tablesRes,
          salesRes,
          inventoryRes,
          customersRes,
          kotsRes,
          profilesRes,
          tokenSeqsRes,
          holdSeqRes,
          activeCartsRes
        ] = await Promise.race([fetchPromise, timeoutPromise]);

        if (settingsRes.data) {
          const localDefaultPay = localStorage.getItem('restroflow_default_payment_method') as any;
          cache.settings = {
            cgst: Number(settingsRes.data.cgst),
            sgst: Number(settingsRes.data.sgst),
            gstEnabled: settingsRes.data.gst_enabled,
            gstin: settingsRes.data.gstin || '',
            restaurantName: settingsRes.data.restaurant_name,
            address: settingsRes.data.address || '',
            phone: settingsRes.data.phone || '',
            email: settingsRes.data.email || '',
            currency: settingsRes.data.currency,
            footerMessage: settingsRes.data.footer_message || '',
            printType: settingsRes.data.print_type,
            autoPrint: settingsRes.data.auto_print,
            containerChargeEnabled: settingsRes.data.container_charge_enabled,
            defaultContainerCharge: Number(settingsRes.data.default_container_charge),
            showFields: settingsRes.data.show_fields,
            defaultPaymentMethod: localDefaultPay || 'Cash'
          };
          saveMasterCache('settings', cache.settings);
        } else {
          cache.settings = null;
        }

        cache.categories = (categoriesRes.data || []).map(c => ({
          id: c.id,
          name: c.name,
          enabled: c.enabled,
          createdAt: c.created_at,
          sortOrder: c.sort_order,
          description: c.description || undefined
        }));
        saveMasterCache('categories', cache.categories);

        cache.menuItems = (menuItemsRes.data || []).map(m => ({
          id: m.id,
          name: m.name,
          categoryId: m.category_id || '',
          description: m.description || undefined,
          basePrice: Number(m.base_price),
          image: m.image || undefined,
          available: m.available,
          hasVariations: m.has_variations,
          variations: m.variations
        }));
        saveMasterCache('menuItems', cache.menuItems);

        cache.tables = (tablesRes.data || []).map(t => ({
          id: t.id,
          number: t.number,
          status: t.status,
          currentOrderId: t.current_order_id || undefined
        })).sort((a, b) => {
          const aNum = parseInt(a.number, 10);
          const bNum = parseInt(b.number, 10);
          return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
        });

        if (cache.tables.length === 0) {
          cache.tables = defaultTables;
          await supabase.from('tables').insert(defaultTables.map(t => ({
            id: t.id,
            restaurant_id: restaurantId,
            number: t.number,
            status: t.status,
            current_order_id: t.currentOrderId || null
          })));
        }
        saveMasterCache('tables', cache.tables);

        cache.sales = (salesRes.data || []).map(s => ({
          id: s.id,
          tokenNo: s.token_no,
          dateTime: s.date_time,
          customerId: s.customer_id,
          customerName: s.customer_name,
          orderType: s.order_type,
          tableNo: s.table_no || undefined,
          items: s.items,
          subtotal: Number(s.subtotal),
          cgst: Number(s.cgst),
          sgst: Number(s.sgst),
          discount: Number(s.discount),
          roundOff: Number(s.round_off),
          containerCharge: Number(s.container_charge),
          tips: Number(s.tips),
          grandTotal: Number(s.grand_total),
          paymentMethod: s.payment_method,
          paymentDetails: s.payment_details
        }));

        const offlineSales = await db.offlineSales.where('syncStatus').equals('pending').toArray();
        offlineSales.forEach((offSale) => {
          if (!cache.sales.some((s) => s.tokenNo === offSale.tokenNo || s.id === offSale.id)) {
            cache.sales.push(offSale);
          }
        });
        saveMasterCache('sales', cache.sales);

        cache.inventory = (inventoryRes.data || []).map(i => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          quantity: Number(i.quantity),
          lowStockLevel: Number(i.low_stock_level)
        }));
        saveMasterCache('inventory', cache.inventory);

        cache.customers = (customersRes.data || []).map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone || undefined,
          email: c.email || undefined,
          address: c.address || undefined,
          totalOrders: Number(c.total_orders),
          totalSpent: Number(c.total_spent),
          lastVisit: c.last_visit || undefined
        }));
        saveMasterCache('customers', cache.customers);

        cache.kots = (kotsRes.data || []).map(k => ({
          id: k.id,
          tokenNo: k.token_no,
          tableNo: k.table_no || undefined,
          orderType: k.order_type,
          timeCreated: k.time_created,
          items: k.items,
          status: k.status
        }));
        const offlineKOTs = await db.offlineKOTs.where('syncStatus').equals('pending').toArray();
        offlineKOTs.forEach((offKot) => {
          if (!cache.kots.some((k) => k.id === offKot.id)) {
            cache.kots.push(offKot);
          }
        });
        saveMasterCache('kots', cache.kots);

        cache.users = (profilesRes.data || []).map(u => ({
          id: u.id,
          username: u.username,
          fullName: u.full_name,
          email: u.email || undefined,
          role: u.role,
          createdDate: u.created_at,
          status: u.status
        }));
        saveMasterCache('users', cache.users);

        const tokenSeqs: { [dateStr: string]: number } = {};
        (tokenSeqsRes.data || []).forEach(ts => {
          const legacyDateKey = formatFromISODate(ts.date_str);
          const isoDateKey = formatToISODate(ts.date_str);
          const seqVal = Number(ts.seq) || 0;

          tokenSeqs[ts.date_str] = Math.max(tokenSeqs[ts.date_str] || 0, seqVal);
          tokenSeqs[legacyDateKey] = Math.max(tokenSeqs[legacyDateKey] || 0, seqVal);
          tokenSeqs[isoDateKey] = Math.max(tokenSeqs[isoDateKey] || 0, seqVal);

          // Auto-migrate legacy DD-MM-YYYY format to YYYY-MM-DD ISO date format
          if (ts.date_str !== isoDateKey && networkManager.isOnline) {
            (async () => {
              await supabase.from('token_sequences').delete().eq('restaurant_id', restaurantId).eq('date_str', ts.date_str);
              await supabase.from('token_sequences').upsert({
                restaurant_id: restaurantId,
                date_str: isoDateKey,
                seq: ts.seq
              });
            })().catch(console.error);
          }
        });
        cache.tokenSeqs = tokenSeqs;
        saveMasterCache('tokenSeqs', cache.tokenSeqs);

        cache.holdSeq = holdSeqRes.data ? holdSeqRes.data.seq : 0;
        saveMasterCache('holdSeq', cache.holdSeq);

        cache.activeCart = activeCartsRes.data ? activeCartsRes.data.cart_data : {};
        saveMasterCache('activeCart', cache.activeCart);

        // Run sync for any pending items in queue
        syncManager.syncPending().catch(console.error);

      } catch (err) {
        console.warn('[storage] Online fetch failed or timed out. Loading local IndexedDB cache:', err);
        await storage.loadFromIndexedDB();
      }
    } else {
      console.log('[storage] System offline. Loading master data from IndexedDB...');
      await storage.loadFromIndexedDB();
    }
  },

  loadFromIndexedDB: async (): Promise<void> => {
    cache.settings = (await getMasterCache<SystemSettings>('settings')) || defaultSettings;
    cache.categories = (await getMasterCache<Category[]>('categories')) || [];
    cache.menuItems = (await getMasterCache<MenuItem[]>('menuItems')) || [];
    cache.tables = (await getMasterCache<Table[]>('tables')) || defaultTables;
    cache.sales = (await getMasterCache<SaleInvoice[]>('sales')) || [];
    cache.inventory = (await getMasterCache<InventoryItem[]>('inventory')) || [];
    cache.customers = (await getMasterCache<Customer[]>('customers')) || [];
    cache.kots = (await getMasterCache<KOT[]>('kots')) || [];
    cache.users = (await getMasterCache<User[]>('users')) || [];
    cache.tokenSeqs = (await getMasterCache<{ [dateStr: string]: number }>('tokenSeqs')) || {};
    cache.holdSeq = (await getMasterCache<number>('holdSeq')) || 0;
    cache.activeCart = (await getMasterCache<any>('activeCart')) || {};

    // Merge offline pending sales & KOTs into cache
    const offlineSales = await db.offlineSales.where('syncStatus').equals('pending').toArray();
    offlineSales.forEach((offSale) => {
      if (!cache.sales.some((s) => s.tokenNo === offSale.tokenNo || s.id === offSale.id)) {
        cache.sales.push(offSale);
      }
    });

    const offlineKOTs = await db.offlineKOTs.where('syncStatus').equals('pending').toArray();
    offlineKOTs.forEach((offKot) => {
      if (!cache.kots.some((k) => k.id === offKot.id)) {
        cache.kots.push(offKot);
      }
    });

    window.dispatchEvent(new CustomEvent('settingsUpdated'));
    window.dispatchEvent(new CustomEvent('categoriesUpdated'));
    window.dispatchEvent(new CustomEvent('menuUpdated'));
    window.dispatchEvent(new CustomEvent('tablesUpdated'));
    window.dispatchEvent(new CustomEvent('salesUpdated'));
    window.dispatchEvent(new CustomEvent('inventoryUpdated'));
    window.dispatchEvent(new CustomEvent('customersUpdated'));
    window.dispatchEvent(new CustomEvent('kotUpdated'));
    window.dispatchEvent(new CustomEvent('usersUpdated'));
  },

  // Auth Session Management with persistent local storage
  getAuth: (): Session | null => {
    if (!cache.auth) {
      const stored = localStorage.getItem(AUTH_KEY);
      if (stored) {
        try {
          cache.auth = JSON.parse(stored);
        } catch {
          cache.auth = null;
        }
      }
    }
    return cache.auth;
  },

  setAuth: (session: Session | null) => {
    cache.auth = session;
    if (session) {
      console.log('Saving offline session...');
      localStorage.setItem(AUTH_KEY, JSON.stringify(session));
      saveMasterCache('auth_session', session).catch(console.error);
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  },

  clearAuth: () => {
    cache.auth = null;
    cache.restaurantId = null;
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(REST_KEY);
    if (networkManager.isOnline && typeof navigator !== 'undefined' && navigator.onLine) {
      supabase.auth.signOut().catch(() => {});
      supabase.removeAllChannels();
    }
  },

  // Users / profiles
  getUsers: (): User[] => cache.users,
  setUsers: (users: User[]) => {
    cache.users = users;
    saveMasterCache('users', cache.users);
    window.dispatchEvent(new CustomEvent('usersUpdated'));

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;

      let emailColumnExists = false;
      try {
        const { error: columnError } = await supabase.from('profiles').select('email').limit(1);
        if (!columnError) {
          emailColumnExists = true;
        } else if (columnError.code !== 'PGRST100' && !columnError.message.includes('does not exist')) {
          emailColumnExists = true;
        }
      } catch {
        emailColumnExists = true;
      }

      const { data: existing } = await supabase.from('profiles').select('id').eq('restaurant_id', cache.restaurantId);
      const existingIds = (existing || []).map(e => e.id);
      const newIds = users.map(u => u.id);

      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('profiles').delete().in('id', toDelete);
      }

      const upsertData = users.map(u => {
        const row: any = {
          id: u.id,
          restaurant_id: cache.restaurantId,
          username: u.username,
          full_name: u.fullName,
          role: u.role,
          status: u.status
        };
        if (emailColumnExists) {
          row.email = u.email || null;
        }
        return row;
      });

      await supabase.from('profiles').upsert(upsertData);
    })().catch(console.error);
  },

  // Settings
  getSettings: (): SystemSettings => {
    const s = cache.settings || defaultSettings;
    if (!s.defaultPaymentMethod) {
      s.defaultPaymentMethod = (localStorage.getItem('restroflow_default_payment_method') as any) || 'Cash';
    }
    return s;
  },
  setSettings: (settings: SystemSettings) => {
    cache.settings = settings;
    saveMasterCache('settings', cache.settings);
    window.dispatchEvent(new CustomEvent('settingsUpdated'));

    if (settings.defaultPaymentMethod) {
      localStorage.setItem('restroflow_default_payment_method', settings.defaultPaymentMethod);
    }

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      await supabase.from('system_settings').upsert({
        restaurant_id: cache.restaurantId,
        cgst: settings.cgst,
        sgst: settings.sgst,
        gst_enabled: settings.gstEnabled,
        gstin: settings.gstin || null,
        restaurant_name: settings.restaurantName,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        currency: settings.currency,
        footer_message: settings.footerMessage,
        print_type: settings.printType,
        auto_print: settings.autoPrint,
        container_charge_enabled: settings.containerChargeEnabled,
        default_container_charge: settings.defaultContainerCharge,
        show_fields: settings.showFields
      });
    })().catch(console.error);
  },

  // Categories
  getCategories: (): Category[] => cache.categories,
  setCategories: (categories: Category[]) => {
    cache.categories = categories;
    saveMasterCache('categories', cache.categories);
    window.dispatchEvent(new CustomEvent('categoriesUpdated'));

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      const { data: existing } = await supabase.from('categories').select('id').eq('restaurant_id', cache.restaurantId);
      const existingIds = (existing || []).map(e => e.id);
      const newIds = categories.map(c => c.id);

      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('categories').delete().in('id', toDelete);
      }

      await supabase.from('categories').upsert(categories.map(c => ({
        id: c.id,
        restaurant_id: cache.restaurantId,
        name: c.name,
        enabled: c.enabled,
        sort_order: c.sortOrder,
        description: c.description || null
      })));
    })().catch(console.error);
  },

  // Menu Items
  getMenuItems: (): MenuItem[] => cache.menuItems,
  setMenuItems: (items: MenuItem[]) => {
    cache.menuItems = items;
    saveMasterCache('menuItems', cache.menuItems);
    window.dispatchEvent(new CustomEvent('menuUpdated'));

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      const { data: existing } = await supabase.from('menu_items').select('id').eq('restaurant_id', cache.restaurantId);
      const existingIds = (existing || []).map(e => e.id);
      const newIds = items.map(i => i.id);

      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('menu_items').delete().in('id', toDelete);
      }

      await supabase.from('menu_items').upsert(items.map(m => ({
        id: m.id,
        restaurant_id: cache.restaurantId,
        category_id: m.categoryId || null,
        name: m.name,
        description: m.description || null,
        base_price: m.basePrice,
        image: m.image || null,
        available: m.available,
        has_variations: m.hasVariations,
        variations: m.variations
      })));
    })().catch(console.error);
  },

  // Tables
  getTables: (): Table[] => cache.tables,
  setTables: (tables: Table[]) => {
    cache.tables = tables;
    saveMasterCache('tables', cache.tables);
    window.dispatchEvent(new CustomEvent('tablesUpdated'));

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      const { data: existing } = await supabase.from('tables').select('id').eq('restaurant_id', cache.restaurantId);
      const existingIds = (existing || []).map(e => e.id);
      const newIds = tables.map(t => t.id);

      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('tables').delete().in('id', toDelete);
      }

      await supabase.from('tables').upsert(tables.map(t => ({
        id: t.id,
        restaurant_id: cache.restaurantId,
        number: t.number,
        status: t.status,
        current_order_id: t.currentOrderId || null
      })));
    })().catch(console.error);
  },

  // Sales History
  getSales: (): SaleInvoice[] => cache.sales,
  setSales: (sales: SaleInvoice[]) => {
    cache.sales = sales;
    saveMasterCache('sales', cache.sales);
    window.dispatchEvent(new CustomEvent('salesUpdated'));

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      const { data: existing } = await supabase.from('sales_invoices').select('token_no').eq('restaurant_id', cache.restaurantId);
      const existingTokens = (existing || []).map(e => e.token_no);
      const newTokens = sales.map(s => s.tokenNo);

      const toDelete = existingTokens.filter(t => !newTokens.includes(t));
      if (toDelete.length > 0) {
        await supabase.from('sales_invoices').delete().in('token_no', toDelete);
      }

      await supabase.from('sales_invoices').upsert(sales.map(s => ({
        restaurant_id: cache.restaurantId,
        token_no: s.tokenNo,
        date_time: s.dateTime,
        customer_id: s.customerId,
        customer_name: s.customerName,
        order_type: s.orderType,
        table_no: s.tableNo || null,
        items: s.items,
        subtotal: s.subtotal,
        cgst: s.cgst,
        sgst: s.sgst,
        discount: s.discount,
        round_off: s.roundOff,
        container_charge: s.containerCharge,
        tips: s.tips,
        grand_total: s.grandTotal,
        payment_method: s.paymentMethod,
        payment_details: s.paymentDetails
      })));
    })().catch(console.error);
  },
  addSale: (sale: SaleInvoice) => {
    const saleId = (sale as any).id || generateId();
    const now = new Date().toISOString();
    const updatedSale: SaleInvoice & { id: string } = {
      ...sale,
      id: saleId,
      dateTime: sale.dateTime || now
    };

    const list = [...cache.sales];
    list.push(updatedSale);
    cache.sales = list;
    saveMasterCache('sales', cache.sales);
    window.dispatchEvent(new CustomEvent('salesUpdated'));

    if (cache.restaurantId) {
      const offlineRecord: OfflineSaleRecord = {
        ...updatedSale,
        id: saleId,
        restaurantId: cache.restaurantId,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending'
      };

      saveOfflineSale(offlineRecord).then(() => {
        if (networkManager.isOnline && typeof navigator !== 'undefined' && navigator.onLine) {
          syncManager.syncPending().catch(console.error);
        }
      }).catch(console.error);
    }
  },

  // Inventory
  getInventory: (): InventoryItem[] => cache.inventory,
  setInventory: (items: InventoryItem[]) => {
    const oldInventoryMap = new Map(cache.inventory.map(i => [i.id, i.quantity]));
    cache.inventory = items;
    saveMasterCache('inventory', cache.inventory);
    window.dispatchEvent(new CustomEvent('inventoryUpdated'));

    if (cache.restaurantId) {
      const rId = cache.restaurantId;
      items.forEach((item) => {
        const oldQty = oldInventoryMap.get(item.id);
        if (oldQty !== undefined && oldQty !== item.quantity) {
          const delta = item.quantity - oldQty;
          const opType = delta > 0 ? 'stock_in' : 'stock_out';
          recordInventoryDelta(rId, item.id, item.name, delta, opType, item.unit).then(() => {
            if (networkManager.isOnline && typeof navigator !== 'undefined' && navigator.onLine) {
              syncManager.syncPending().catch(console.error);
            }
          }).catch(console.error);
        }
      });
    }

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      const { data: existing } = await supabase.from('inventory').select('id').eq('restaurant_id', cache.restaurantId);
      const existingIds = (existing || []).map(e => e.id);
      const newIds = items.map(i => i.id);

      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('inventory').delete().in('id', toDelete);
      }

      await supabase.from('inventory').upsert(items.map(i => ({
        id: i.id,
        restaurant_id: cache.restaurantId,
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        low_stock_level: i.lowStockLevel
      })));
    })().catch(console.error);
  },

  // Customers
  getCustomers: (): Customer[] => cache.customers,
  setCustomers: (customers: Customer[]) => {
    cache.customers = customers;
    saveMasterCache('customers', cache.customers);
    window.dispatchEvent(new CustomEvent('customersUpdated'));

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      const { data: existing } = await supabase.from('customers').select('id').eq('restaurant_id', cache.restaurantId);
      const existingIds = (existing || []).map(e => e.id);
      const newIds = customers.map(c => c.id);

      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('customers').delete().in('id', toDelete);
      }

      await supabase.from('customers').upsert(customers.map(c => ({
        id: c.id,
        restaurant_id: cache.restaurantId,
        name: c.name,
        phone: c.phone || null,
        email: c.email || null,
        address: c.address || null,
        total_orders: c.totalOrders,
        total_spent: c.totalSpent,
        last_visit: c.lastVisit || null
      })));
    })().catch(console.error);
  },
  addCustomer: (customer: Customer) => {
    const list = [...cache.customers];
    list.push(customer);
    cache.customers = list;
    saveMasterCache('customers', cache.customers);
    window.dispatchEvent(new CustomEvent('customersUpdated'));

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      await supabase.from('customers').insert({
        id: customer.id,
        restaurant_id: cache.restaurantId,
        name: customer.name,
        phone: customer.phone || null,
        email: customer.email || null,
        address: customer.address || null,
        total_orders: customer.totalOrders,
        total_spent: customer.totalSpent,
        last_visit: customer.lastVisit || null
      });
    })().catch(console.error);
  },

  // KOTs
  getKOTs: (): KOT[] => cache.kots,
  setKOTs: (kots: KOT[]) => {
    cache.kots = kots;
    saveMasterCache('kots', cache.kots);
    window.dispatchEvent(new CustomEvent('kotUpdated'));

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      const { data: existing } = await supabase.from('kots').select('id').eq('restaurant_id', cache.restaurantId);
      const existingIds = (existing || []).map(e => e.id);
      const newIds = kots.map(k => k.id);

      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('kots').delete().in('id', toDelete);
      }

      await supabase.from('kots').upsert(kots.map(k => ({
        id: k.id,
        restaurant_id: cache.restaurantId,
        token_no: k.tokenNo,
        table_no: k.tableNo || null,
        order_type: k.orderType,
        time_created: k.timeCreated,
        items: k.items,
        status: k.status
      })));
    })().catch(console.error);
  },
  addKOT: (kot: KOT) => {
    const kotId = kot.id || generateId();
    const now = new Date().toISOString();
    const updatedKOT: KOT = {
      ...kot,
      id: kotId,
      timeCreated: kot.timeCreated || now
    };

    const list = [...cache.kots];
    list.push(updatedKOT);
    cache.kots = list;
    saveMasterCache('kots', cache.kots);
    window.dispatchEvent(new CustomEvent('kotUpdated'));

    if (cache.restaurantId) {
      const offlineRecord: OfflineKOTRecord = {
        ...updatedKOT,
        id: kotId,
        restaurantId: cache.restaurantId,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending'
      };

      saveOfflineKOT(offlineRecord).then(() => {
        if (networkManager.isOnline && typeof navigator !== 'undefined' && navigator.onLine) {
          syncManager.syncPending().catch(console.error);
        }
      }).catch(console.error);
    }
  },

  // Token numbers
  getNextTokenNumber: (dateStr: string): string => {
    const isoDateStr = formatToISODate(dateStr);
    const legacyDateStr = formatFromISODate(dateStr);

    let currentSeq = Math.max(
      cache.tokenSeqs[dateStr] || 0,
      cache.tokenSeqs[isoDateStr] || 0,
      cache.tokenSeqs[legacyDateStr] || 0
    );

    // Also scan existing sales invoices in cache.sales for today's max token number
    const tokenPrefixes = [`${legacyDateStr}-`, `${isoDateStr}-`];
    cache.sales.forEach((s) => {
      if (s.tokenNo) {
        for (const prefix of tokenPrefixes) {
          if (s.tokenNo.startsWith(prefix)) {
            const seqNum = parseInt(s.tokenNo.replace(prefix, ''), 10);
            if (!isNaN(seqNum) && seqNum > currentSeq) {
              currentSeq = seqNum;
            }
          }
        }
      }
    });

    const nextSeq = currentSeq + 1;
    cache.tokenSeqs[dateStr] = nextSeq;
    cache.tokenSeqs[isoDateStr] = nextSeq;
    cache.tokenSeqs[legacyDateStr] = nextSeq;
    saveMasterCache('tokenSeqs', cache.tokenSeqs);

    if (cache.restaurantId) {
      saveTokenSequence(cache.restaurantId, isoDateStr, nextSeq).then(() => {
        if (networkManager.isOnline && typeof navigator !== 'undefined' && navigator.onLine) {
          syncManager.syncPending().catch(console.error);
        }
      }).catch(console.error);
    }

    return `${legacyDateStr}-${nextSeq}`;
  },

  // Hold numbers
  getNextHoldNumber: (): string => {
    const nextSeq = cache.holdSeq + 1;
    cache.holdSeq = nextSeq;
    saveMasterCache('holdSeq', cache.holdSeq);

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      await supabase.from('hold_sequence').upsert({
        restaurant_id: cache.restaurantId,
        seq: nextSeq
      });
    })().catch(console.error);

    return `H-${String(nextSeq).padStart(3, '0')}`;
  },

  // Active Cart State
  getActiveCart: (): any => cache.activeCart,
  setActiveCart: (cart: any) => {
    cache.activeCart = cart;
    saveMasterCache('activeCart', cache.activeCart);

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      await supabase.from('active_carts').upsert({
        restaurant_id: cache.restaurantId,
        cart_data: cart
      });
    })().catch(console.error);
  },
  clearActiveCart: () => {
    cache.activeCart = {};
    saveMasterCache('activeCart', cache.activeCart);

    (async () => {
      if (!cache.restaurantId || !networkManager.isOnline) return;
      await supabase.from('active_carts').delete().eq('restaurant_id', cache.restaurantId);
    })().catch(console.error);
  }
};
