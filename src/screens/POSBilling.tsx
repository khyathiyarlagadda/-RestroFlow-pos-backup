import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  X,
  Receipt,
  FolderOpen,
  Printer,
  Coins,
  QrCode,
  CreditCard
} from 'lucide-react';
import { storage } from '../utils/storage';
import type {
  Category,
  MenuItem,
  Variation,
  Table,
  Customer,
  CartItem,
  OrderType,
  PaymentMethod,
  SaleInvoice,
  KOT
} from '../types';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';

const getBillNumber = (invoice: any) => {
  if (invoice.id) {
    const cleanId = invoice.id.replace(/[^a-zA-Z0-9]/g, '');
    return cleanId.slice(-6).toUpperCase();
  }
  let hash = 0;
  const str = invoice.tokenNo || '';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash).toString().slice(-6).padStart(6, '0');
};

export const POSBilling: React.FC = () => {
  // --- STATE ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState(storage.getSettings());

  // Search & Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('Takeaway');
  const [selectedTableId, setSelectedTableId] = useState<string>('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const [discount, setDiscount] = useState<number>(0);
  const [tips, setTips] = useState<number>(0);
  const [containerCharge, setContainerCharge] = useState<number>(0);
  const [billSummaryExpanded, setBillSummaryExpanded] = useState(false);
  const [currentTokenNo, setCurrentTokenNo] = useState<string>('');

  // Bill Splitting states
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitMembers, setSplitMembers] = useState<number>(2);

  // Recall states
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [recallSearchQuery, setRecallSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Print selection states
  const [printSelection, setPrintSelection] = useState<'both' | 'customer' | 'kot'>('both');

  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [customerModalError, setCustomerModalError] = useState('');

  // Variation Modal
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [activeItemForVariation, setActiveItemForVariation] = useState<MenuItem | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  // Print Receipt View
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<SaleInvoice | null>(null);
  const [triggerPrint, setTriggerPrint] = useState(false);

  // --- INITIAL LOADING ---
  useEffect(() => {
    setCategories(storage.getCategories());
    setMenuItems(storage.getMenuItems().filter((item) => item.available));
    setTables(storage.getTables());
    setCustomers(storage.getCustomers());
    setSettings(storage.getSettings());

    const handleCatsUpdate = () => {
      setCategories(storage.getCategories());
    };
    const handleMenuUpdate = () => {
      setMenuItems(storage.getMenuItems().filter((item) => item.available));
    };
    const handleSettingsUpdate = () => {
      setSettings(storage.getSettings());
    };

    window.addEventListener('categoriesUpdated', handleCatsUpdate);
    window.addEventListener('menuUpdated', handleMenuUpdate);
    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('categoriesUpdated', handleCatsUpdate);
      window.removeEventListener('menuUpdated', handleMenuUpdate);
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Update container charge automatically based on order type and settings
  useEffect(() => {
    if (orderType === 'Takeaway' || orderType === 'Delivery') {
      if (settings.containerChargeEnabled) {
        setContainerCharge(settings.defaultContainerCharge || 0);
      } else {
        setContainerCharge(0);
      }
    } else {
      setContainerCharge(0);
      setSelectedTableId('');
    }
  }, [orderType, settings.containerChargeEnabled, settings.defaultContainerCharge]);

  // Reset discount and tips when cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      setDiscount(0);
      setTips(0);
    }
  }, [cart]);

  // Synchronized browser print trigger after DOM commit
  useEffect(() => {
    if (triggerPrint && showReceiptModal && currentInvoice) {
      const customerItemsContainer = document.getElementById('print-customer-items');
      const kotItemsContainer = document.getElementById('print-kot-items');

      const needsCustomer = printSelection === 'customer' || printSelection === 'both';
      const needsKOT = printSelection === 'kot' || printSelection === 'both';

      let customerRendered = !needsCustomer;
      let kotRendered = !needsKOT;

      if (needsCustomer && customerItemsContainer && customerItemsContainer.children.length > 0) {
        customerRendered = true;
      }
      if (needsKOT && kotItemsContainer && kotItemsContainer.children.length > 0) {
        kotRendered = true;
      }

      if (customerRendered && kotRendered) {
        setTriggerPrint(false);
        const timer = setTimeout(() => {
          console.log("PRINT ORDER", currentInvoice);
          window.print();
        }, 300);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          // Trigger a state refresh to re-evaluate the DOM
          setRefreshTrigger((prev) => prev + 1);
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [triggerPrint, showReceiptModal, currentInvoice, printSelection, refreshTrigger]);

  // Load cart from table if table selection changes (Dine In)
  useEffect(() => {
    if (orderType === 'Dine In' && selectedTableId) {
      const selectedTable = tables.find((t) => t.id === selectedTableId);
      if (selectedTable && selectedTable.status === 'Occupied') {
        // Find existing orders on hold/active that belong to this table
        // For simplicity, we search if there's a held cart for this table
        const heldCarts = storage.getActiveCart();
        const tableCart = heldCarts[selectedTableId];
        if (tableCart) {
          setCart(tableCart.items || []);
          setSelectedCustomerId(tableCart.customerId || 'walk-in');
          setDiscount(tableCart.discount || 0);
          setTips(tableCart.tips || 0);
          setContainerCharge(tableCart.containerCharge || 0);
          setCurrentTokenNo(tableCart.tokenNo || '');
          return;
        }
      }
      setCurrentTokenNo('');
    }
  }, [selectedTableId, orderType, tables]);

  // --- FILTERED MENU ITEMS ---
  const filteredMenuItems = useMemo(() => {
    const disabledCategoryIds = new Set(
      categories.filter((c) => c.enabled === false).map((c) => c.id)
    );
    return menuItems.filter((item) => {
      // Hide menu items that belong to disabled categories
      if (item.categoryId && disabledCategoryIds.has(item.categoryId)) {
        return false;
      }
      const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, categories, selectedCategory, searchQuery]);

  // --- CART CALCULATIONS ---
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const effectiveContainerCharge = cart.length > 0 ? containerCharge : 0;
  const effectiveTips = cart.length > 0 ? tips : 0;
  const effectiveDiscount = cart.length > 0 ? discount : 0;

  const cgstAmount = useMemo(() => {
    if (!settings.gstEnabled || subtotal === 0) return 0;
    return (subtotal * settings.cgst) / 100;
  }, [subtotal, settings.cgst, settings.gstEnabled]);

  const sgstAmount = useMemo(() => {
    if (!settings.gstEnabled || subtotal === 0) return 0;
    return (subtotal * settings.sgst) / 100;
  }, [subtotal, settings.sgst, settings.gstEnabled]);

  const grandTotalBeforeRound = useMemo(() => {
    if (cart.length === 0) return 0;
    return subtotal + cgstAmount + sgstAmount + effectiveContainerCharge + effectiveTips - effectiveDiscount;
  }, [cart.length, subtotal, cgstAmount, sgstAmount, effectiveContainerCharge, effectiveTips, effectiveDiscount]);

  const grandTotal = useMemo(() => {
    if (cart.length === 0) return 0;
    return Math.max(0, Math.round(grandTotalBeforeRound));
  }, [cart.length, grandTotalBeforeRound]);

  const roundOff = useMemo(() => {
    if (cart.length === 0) return 0;
    return grandTotal - grandTotalBeforeRound;
  }, [cart.length, grandTotal, grandTotalBeforeRound]);


  const ensureTokenNo = (): string => {
    if (currentTokenNo) return currentTokenNo;
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const nextToken = storage.getNextTokenNumber(dateStr);
    setCurrentTokenNo(nextToken);
    return nextToken;
  };

  const recallableOrders = useMemo(() => {
    // Reference dependencies to trigger re-evaluation on recall modal open/refresh
    const _dummy = (showRecallModal ? 1 : 0) + refreshTrigger;
    if (_dummy === 99999) console.log(_dummy);
    const heldCarts = storage.getActiveCart();
    const list: any[] = [];

    Object.keys(heldCarts).forEach((key) => {
      const data = heldCarts[key];
      if (key.startsWith('H-')) {
        list.push({
          key,
          holdNo: key,
          ...data
        });
      } else {
        const table = tables.find((t) => t.id === key);
        list.push({
          key,
          tableId: key,
          tableNo: table?.number,
          ...data,
          orderType: 'Dine In'
        });
      }
    });

    return list.filter((order) => {
      if (!recallSearchQuery.trim()) return true;
      const q = recallSearchQuery.toLowerCase();
      const matchHold = order.holdNo?.toLowerCase().includes(q);
      const matchToken = order.tokenNo?.toLowerCase().includes(q) || order.tokenNo?.split('-').pop()?.includes(q);
      const matchTable = order.tableNo?.toLowerCase().includes(q);
      return matchHold || matchToken || matchTable;
    });
  }, [tables, recallSearchQuery, showRecallModal, refreshTrigger]);

  const handleRecallOrder = (order: any) => {
    setCart(order.items || []);
    setSelectedCustomerId(order.customerId || 'walk-in');
    setDiscount(order.discount || 0);
    setTips(order.tips || 0);
    setContainerCharge(order.containerCharge || 0);
    setOrderType(order.orderType);
    setCurrentTokenNo(order.tokenNo || '');

    if (order.tableId) {
      setSelectedTableId(order.tableId);
    } else {
      setSelectedTableId('');
      const heldCarts = storage.getActiveCart();
      delete heldCarts[order.key];
      storage.setActiveCart(heldCarts);
    }
    setRefreshTrigger((prev) => prev + 1);
    setShowRecallModal(false);
  };

  const handleDeleteHeldOrder = (key: string) => {
    const heldCarts = storage.getActiveCart();
    delete heldCarts[key];
    storage.setActiveCart(heldCarts);
    if (!key.startsWith('H-')) {
      const updatedTables = tables.map((t) => {
        if (t.id === key) {
          return { ...t, status: 'Available' as const };
        }
        return t;
      });
      storage.setTables(updatedTables);
      setTables(updatedTables);
    }
    setRefreshTrigger((prev) => prev + 1);
  };

  // --- CART ACTIONS ---
  const handleAddItem = (item: MenuItem) => {
    if (item.hasVariations) {
      setActiveItemForVariation(item);
      setSelectedVariation(item.variations[0] || null);
      setShowVariationModal(true);
    } else {
      addToCart(item.id, item.name, item.basePrice);
    }
  };

  const addToCart = (itemId: string, name: string, price: number, variationName?: string) => {
    const cartItemId = variationName ? `${itemId}_${variationName}` : itemId;
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((i) => i.id === cartItemId);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].quantity += 1;
        return updated;
      }
      return [
        ...prevCart,
        {
          id: cartItemId,
          menuItemId: itemId,
          name,
          price,
          quantity: 1,
          variationName
        }
      ];
    });
  };

  const handleUpdateQty = (cartItemId: string, change: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + change;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== cartItemId));
  };

  // --- MODAL CONFIRMATIONS ---
  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerModalError('');

    if (!newCustomerName.trim()) {
      setCustomerModalError('Customer name is required');
      return;
    }

    const newCustomer: Customer = {
      id: storage.generateId(),
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || undefined,
      email: newCustomerEmail.trim() || undefined,
      address: newCustomerAddress.trim() || undefined,
      totalOrders: 0,
      totalSpent: 0
    };

    storage.addCustomer(newCustomer);
    setCustomers(storage.getCustomers());
    setSelectedCustomerId(newCustomer.id);

    // Reset Form
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
    setNewCustomerAddress('');
    setShowCustomerModal(false);
  };

  const handleVariationSubmit = () => {
    if (activeItemForVariation && selectedVariation) {
      addToCart(
        activeItemForVariation.id,
        activeItemForVariation.name,
        selectedVariation.price,
        selectedVariation.name
      );
      setShowVariationModal(false);
      setActiveItemForVariation(null);
      setSelectedVariation(null);
    }
  };

  // KOT button click
  const handleKOT = () => {
    if (cart.length === 0) return;

    const tokenNo = ensureTokenNo();

    let tableNo: string | undefined = undefined;
    if (orderType === 'Dine In' && selectedTableId) {
      const selectedTable = tables.find((t) => t.id === selectedTableId);
      tableNo = selectedTable?.number;
    }

    const newKOT: KOT = {
      id: storage.generateId(),
      tokenNo,
      tableNo,
      orderType,
      timeCreated: new Date().toISOString(),
      items: cart.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        variationName: item.variationName
      })),
      status: 'Pending'
    };

    storage.addKOT(newKOT);

    // If Dine In, mark table occupied and store cart
    if (orderType === 'Dine In' && selectedTableId) {
      const updatedTables = tables.map((t) => {
        if (t.id === selectedTableId) {
          return { ...t, status: 'Occupied' as const };
        }
        return t;
      });
      storage.setTables(updatedTables);
      setTables(updatedTables);

      // Save table cart in local hold state
      const heldCarts = storage.getActiveCart();
      heldCarts[selectedTableId] = {
        items: cart,
        customerId: selectedCustomerId,
        discount,
        tips,
        containerCharge,
        tokenNo
      };
      storage.setActiveCart(heldCarts);
    }

    alert(`KOT generated successfully. Token Number: ${tokenNo.split('-').pop()}`);
  };

  // Hold button click
  const handleHold = () => {
    if (cart.length === 0) return;

    if (orderType === 'Dine In' && selectedTableId) {
      // Save cart for table
      const heldCarts = storage.getActiveCart();
      heldCarts[selectedTableId] = {
        items: cart,
        customerId: selectedCustomerId,
        discount,
        tips,
        containerCharge,
        tokenNo: currentTokenNo
      };
      storage.setActiveCart(heldCarts);

      const updatedTables = tables.map((t) => {
        if (t.id === selectedTableId) {
          return { ...t, status: 'Occupied' as const };
        }
        return t;
      });
      storage.setTables(updatedTables);
      setTables(updatedTables);

      alert('Order held for table successfully.');
      setCart([]);
      setSelectedCustomerId('walk-in');
      setDiscount(0);
      setTips(0);
      setContainerCharge(0);
      setCurrentTokenNo('');
      setSelectedTableId('');
    } else {
      // Hold take-away/delivery order
      const holdNo = storage.getNextHoldNumber();
      const heldCarts = storage.getActiveCart();
      heldCarts[holdNo] = {
        items: cart,
        customerId: selectedCustomerId,
        discount,
        tips,
        containerCharge,
        orderType,
        tokenNo: currentTokenNo,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      storage.setActiveCart(heldCarts);
      alert(`Order held successfully. Hold Number: ${holdNo}`);
      setCart([]);
      setSelectedCustomerId('walk-in');
      setDiscount(0);
      setTips(0);
      setContainerCharge(0);
      setCurrentTokenNo('');
    }
  };

  // Complete Payment Action
  const handleCompletePayment = (shouldPrint: boolean) => {
    if (!paymentMethod) return;

    const tokenNo = ensureTokenNo();
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const customerName = customer ? customer.name : 'Walk-in Customer';

    let tableNo: string | undefined = undefined;
    if (orderType === 'Dine In' && selectedTableId) {
      const selectedTable = tables.find((t) => t.id === selectedTableId);
      tableNo = selectedTable?.number;
    }

    const newInvoice: SaleInvoice = {
      tokenNo,
      dateTime: new Date().toISOString(),
      customerId: selectedCustomerId,
      customerName,
      orderType,
      tableNo,
      items: cart.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        variationName: item.variationName
      })),
      subtotal,
      cgst: cgstAmount,
      sgst: sgstAmount,
      discount,
      roundOff,
      containerCharge,
      tips,
      grandTotal,
      paymentMethod,
      paymentDetails: {
        amountTendered: paymentMethod === 'Cash' ? grandTotal : undefined,
        change: paymentMethod === 'Cash' ? 0 : undefined,
        upiRef: undefined,
        cardLast4: undefined
      }
    };

    // Save to sales history
    storage.addSale(newInvoice);

    // Update customer history details
    if (selectedCustomerId !== 'walk-in') {
      const updatedCustomers = customers.map((c) => {
        if (c.id === selectedCustomerId) {
          return {
            ...c,
            totalOrders: c.totalOrders + 1,
            totalSpent: c.totalSpent + grandTotal,
            lastVisit: new Date().toISOString()
          };
        }
        return c;
      });
      storage.setCustomers(updatedCustomers);
      setCustomers(updatedCustomers);
    }

    // Decrement inventory stock if matching by name
    const inventory = storage.getInventory();
    const updatedInventory = inventory.map((invItem) => {
      // Find matching items in cart
      const cartMatches = cart.filter(
        (cItem) => cItem.name.toLowerCase() === invItem.name.toLowerCase()
      );
      const totalSold = cartMatches.reduce((sum, item) => sum + item.quantity, 0);
      if (totalSold > 0) {
        return {
          ...invItem,
          quantity: Math.max(0, invItem.quantity - totalSold)
        };
      }
      return invItem;
    });
    storage.setInventory(updatedInventory);

    // Release table if Dine In
    if (orderType === 'Dine In' && selectedTableId) {
      const updatedTables = tables.map((t) => {
        if (t.id === selectedTableId) {
          return { ...t, status: 'Available' as const };
        }
        return t;
      });
      storage.setTables(updatedTables);
      setTables(updatedTables);

      // Remove held cart for this table
      const heldCarts = storage.getActiveCart();
      delete heldCarts[selectedTableId];
      storage.setActiveCart(heldCarts);
    }

    // Set invoice and open receipt modal
    setCurrentInvoice(newInvoice);
    setCart([]);
    setDiscount(0);
    setTips(0);
    setContainerCharge(0);
    setCurrentTokenNo(''); // Reset Token Number for next order
    setPaymentMethod(null); // Reset payment method for next order

    if (shouldPrint) {
      setShowReceiptModal(true);
      setTriggerPrint(true); // Trigger synchronized printing via useEffect
    } else {
      alert(`Token Number ${tokenNo.split('-').pop()} generated successfully!`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-page font-sans text-text-primary transition-all duration-[220ms] ease-in-out select-none">
      {/* 3-COLUMN POS WORKSPACE */}
      <div className="flex-1 flex h-full overflow-hidden">
        
        {/* LEFT COLUMN: Categories Panel (180px fixed) */}
        <div className="w-[180px] bg-bg-card border-r border-border flex flex-col h-full shrink-0">
          <div className="p-4 border-b border-border bg-bg-card/50">
            <h2 className="text-[14px] font-medium text-text-muted sentence-case">Categories</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`w-full text-left px-3.5 py-2.5 rounded-btn text-[13px] font-medium transition-all duration-150 border ${
                selectedCategory === 'all'
                  ? 'bg-primary border-primary text-white font-medium'
                  : 'bg-transparent border-border text-text-primary hover:bg-bg-page'
              }`}
            >
              All items
            </button>
            {categories
              .filter((cat) => cat.enabled !== false)
              .map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-btn text-[13px] font-medium transition-all duration-150 border truncate ${
                    selectedCategory === cat.id
                      ? 'bg-primary border-primary text-white font-medium'
                      : 'bg-transparent border-border text-text-primary hover:bg-bg-page'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
          </div>
        </div>

        {/* CENTER COLUMN: Search & Menu Item Grid */}
        <div className="flex-1 flex flex-col h-full bg-bg-page overflow-hidden">
          {/* Top Bar */}
          <div className="p-4 bg-bg-card border-b border-border flex flex-col md:flex-row gap-3 items-center justify-between shrink-0">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-text-hint" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-bg-page p-1 border border-border rounded-btn shrink-0">
              {(['Dine In', 'Takeaway', 'Delivery'] as OrderType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`h-[28px] px-3.5 rounded-btn text-[13px] font-medium transition-all duration-150 ${
                    orderType === type
                      ? 'bg-primary text-white'
                      : 'text-text-muted hover:bg-bg-card'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {filteredMenuItems.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No menu items found"
                subtitle="Ensure categories and items are added in the admin section."
              />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleAddItem(item)}
                    className="bg-bg-card rounded-card border border-border p-3 flex flex-col justify-between cursor-pointer hover:shadow-card hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 group"
                  >
                    <div>
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-[80px] object-cover rounded-btn mb-2 bg-[#F0EAE4]"
                        />
                      ) : (
                        <div className="w-full h-[80px] rounded-btn mb-2 bg-[#F0EAE4] flex items-center justify-center text-text-hint">
                          No image
                        </div>
                      )}
                      <h4 className="text-[13px] font-medium text-text-primary line-clamp-2 leading-tight group-hover:text-primary transition-colors duration-150 sentence-case">
                        {item.name}
                      </h4>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[14px] font-medium text-primary">
                        ₹{item.hasVariations ? Math.min(...item.variations.map((v) => v.price)) : item.basePrice}
                      </span>
                      {item.hasVariations && (
                        <span className="text-[10px] text-primary border border-primary px-1.5 py-0.5 rounded-badge tracking-wider font-medium font-mono uppercase bg-primary/5">
                          Variations
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Billing Panel (340px fixed) */}
        <div className="w-[340px] bg-bg-card border-l border-border flex flex-col h-full shrink-0 justify-between">
          
          {/* Top Panel Section */}
          <div className="p-4 border-b border-border flex flex-col gap-3 shrink-0">
            {/* Customer selector row */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-text-muted font-medium sentence-case">Customer</span>
                <button
                  onClick={() => setShowCustomerModal(true)}
                  className="text-[12px] text-primary hover:underline flex items-center gap-1 sentence-case"
                >
                  <Plus className="w-[12px] h-[12px]" /> Add customer
                </button>
              </div>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full"
              >
                <option value="walk-in">Walk-in Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Table Dropdown (Dine In only) */}
            {orderType === 'Dine In' && (
              <div className="flex flex-col gap-1.5 animate-[fadeIn_200ms_ease]">
                <label htmlFor="tableSelect">Select Table</label>
                <select
                  id="tableSelect"
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="w-full border-warning-custom"
                >
                  <option value="">Choose a table...</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.number} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cart Item list */}
          <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-text-hint">
                <Receipt className="w-12 h-12 text-[#C4B8B0] mb-2" />
                <span className="text-[14px] font-medium sentence-case">No items added yet</span>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex gap-2 justify-between border-b border-border/60 pb-2.5 items-start">
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-medium text-text-primary block truncate sentence-case">
                      {item.name}
                    </span>
                    {item.variationName && (
                      <span className="text-[11px] text-text-muted block mt-0.5 sentence-case font-medium">
                        ({item.variationName})
                      </span>
                    )}
                    <span className="text-[11px] text-text-hint block mt-0.5 font-mono">
                      ₹{item.price} each
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center border border-border rounded-btn bg-bg-page overflow-hidden">
                      <button
                        onClick={() => handleUpdateQty(item.id, -1)}
                        className="p-1 px-1.5 hover:bg-border text-text-muted transition-colors duration-100"
                      >
                        <Minus className="w-[12px] h-[12px]" />
                      </button>
                      <span className="text-[13px] px-2 font-medium font-mono min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQty(item.id, 1)}
                        className="p-1 px-1.5 hover:bg-border text-text-muted transition-colors duration-100"
                      >
                        <Plus className="w-[12px] h-[12px]" />
                      </button>
                    </div>

                    <div className="text-right min-w-[64px]">
                      <span className="text-[13px] font-medium text-primary font-mono block">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-text-hint hover:text-danger-custom transition-colors duration-100 p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bill Summary (Collapsible) */}
          <div className="border-t border-border bg-bg-page/40 shrink-0">
            <button
              onClick={() => setBillSummaryExpanded(!billSummaryExpanded)}
              className="w-full flex items-center justify-between py-2.5 px-4 text-[12px] font-medium text-text-muted hover:bg-bg-page transition-colors duration-150"
            >
              <span className="sentence-case">
                {billSummaryExpanded ? '▲ Hide bill summary' : '▼ View bill summary'}
              </span>
              <span className="font-mono text-primary font-semibold">
                Subtotal: ₹{subtotal.toLocaleString('en-IN')}
              </span>
            </button>

            {billSummaryExpanded && (
              <div className="px-4 pb-3 flex flex-col gap-2 text-[13px] border-b border-border/60 animate-[fadeIn_150ms_ease]">
                <div className="flex justify-between text-text-muted">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {settings.gstEnabled && (
                  <>
                    <div className="flex justify-between text-text-muted">
                      <span>CGST ({settings.cgst}%)</span>
                      <span className="font-mono">₹{cgstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>SGST ({settings.sgst}%)</span>
                      <span className="font-mono">₹{sgstAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}
                {effectiveContainerCharge > 0 && (
                  <div className="flex justify-between text-text-muted">
                    <span>Container charge</span>
                    <span className="font-mono">₹{effectiveContainerCharge}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-text-muted">
                  <span>Discount (₹)</span>
                  <input
                    type="number"
                    value={discount || ''}
                    min={0}
                    max={subtotal}
                    disabled={cart.length === 0}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-20 text-right h-6 py-0 px-1.5 font-mono text-[13px]"
                  />
                </div>
                <div className="flex justify-between items-center text-text-muted">
                  <span>Tips (₹)</span>
                  <input
                    type="number"
                    value={tips || ''}
                    min={0}
                    disabled={cart.length === 0}
                    onChange={(e) => setTips(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-20 text-right h-6 py-0 px-1.5 font-mono text-[13px]"
                  />
                </div>
                <div className="flex justify-between text-text-muted italic">
                  <span>Round off</span>
                  <span className="font-mono">
                    {roundOff >= 0 ? '+' : ''}₹{roundOff.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Operations Row */}
          <div className="px-3 py-2 bg-bg-card border-t border-border grid grid-cols-4 gap-1.5 shrink-0">
            <button
              onClick={handleKOT}
              disabled={cart.length === 0}
              className="h-[30px] rounded-btn border border-border text-text-primary hover:bg-[#F5F0EA] text-[11px] font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              KOT
            </button>
            <button
              onClick={handleHold}
              disabled={cart.length === 0}
              className="h-[30px] rounded-btn border border-border text-text-primary hover:bg-[#F5F0EA] text-[11px] font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hold
            </button>
            <button
              onClick={() => setShowRecallModal(true)}
              className="h-[30px] rounded-btn border border-border text-text-primary hover:bg-[#F5F0EA] text-[11px] font-medium transition-colors duration-150"
            >
              Recall
            </button>
            <button
              onClick={() => setShowSplitModal(true)}
              disabled={cart.length === 0}
              className="h-[30px] rounded-btn border border-border text-text-primary hover:bg-[#F5F0EA] text-[11px] font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Split
            </button>
          </div>

          {/* Grand Total Sticky Panel */}
          <div className="bg-primary text-white p-4.5 rounded-t-card flex items-center justify-between shrink-0">
            <span className="text-[15px] font-medium sentence-case">Grand Total</span>
            <span className="text-[26px] font-bold text-white">
              ₹{grandTotal.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Payment Method Selector & Save & Print Buttons */}
          <div className="p-3 bg-bg-card border-t border-border flex flex-col gap-2 shrink-0">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod(paymentMethod === 'Cash' ? null : 'Cash')}
                disabled={cart.length === 0}
                className={`h-[42px] rounded-btn border flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                  paymentMethod === 'Cash'
                    ? 'bg-[#1A7A4A] border-[#1A7A4A] text-white shadow-card'
                    : 'bg-transparent border-border text-text-primary hover:bg-[#F5F0EA]'
                }`}
              >
                <Coins className="w-4 h-4" />
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod(paymentMethod === 'UPI' ? null : 'UPI')}
                disabled={cart.length === 0}
                className={`h-[42px] rounded-btn border flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                  paymentMethod === 'UPI'
                    ? 'bg-[#C47A00] border-[#C47A00] text-white shadow-card'
                    : 'bg-transparent border-border text-text-primary hover:bg-[#F5F0EA]'
                }`}
              >
                <QrCode className="w-4 h-4" />
                UPI
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod(paymentMethod === 'Card' ? null : 'Card')}
                disabled={cart.length === 0}
                className={`h-[42px] rounded-btn border flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                  paymentMethod === 'Card'
                    ? 'bg-primary border-primary text-white shadow-card'
                    : 'bg-transparent border-border text-text-primary hover:bg-[#F5F0EA]'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Card
              </button>
            </div>

            <button
              onClick={() => handleCompletePayment(true)}
              disabled={cart.length === 0 || !paymentMethod}
              className={`h-[46px] rounded-btn text-[14px] font-bold transition-all duration-150 flex items-center justify-center uppercase ${
                !paymentMethod
                  ? 'bg-bg-page border border-border text-text-hint cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-dark shadow-card'
              }`}
            >
              {paymentMethod ? 'SAVE & PRINT' : 'SELECT PAYMENT METHOD'}
            </button>
          </div>

        </div>

      </div>

      {/* --- MODAL 1: ADD CUSTOMER --- */}
      <Modal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Add customer">
        <form onSubmit={handleAddCustomer} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="custName">Customer name</label>
            <input
              id="custName"
              type="text"
              placeholder="e.g. Rachel Green"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className={customerModalError && !newCustomerName ? 'border-danger-custom' : ''}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="custPhone">Phone number (optional)</label>
            <input
              id="custPhone"
              type="text"
              placeholder="e.g. 9876543210"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="custEmail">Email address (optional)</label>
            <input
              id="custEmail"
              type="email"
              placeholder="e.g. rachel@centralperk.com"
              value={newCustomerEmail}
              onChange={(e) => setNewCustomerEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="custAddress">Address (optional)</label>
            <input
              id="custAddress"
              type="text"
              placeholder="e.g. Apartment 20, 90 Bedford St"
              value={newCustomerAddress}
              onChange={(e) => setNewCustomerAddress(e.target.value)}
            />
          </div>

          {customerModalError && (
            <span className="text-[13px] text-danger-custom font-medium sentence-case">
              {customerModalError}
            </span>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCustomerModal(false)}
              className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-[36px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-medium transition-colors duration-150"
            >
              Save Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 2: VARIATIONS SELECTION --- */}
      <Modal isOpen={showVariationModal} onClose={() => setShowVariationModal(false)} title="Select variation">
        {activeItemForVariation && (
          <div className="flex flex-col gap-4">
            <div className="text-[13px] text-text-muted mb-1 sentence-case">
              Choose a variation size for {activeItemForVariation.name}:
            </div>

            <div className="flex flex-col border border-border rounded-card divide-y divide-border overflow-hidden">
              {activeItemForVariation.variations.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => setSelectedVariation(v)}
                  className={`flex justify-between items-center px-4 py-3 text-left w-full hover:bg-primary/5 transition-all duration-150 ${
                    selectedVariation?.name === v.name
                      ? 'bg-primary/5 border-l-4 border-primary pl-3'
                      : ''
                  }`}
                >
                  <span className="text-[14px] font-medium text-text-primary sentence-case">{v.name}</span>
                  <span className="text-[14px] font-semibold text-primary font-mono">₹{v.price}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowVariationModal(false);
                  setActiveItemForVariation(null);
                  setSelectedVariation(null);
                }}
                className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVariationSubmit}
                disabled={!selectedVariation}
                className="flex-1 h-[36px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-medium transition-colors duration-150 disabled:opacity-50"
              >
                Add to Cart
              </button>
            </div>
          </div>
        )}
      </Modal>


      {/* --- RECEIPT MODAL OVERLAY (THERMAL PRINT SIMULATOR) --- */}
      <Modal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="Invoice generated successfully" widthClass="max-w-[420px]">
        {currentInvoice && (() => {
          console.log("--- PRINT TEMPLATE DEBUG ---");
          console.log("Receipt Modal Open:", showReceiptModal);
          console.log("Current Invoice Object:", currentInvoice);
          console.log("Items Array Length:", currentInvoice.items?.length);
          if (currentInvoice.items) {
            currentInvoice.items.forEach((item, index) => {
              console.log(`Item [${index}]: name="${item.name}", quantity=${item.quantity}, price=${item.price}`);
            });
          }
          console.log("----------------------------");
          return (
            <div className="flex flex-col gap-5">
              
              {/* Print Selection Buttons */}
              <div className="flex border border-border rounded-btn p-1 bg-bg-page shrink-0">
                {(['both', 'customer', 'kot'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setPrintSelection(option)}
                    className={`flex-1 h-[32px] rounded-btn text-[12px] font-medium transition-all duration-150 capitalize ${
                      printSelection === option
                        ? 'bg-primary text-white shadow-card'
                        : 'text-text-muted hover:bg-bg-card'
                    }`}
                  >
                    {option === 'both' ? 'Print Both' : option === 'customer' ? 'Customer Bill' : 'KOT Bill'}
                  </button>
                ))}
              </div>

              {/* The printable boundary box */}
              <div className="print-area border border-border p-5 bg-white font-mono text-[12px] text-black shadow-card flex flex-col gap-4 rounded-btn overflow-y-auto max-h-[350px] custom-scrollbar select-text">
                
                               {(printSelection === 'customer' || printSelection === 'both') && (
                  <div className="flex flex-col gap-1 text-black font-mono text-[11px] leading-tight">
                    {/* Header */}
                    <div className="text-center flex flex-col gap-0.5">
                      <span className="text-[14px] font-extrabold uppercase tracking-tight">{settings.restaurantName}</span>
                      {settings.address && <span className="text-[10px] leading-tight select-text">{settings.address}</span>}
                      {settings.phone && <span className="text-[10px] select-text">Phone: {settings.phone}</span>}
                      {settings.gstEnabled && settings.gstin && <span className="text-[10px] select-text">GSTIN: {settings.gstin}</span>}
                    </div>

                    <div className="border-t border-dashed border-black my-1" />

                    {/* Customer Information */}
                    <div className="text-left select-text">
                      Customer : {currentInvoice.customerName || 'Walk-in Customer'}
                    </div>

                    <div className="border-t border-dashed border-black my-1" />

                    {/* Order Information */}
                    <div className="flex flex-col gap-0.5 select-text">
                      <div className="flex justify-between">
                        <span>Date : {new Date(currentInvoice.dateTime).toLocaleDateString()}</span>
                        <span>Time : {new Date(currentInvoice.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Token : {currentInvoice.tokenNo.split('-').pop()}</span>
                        <span>Bill : {getBillNumber(currentInvoice)}</span>
                      </div>
                      <div>
                        Cashier : {storage.getAuth()?.username || 'System'}
                      </div>
                      <div>
                        Type : {currentInvoice.orderType}{currentInvoice.tableNo ? ` (Table ${currentInvoice.tableNo})` : ''}
                      </div>
                    </div>

                    <div className="border-t border-dashed border-black my-1" />

                    {/* Item Table */}
                    <div className="flex flex-col">
                      <div className="flex justify-between font-bold text-[11px] mb-1">
                        <span className="w-[45%] text-left">Item</span>
                        <span className="w-[15%] text-center">Qty</span>
                        <span className="w-[20%] text-right">Price</span>
                        <span className="w-[20%] text-right">Total</span>
                      </div>
                      <div className="border-t border-dashed border-black/40 mb-1" />
                      <div id="print-customer-items" className="flex flex-col gap-0.5 select-text">
                        {currentInvoice.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-start leading-tight">
                            <span className="w-[45%] text-left truncate sentence-case">
                              {item.name} {item.variationName ? `(${item.variationName})` : ''}
                            </span>
                            <span className="w-[15%] text-center">{item.quantity}</span>
                            <span className="w-[20%] text-right font-mono">₹{item.price.toFixed(2)}</span>
                            <span className="w-[20%] text-right font-mono">₹{(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-dashed border-black my-1" />

                    {/* Totals Section */}
                    <div className="flex flex-col gap-0.5 font-mono select-text">
                      <div className="flex justify-between">
                        <span>Total Qty : {currentInvoice.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>₹{currentInvoice.subtotal.toFixed(2)}</span>
                      </div>
                      {settings.gstEnabled && (
                        <>
                          <div className="flex justify-between">
                            <span>CGST</span>
                            <span>₹{currentInvoice.cgst.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>SGST</span>
                            <span>₹{currentInvoice.sgst.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                      {currentInvoice.discount > 0 && (
                        <div className="flex justify-between">
                          <span>Discount</span>
                          <span>-₹{currentInvoice.discount.toFixed(2)}</span>
                        </div>
                      )}
                      {currentInvoice.roundOff !== 0 && (
                        <div className="flex justify-between italic text-text-muted">
                          <span>Round Off</span>
                          <span>₹{currentInvoice.roundOff.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-dashed border-black/40 my-1" />
                      <div className="flex justify-between text-[14px] font-extrabold text-black leading-none">
                        <span>Grand Total</span>
                        <span>₹{currentInvoice.grandTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-black my-1" />

                    {/* Payment Section */}
                    <div className="flex flex-col gap-0.5 select-text">
                      <div>Payment : {currentInvoice.paymentMethod}</div>
                      {currentInvoice.paymentMethod === 'Cash' && currentInvoice.paymentDetails?.amountTendered && (
                        <>
                          <div>Paid    : ₹{currentInvoice.paymentDetails.amountTendered.toFixed(2)}</div>
                          <div>Change  : ₹{currentInvoice.paymentDetails.change ? currentInvoice.paymentDetails.change.toFixed(2) : '0.00'}</div>
                        </>
                      )}
                    </div>

                    <div className="border-t border-dashed border-black my-1" />

                    {/* Footer */}
                    <div className="text-center flex flex-col gap-0.5 leading-tight select-text">
                      <span>Thank You!</span>
                      <span>Visit Again.</span>
                    </div>
                  </div>
                )}

                {/* PAGE BREAK (Only when printing both) */}
                {printSelection === 'both' && (
                  <div className="page-break my-4 border-t border-dashed border-black/30 print:hidden" />
                )}

                {/* KOT LAYOUT */}
                {(printSelection === 'kot' || printSelection === 'both') && (
                  <div className="flex flex-col gap-4">
                    {/* Header */}
                    <div className="text-center flex flex-col gap-1">
                      <span className="text-[14px] font-bold">KITCHEN ORDER TICKET (KOT)</span>
                      <span className="text-[12px] font-semibold">Token No: {currentInvoice.tokenNo.split('-').pop()}</span>
                    </div>

                    <div className="border-t border-dashed border-black/50" />

                    {/* Meta */}
                    <div className="flex flex-col gap-0.5 text-[11px]">
                      <div className="flex justify-between">
                        <span>Date: {new Date(currentInvoice.dateTime).toLocaleDateString()}</span>
                        <span>Time: {new Date(currentInvoice.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-left">
                        <span>Type: {currentInvoice.orderType} {currentInvoice.tableNo ? `(Table ${currentInvoice.tableNo})` : ''}</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-black/50" />

                    {/* Items Table */}
                    <div className="flex flex-col gap-1 text-[11px]">
                      <div className="flex justify-between font-bold">
                        <span className="w-4/5 text-left">Item</span>
                        <span className="w-1/5 text-right">Qty</span>
                      </div>
                      <div className="border-t border-dashed border-black/30" />
                      <div id="print-kot-items" className="flex flex-col gap-1">
                        {currentInvoice.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-start leading-tight text-[13px] font-bold">
                            <span className="w-4/5 text-left sentence-case">
                              {item.name} {item.variationName ? `(${item.variationName})` : ''}
                            </span>
                            <span className="w-1/5 text-right">{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-dashed border-black/50" />

                    {/* Total Qty */}
                    <div className="flex justify-between text-[11px] font-bold mt-1">
                      <span>Total Qty:</span>
                      <span>{currentInvoice.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                    </div>

                    <div className="border-t border-dashed border-black/50" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    console.log("PRINT ORDER", currentInvoice);
                    window.print();
                  }}
                  className="flex-1 h-[36px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-medium transition-colors duration-150 flex items-center justify-center"
                >
                  <Printer className="w-4 h-4 mr-2" /> Reprint Receipt
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
                >
                  Done
                </button>
              </div>

            </div>
          );
        })()}
      </Modal>

      {/* --- MODAL: BILL SPLITTING --- */}
      <Modal isOpen={showSplitModal} onClose={() => setShowSplitModal(false)} title="Split Bill">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="splitMembersInput">Number of Members</label>
            <input
              id="splitMembersInput"
              type="number"
              min={2}
              max={100}
              value={splitMembers}
              onChange={(e) => setSplitMembers(Math.max(2, parseInt(e.target.value) || 2))}
              className="font-mono text-[15px]"
            />
          </div>

          <div className="bg-bg-page p-4.5 rounded-card border border-border flex flex-col gap-3">
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-text-muted">Total Bill Amount:</span>
              <span className="font-semibold text-text-primary font-mono">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-[14px]">
              <span className="text-text-muted">Total Members:</span>
              <span className="font-semibold text-text-primary font-mono">{splitMembers}</span>
            </div>
            <div className="border-t border-border/80 my-1 pt-2 flex justify-between items-center">
              <span className="text-primary font-semibold text-[15px]">Per Person Share:</span>
              <span className="text-[20px] font-bold text-primary font-mono">₹{(Math.round((grandTotal / splitMembers) * 100) / 100).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowSplitModal(false)}
              className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                console.log("PRINT ORDER", currentInvoice);
                window.print();
              }}
              className="flex-1 h-[36px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-medium transition-colors duration-150"
            >
              Print Split Receipt
            </button>
          </div>
        </div>

        {/* Hidden Print Area for Split Receipt */}
        <div className="print-area hidden print:flex flex-col gap-4 p-5 bg-white font-mono text-[12px] text-black">
          <div className="text-center flex flex-col gap-1">
            <span className="text-[15px] font-bold">{settings.restaurantName}</span>
            <span className="text-[12px] font-bold">SPLIT BILL RECEIPT</span>
          </div>
          <div className="border-t border-dashed border-black/50" />
          <div className="flex flex-col gap-0.5">
            <div>Date: {new Date().toLocaleDateString()}</div>
            <div>Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            {orderType === 'Dine In' && selectedTableId && (
              <div>Table: {tables.find(t => t.id === selectedTableId)?.number}</div>
            )}
          </div>
          <div className="border-t border-dashed border-black/50" />
          <div className="flex flex-col gap-2 font-mono">
            <div className="flex justify-between">
              <span>Total Amount:</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>No. of Members:</span>
              <span>{splitMembers}</span>
            </div>
            <div className="border-t border-black/30 pt-1 flex justify-between font-bold text-[14px]">
              <span>Per Person Pay:</span>
              <span>₹{(Math.round((grandTotal / splitMembers) * 100) / 100).toFixed(2)}</span>
            </div>
          </div>
          <div className="border-t border-dashed border-black/50" />
          <div className="text-center text-[10px]">
            Thank you! Please pay your share.
          </div>
        </div>
      </Modal>

      {/* --- MODAL: RECALL ORDER --- */}
      <Modal isOpen={showRecallModal} onClose={() => setShowRecallModal(false)} title="Recall Order" widthClass="max-w-[600px]">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-text-hint" />
            <input
              type="text"
              placeholder="Search held orders by hold #, table #, token #..."
              value={recallSearchQuery}
              onChange={(e) => setRecallSearchQuery(e.target.value)}
              className="w-full pl-9"
            />
          </div>

          <div className="border border-border rounded-card overflow-hidden bg-bg-card">
            {recallableOrders.length === 0 ? (
              <div className="p-8 text-center text-text-hint">
                No recallable orders found matching your search.
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[300px] overflow-y-auto custom-scrollbar">
                {recallableOrders.map((order) => {
                  const seqNo = order.tokenNo ? order.tokenNo.split('-').pop() : '';
                  const customer = customers.find(c => c.id === order.customerId);
                  const custName = customer ? customer.name : 'Walk-in';
                  return (
                    <div key={order.key} className="flex justify-between items-center p-3.5 hover:bg-bg-page transition-colors duration-150">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-primary">
                            {order.holdNo ? order.holdNo : `Table ${order.tableNo}`}
                          </span>
                          <span className="text-[11px] bg-bg-page border border-border px-1.5 py-0.2 rounded-badge text-text-muted font-medium uppercase font-mono">
                            {order.orderType}
                          </span>
                          {seqNo && (
                            <span className="text-[11px] bg-primary/5 text-primary border border-primary/20 px-1.5 py-0.2 rounded-badge font-mono">
                              Token {seqNo}
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-text-muted">
                          Customer: <span className="font-medium text-text-primary">{custName}</span>
                        </div>
                        <div className="text-[11px] text-text-hint truncate max-w-[340px]">
                          {order.items.map((item: any) => `${item.name} x${item.quantity}`).join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRecallOrder(order)}
                          className="h-[30px] px-3 bg-primary text-white rounded-btn text-[12px] font-medium hover:bg-primary-dark transition-colors duration-150"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHeldOrder(order.key)}
                          className="h-[30px] px-3 border border-border text-danger hover:bg-danger/5 rounded-btn text-[12px] font-medium transition-colors duration-150"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowRecallModal(false)}
              className="h-[36px] px-4 border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
