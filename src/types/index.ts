export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'Administrator' | 'Restaurant Owner';
  createdDate: string;
  status: 'active' | 'inactive';
}

export interface Session {
  userId: string;
  username: string;
  role: 'Administrator' | 'Restaurant Owner';
  loginTime: string;
}

export interface Category {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: string; // ISO string
  sortOrder: number;
  description?: string;
}

export interface Variation {
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  description?: string;
  basePrice: number; // Used when hasVariations is false
  image?: string; // base64 string or placeholder path
  available: boolean;
  hasVariations: boolean;
  variations: Variation[];
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  lastVisit?: string;
}

export interface CartItem {
  id: string; // unique cart item id (e.g. itemId + variationName)
  menuItemId: string;
  name: string;
  variationName?: string;
  price: number;
  quantity: number;
}

export type TableStatus = 'Available' | 'Occupied' | 'Billing Pending';

export interface Table {
  id: string;
  number: string;
  status: TableStatus;
  currentOrderId?: string; // orderId if occupied
}

export type OrderType = 'Dine In' | 'Takeaway' | 'Delivery';
export type PaymentMethod = 'Cash' | 'UPI' | 'Card';

export interface SaleInvoice {
  tokenNo: string; // e.g. 2026-06-24-1
  dateTime: string;
  customerId: string;
  customerName: string;
  orderType: OrderType;
  tableNo?: string;
  items: CartItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  discount: number;
  roundOff: number;
  containerCharge: number;
  tips: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentDetails: {
    amountTendered?: number;
    change?: number;
    upiRef?: string;
    cardLast4?: string;
  };
}

export type KOTStatus = 'Pending' | 'Preparing' | 'Ready' | 'Served';

export interface KOT {
  id: string;
  tokenNo: string;
  tableNo?: string;
  orderType: OrderType;
  timeCreated: string;
  items: {
    name: string;
    quantity: number;
    variationName?: string;
  }[];
  status: KOTStatus;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: 'kg' | 'g' | 'L' | 'ml' | 'pcs' | 'dozen' | 'box';
  quantity: number;
  lowStockLevel: number;
}

export interface SystemSettings {
  cgst: number;
  sgst: number;
  gstEnabled: boolean;
  gstin?: string;
  restaurantName: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  footerMessage: string;
  printType: 'Thermal' | 'A4';
  autoPrint: boolean;
  containerChargeEnabled: boolean;
  defaultContainerCharge: number;
  showFields: {
    gstinOnReceipt: boolean;
    phoneOnReceipt: boolean;
    emailOnReceipt: boolean;
    footerOnReceipt: boolean;
  };
}
