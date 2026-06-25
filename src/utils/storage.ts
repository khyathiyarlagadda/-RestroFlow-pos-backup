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


const KEYS = {
  AUTH: 'restroflow_auth',
  USERS: 'restroflow_users',
  SETTINGS: 'restroflow_settings',
  CATEGORIES: 'restroflow_categories',
  MENU: 'restroflow_menu',
  TABLES: 'restroflow_tables',
  SALES: 'restroflow_sales',
  INVENTORY: 'restroflow_inventory',
  CUSTOMERS: 'restroflow_customers',
  TOKEN_SEQ: 'restroflow_token_seq',
  HOLD_SEQ: 'restroflow_hold_seq',
  KOT: 'restroflow_kot',
  ACTIVE_CART: 'restroflow_active_cart' // temporary cart state
};

// Standard safe localStorage helper
function get<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data) return defaultValue;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Error reading key ${key} from localStorage`, error);
    return defaultValue;
  }
}

function set<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing key ${key} to localStorage`, error);
  }
}

// Generate unique IDs
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
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

export const storage = {
  generateId,
  // Auth Session
  getAuth: (): Session | null => get<Session | null>(KEYS.AUTH, null),
  setAuth: (session: Session | null) => set<Session | null>(KEYS.AUTH, session),
  clearAuth: () => localStorage.removeItem(KEYS.AUTH),

  // Users
  getUsers: (): User[] => get<User[]>(KEYS.USERS, []),
  setUsers: (users: User[]) => set<User[]>(KEYS.USERS, users),

  // Settings
  getSettings: (): SystemSettings => get<SystemSettings>(KEYS.SETTINGS, defaultSettings),
  setSettings: (settings: SystemSettings) => set<SystemSettings>(KEYS.SETTINGS, settings),

  // Categories
  getCategories: (): Category[] => get<Category[]>(KEYS.CATEGORIES, []),
  setCategories: (categories: Category[]) => {
    set<Category[]>(KEYS.CATEGORIES, categories);
    window.dispatchEvent(new CustomEvent('categoriesUpdated'));
  },

  // Menu Items
  getMenuItems: (): MenuItem[] => get<MenuItem[]>(KEYS.MENU, []),
  setMenuItems: (items: MenuItem[]) => {
    set<MenuItem[]>(KEYS.MENU, items);
    window.dispatchEvent(new CustomEvent('menuUpdated'));
  },

  // Tables
  getTables: (): Table[] => get<Table[]>(KEYS.TABLES, defaultTables),
  setTables: (tables: Table[]) => set<Table[]>(KEYS.TABLES, tables),

  // Sales History
  getSales: (): SaleInvoice[] => get<SaleInvoice[]>(KEYS.SALES, []),
  setSales: (sales: SaleInvoice[]) => set<SaleInvoice[]>(KEYS.SALES, sales),
  addSale: (sale: SaleInvoice) => {
    const sales = storage.getSales();
    sales.push(sale);
    storage.setSales(sales);
  },

  // Inventory
  getInventory: (): InventoryItem[] => get<InventoryItem[]>(KEYS.INVENTORY, []),
  setInventory: (items: InventoryItem[]) => set<InventoryItem[]>(KEYS.INVENTORY, items),

  // Customers
  getCustomers: (): Customer[] => get<Customer[]>(KEYS.CUSTOMERS, []),
  setCustomers: (customers: Customer[]) => set<Customer[]>(KEYS.CUSTOMERS, customers),
  addCustomer: (customer: Customer) => {
    const customers = storage.getCustomers();
    customers.push(customer);
    storage.setCustomers(customers);
  },

  // KOT
  getKOTs: (): KOT[] => get<KOT[]>(KEYS.KOT, []),
  setKOTs: (kots: KOT[]) => set<KOT[]>(KEYS.KOT, kots),
  addKOT: (kot: KOT) => {
    const kots = storage.getKOTs();
    kots.push(kot);
    storage.setKOTs(kots);
  },

  // Token Number Sequence (Daily Reset)
  getNextTokenNumber: (dateStr: string): string => {
    const seqs = get<{ [date: string]: number }>(KEYS.TOKEN_SEQ, {});
    const currentSeq = seqs[dateStr] || 0;
    const nextSeq = currentSeq + 1;
    seqs[dateStr] = nextSeq;
    set<{ [date: string]: number }>(KEYS.TOKEN_SEQ, seqs);
    return `${dateStr}-${nextSeq}`;
  },

  // Hold Sequence
  getNextHoldNumber: (): string => {
    const lastSeq = get<number>(KEYS.HOLD_SEQ, 0);
    const nextSeq = lastSeq + 1;
    set<number>(KEYS.HOLD_SEQ, nextSeq);
    return `H-${String(nextSeq).padStart(3, '0')}`;
  },

  // Active Cart State (Holds current unsaved cart, or orders on hold)
  // Let's implement active/hold orders using standard storage structure
  getActiveCart: (): any => get<any>(KEYS.ACTIVE_CART, {}),
  setActiveCart: (cart: any) => set<any>(KEYS.ACTIVE_CART, cart),
  clearActiveCart: () => localStorage.removeItem(KEYS.ACTIVE_CART)
};
