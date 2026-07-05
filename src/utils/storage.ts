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
  }
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

// In-memory cache is used for active session state.
// Master session state is managed entirely by Supabase Auth Client.
const REST_KEY = 'restroflow_restaurant_id';

// Generate unique IDs (fallback)
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export const storage = {
  generateId,
  
  // Cache check/initialization helpers
  getRestaurantId: () => cache.restaurantId,



  getUserProfile: async (userId: string): Promise<any | null> => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("Error fetching user profile:", e);
      return null;
    }
  },

  createRestaurant: async (name: string, logoUrl?: string): Promise<string> => {
    // Check if logo_url exists in restaurants table
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

    // 1. Fetch all data in parallel
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
    ] = await Promise.all([
      supabase.from('system_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
      supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order', { ascending: true }),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId),
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId),
      supabase.from('sales_invoices').select('*').eq('restaurant_id', restaurantId),
      supabase.from('inventory').select('*').eq('restaurant_id', restaurantId),
      supabase.from('customers').select('*').eq('restaurant_id', restaurantId),
      supabase.from('kots').select('*').eq('restaurant_id', restaurantId),
      supabase.from('profiles').select('*').eq('restaurant_id', restaurantId),
      supabase.from('token_sequences').select('*').eq('restaurant_id', restaurantId),
      supabase.from('hold_sequence').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
      supabase.from('active_carts').select('*').eq('restaurant_id', restaurantId).maybeSingle()
    ]);

    // 2. Populate Cache
    if (settingsRes.data) {
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
        showFields: settingsRes.data.show_fields
      };
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

    // If tables table is empty, seed it
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

    cache.sales = (salesRes.data || []).map(s => ({
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

    cache.inventory = (inventoryRes.data || []).map(i => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      quantity: Number(i.quantity),
      lowStockLevel: Number(i.low_stock_level)
    }));

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

    cache.kots = (kotsRes.data || []).map(k => ({
      id: k.id,
      tokenNo: k.token_no,
      tableNo: k.table_no || undefined,
      orderType: k.order_type,
      timeCreated: k.time_created,
      items: k.items,
      status: k.status
    }));

    cache.users = (profilesRes.data || []).map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      email: u.email || undefined,
      role: u.role,
      createdDate: u.created_at,
      status: u.status
    }));

    const tokenSeqs: { [dateStr: string]: number } = {};
    (tokenSeqsRes.data || []).forEach(ts => {
      tokenSeqs[ts.date_str] = ts.seq;
    });
    cache.tokenSeqs = tokenSeqs;

    cache.holdSeq = holdSeqRes.data ? holdSeqRes.data.seq : 0;
    cache.activeCart = activeCartsRes.data ? activeCartsRes.data.cart_data : {};

    // 3. Set up Postgres Realtime synchronization
    supabase.removeAllChannels();
    supabase
      .channel('restroflow-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
        const table = payload.table;

        if (table === 'system_settings') {
          const { data } = await supabase.from('system_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle();
          if (data) {
            cache.settings = {
              cgst: Number(data.cgst),
              sgst: Number(data.sgst),
              gstEnabled: data.gst_enabled,
              gstin: data.gstin || '',
              restaurantName: data.restaurant_name,
              address: data.address || '',
              phone: data.phone || '',
              email: data.email || '',
              currency: data.currency,
              footerMessage: data.footer_message || '',
              printType: data.print_type,
              autoPrint: data.auto_print,
              containerChargeEnabled: data.container_charge_enabled,
              defaultContainerCharge: Number(data.default_container_charge),
              showFields: data.show_fields
            };
            window.dispatchEvent(new CustomEvent('settingsUpdated'));
          }
        } else if (table === 'categories') {
          const { data } = await supabase.from('categories').select('*').eq('restaurant_id', restaurantId).order('sort_order', { ascending: true });
          cache.categories = (data || []).map(c => ({
            id: c.id,
            name: c.name,
            enabled: c.enabled,
            createdAt: c.created_at,
            sortOrder: c.sort_order,
            description: c.description || undefined
          }));
          window.dispatchEvent(new CustomEvent('categoriesUpdated'));
        } else if (table === 'menu_items') {
          const { data } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId);
          cache.menuItems = (data || []).map(m => ({
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
          window.dispatchEvent(new CustomEvent('menuUpdated'));
        } else if (table === 'tables') {
          const { data } = await supabase.from('tables').select('*').eq('restaurant_id', restaurantId);
          cache.tables = (data || []).map(t => ({
            id: t.id,
            number: t.number,
            status: t.status,
            currentOrderId: t.current_order_id || undefined
          })).sort((a, b) => {
            const aNum = parseInt(a.number, 10);
            const bNum = parseInt(b.number, 10);
            return (isNaN(aNum) ? 0 : aNum) - (isNaN(bNum) ? 0 : bNum);
          });
          window.dispatchEvent(new CustomEvent('tablesUpdated'));
        } else if (table === 'sales_invoices') {
          const { data } = await supabase.from('sales_invoices').select('*').eq('restaurant_id', restaurantId);
          cache.sales = (data || []).map(s => ({
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
          window.dispatchEvent(new CustomEvent('salesUpdated'));
        } else if (table === 'inventory') {
          const { data } = await supabase.from('inventory').select('*').eq('restaurant_id', restaurantId);
          cache.inventory = (data || []).map(i => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            quantity: Number(i.quantity),
            lowStockLevel: Number(i.low_stock_level)
          }));
          window.dispatchEvent(new CustomEvent('inventoryUpdated'));
        } else if (table === 'customers') {
          const { data } = await supabase.from('customers').select('*').eq('restaurant_id', restaurantId);
          cache.customers = (data || []).map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || undefined,
            email: c.email || undefined,
            address: c.address || undefined,
            totalOrders: Number(c.total_orders),
            totalSpent: Number(c.total_spent),
            lastVisit: c.last_visit || undefined
          }));
          window.dispatchEvent(new CustomEvent('customersUpdated'));
        } else if (table === 'kots') {
          const { data } = await supabase.from('kots').select('*').eq('restaurant_id', restaurantId);
          cache.kots = (data || []).map(k => ({
            id: k.id,
            tokenNo: k.token_no,
            tableNo: k.table_no || undefined,
            orderType: k.order_type,
            timeCreated: k.time_created,
            items: k.items,
            status: k.status
          }));
          window.dispatchEvent(new CustomEvent('kotUpdated'));
        } else if (table === 'profiles') {
          const { data } = await supabase.from('profiles').select('*').eq('restaurant_id', restaurantId);
          cache.users = (data || []).map(u => ({
            id: u.id,
            username: u.username,
            fullName: u.full_name,
            email: u.email || undefined,
            role: u.role,
            createdDate: u.created_at,
            status: u.status
          }));
          window.dispatchEvent(new CustomEvent('usersUpdated'));
        } else if (table === 'token_sequences') {
          const { data } = await supabase.from('token_sequences').select('*').eq('restaurant_id', restaurantId);
          const tokenSeqs: { [dateStr: string]: number } = {};
          (data || []).forEach(ts => {
            tokenSeqs[ts.date_str] = ts.seq;
          });
          cache.tokenSeqs = tokenSeqs;
        } else if (table === 'hold_sequence') {
          const { data } = await supabase.from('hold_sequence').select('*').eq('restaurant_id', restaurantId).maybeSingle();
          cache.holdSeq = data ? data.seq : 0;
        } else if (table === 'active_carts') {
          const { data } = await supabase.from('active_carts').select('*').eq('restaurant_id', restaurantId).maybeSingle();
          cache.activeCart = data ? data.cart_data : {};
        }
      })
      .subscribe();
  },

  // Auth Session
  getAuth: (): Session | null => cache.auth,
  setAuth: (session: Session | null) => {
    cache.auth = session;
  },
  clearAuth: () => {
    cache.auth = null;
    cache.restaurantId = null;
    supabase.auth.signOut().then();
    supabase.removeAllChannels();
  },

  // Users / profiles
  getUsers: (): User[] => cache.users,
  setUsers: (users: User[]) => {
    cache.users = users;
    window.dispatchEvent(new CustomEvent('usersUpdated'));

    // Sync profiles in the background
    (async () => {
      if (!cache.restaurantId) return;

      // Check if email column exists in profiles table
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

      // Delete profiles not in the new list
      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('profiles').delete().in('id', toDelete);
      }

      // Upsert profiles
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
  getSettings: (): SystemSettings => cache.settings || defaultSettings,
  setSettings: (settings: SystemSettings) => {
    cache.settings = settings;
    window.dispatchEvent(new CustomEvent('settingsUpdated'));

    // Sync in background
    (async () => {
      if (!cache.restaurantId) return;
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
    window.dispatchEvent(new CustomEvent('categoriesUpdated'));

    // Sync in background
    (async () => {
      if (!cache.restaurantId) return;
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
    window.dispatchEvent(new CustomEvent('menuUpdated'));

    // Sync in background
    (async () => {
      if (!cache.restaurantId) return;
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
    window.dispatchEvent(new CustomEvent('tablesUpdated'));

    // Sync in background
    (async () => {
      if (!cache.restaurantId) return;
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
    window.dispatchEvent(new CustomEvent('salesUpdated'));

    // Sync in background
    (async () => {
      if (!cache.restaurantId) return;
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
    const list = [...cache.sales];
    list.push(sale);
    cache.sales = list;
    window.dispatchEvent(new CustomEvent('salesUpdated'));

    // Sync
    (async () => {
      if (!cache.restaurantId) return;
      await supabase.from('sales_invoices').insert({
        restaurant_id: cache.restaurantId,
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
      });
    })().catch(console.error);
  },

  // Inventory
  getInventory: (): InventoryItem[] => cache.inventory,
  setInventory: (items: InventoryItem[]) => {
    cache.inventory = items;
    window.dispatchEvent(new CustomEvent('inventoryUpdated'));

    // Sync in background
    (async () => {
      if (!cache.restaurantId) return;
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
    window.dispatchEvent(new CustomEvent('customersUpdated'));

    // Sync in background
    (async () => {
      if (!cache.restaurantId) return;
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
    window.dispatchEvent(new CustomEvent('customersUpdated'));

    // Sync
    (async () => {
      if (!cache.restaurantId) return;
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
    window.dispatchEvent(new CustomEvent('kotUpdated'));

    // Sync
    (async () => {
      if (!cache.restaurantId) return;
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
    const list = [...cache.kots];
    list.push(kot);
    cache.kots = list;
    window.dispatchEvent(new CustomEvent('kotUpdated'));

    // Sync
    (async () => {
      if (!cache.restaurantId) return;
      await supabase.from('kots').insert({
        id: kot.id,
        restaurant_id: cache.restaurantId,
        token_no: kot.tokenNo,
        table_no: kot.tableNo || null,
        order_type: kot.orderType,
        time_created: kot.timeCreated,
        items: kot.items,
        status: kot.status
      });
    })().catch(console.error);
  },

  // Token numbers
  getNextTokenNumber: (dateStr: string): string => {
    const currentSeq = cache.tokenSeqs[dateStr] || 0;
    const nextSeq = currentSeq + 1;
    cache.tokenSeqs[dateStr] = nextSeq;

    // Sync
    (async () => {
      if (!cache.restaurantId) return;
      await supabase.from('token_sequences').upsert({
        restaurant_id: cache.restaurantId,
        date_str: dateStr,
        seq: nextSeq
      });
    })().catch(console.error);

    return `${dateStr}-${nextSeq}`;
  },

  // Hold numbers
  getNextHoldNumber: (): string => {
    const nextSeq = cache.holdSeq + 1;
    cache.holdSeq = nextSeq;

    // Sync
    (async () => {
      if (!cache.restaurantId) return;
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

    // Sync
    (async () => {
      if (!cache.restaurantId) return;
      await supabase.from('active_carts').upsert({
        restaurant_id: cache.restaurantId,
        cart_data: cart
      });
    })().catch(console.error);
  },
  clearActiveCart: () => {
    cache.activeCart = {};

    // Sync
    (async () => {
      if (!cache.restaurantId) return;
      await supabase.from('active_carts').delete().eq('restaurant_id', cache.restaurantId);
    })().catch(console.error);
  }
};
