import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Package,
  Plus,
  Users,
  FileText,
  AlertCircle,
  Search,
  Download,
  Upload,
  Edit2,
  Trash2,
  Coins,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { storage } from '../utils/storage';
import type { InventoryItem } from '../types';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';

// Helper to format currency
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(val);
};

// Unit lists and mapper
const UNITS = ['Kg', 'Gram', 'Litre', 'ML', 'Pieces', 'Packets', 'Bottles', 'Boxes', 'Custom'] as const;
type DisplayUnit = typeof UNITS[number];

const mapToDbUnit = (displayUnit: string): 'kg' | 'g' | 'L' | 'ml' | 'pcs' | 'dozen' | 'box' => {
  const lowered = displayUnit.toLowerCase();
  if (lowered === 'kg') return 'kg';
  if (lowered === 'gram' || lowered === 'g') return 'g';
  if (lowered === 'litre' || lowered === 'l') return 'L';
  if (lowered === 'ml') return 'ml';
  if (lowered === 'pieces' || lowered === 'pcs') return 'pcs';
  if (lowered === 'boxes' || lowered === 'box') return 'box';
  return 'pcs'; // fallback for Packets, Bottles, Custom
};

// Local interfaces for localstorage extra tables
interface IngredientExt {
  category: string;
  costPerUnit: number;
  status: 'active' | 'inactive';
  displayUnit: DisplayUnit;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  gst: string;
  notes: string;
}

interface StockInTransaction {
  id: string;
  ingredientId: string;
  supplierId: string;
  quantity: number;
  unit: DisplayUnit;
  purchasePrice: number; // total price or cost per unit
  date: string;
  remarks: string;
  invoiceNumber: string;
}

interface StockOutTransaction {
  id: string;
  ingredientId: string;
  quantity: number;
  reason: 'Spoilage' | 'Wastage' | 'Staff Consumption' | 'Corrections';
  date: string;
}

export const Inventory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Ingredients' | 'Stock In' | 'Stock Out' | 'Suppliers' | 'Purchase History' | 'Low Stock'>('Dashboard');
  const [isAdmin, setIsAdmin] = useState(false);

  // Core inventories from Supabase
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Extended properties and auxiliary logs in LocalStorage
  const [ingredientsExt, setIngredientsExt] = useState<{ [id: string]: IngredientExt }>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockInLogs, setStockInLogs] = useState<StockInTransaction[]>([]);
  const [stockOutLogs, setStockOutLogs] = useState<StockOutTransaction[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<InventoryItem | null>(null);
  
  // Ingredient fields
  const [ingName, setIngName] = useState('');
  const [ingCategory, setIngCategory] = useState('Vegetables');
  const [ingUnit, setIngUnit] = useState<DisplayUnit>('Pieces');
  const [ingQty, setIngQty] = useState(0);
  const [ingMinQty, setIngMinQty] = useState(5);
  const [ingCost, setIngCost] = useState(0);
  const [ingStatus, setIngStatus] = useState<'active' | 'inactive'>('active');
  const [ingredientError, setIngredientError] = useState('');

  // Suppliers form state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supGST, setSupGST] = useState('');
  const [supNotes, setSupNotes] = useState('');
  const [supplierError, setSupplierError] = useState('');

  // Stock In Form State
  const [stockInIngId, setStockInIngId] = useState('');
  const [stockInSupId, setStockInSupId] = useState('');
  const [stockInQty, setStockInQty] = useState<number | ''>('');
  const [stockInUnit, setStockInUnit] = useState<DisplayUnit>('Pieces');
  const [stockInPrice, setStockInPrice] = useState<number | ''>('');
  const [stockInInvoice, setStockInInvoice] = useState('');
  const [stockInDate, setStockInDate] = useState(new Date().toISOString().split('T')[0]);
  const [stockInRemarks, setStockInRemarks] = useState('');
  const [stockInError, setStockInError] = useState('');

  // Stock Out Form State
  const [stockOutIngId, setStockOutIngId] = useState('');
  const [stockOutQty, setStockOutQty] = useState<number | ''>('');
  const [stockOutReason, setStockOutReason] = useState<'Spoilage' | 'Wastage' | 'Staff Consumption' | 'Corrections'>('Wastage');
  const [stockOutDate, setStockOutDate] = useState(new Date().toISOString().split('T')[0]);
  const [stockOutError, setStockOutError] = useState('');

  // Delete Confirm modals
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'ingredient' | 'supplier'; id: string } | null>(null);

  // Categories helper list
  const CATEGORIES = ['Chicken', 'Rice', 'Oil', 'Eggs', 'Paneer', 'Curd', 'Soft Drinks', 'Vegetables', 'Spices', 'Other'];

  // Loading all logs and states
  useEffect(() => {
    // 1. Fetch core inventory
    setInventory(storage.getInventory());

    const handleInventoryUpdate = () => {
      setInventory(storage.getInventory());
    };
    window.addEventListener('inventoryUpdated', handleInventoryUpdate);

    // 2. Fetch admin check
    const auth = storage.getAuth();
    if (auth && (auth.role === 'Administrator' || auth.role === 'Restaurant Owner')) {
      setIsAdmin(true);
    }

    // 3. Load from localStorage
    const savedExt = localStorage.getItem('restroflow_ingredients_ext');
    if (savedExt) setIngredientsExt(JSON.parse(savedExt));

    const savedSuppliers = localStorage.getItem('restroflow_suppliers');
    if (savedSuppliers) setSuppliers(JSON.parse(savedSuppliers));

    const savedStockIn = localStorage.getItem('restroflow_stock_in');
    if (savedStockIn) setStockInLogs(JSON.parse(savedStockIn));

    const savedStockOut = localStorage.getItem('restroflow_stock_out');
    if (savedStockOut) setStockOutLogs(JSON.parse(savedStockOut));

    return () => {
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate);
    };
  }, []);

  // Save auxiliary data helper
  const saveExtData = (newExt: { [id: string]: IngredientExt }) => {
    setIngredientsExt(newExt);
    localStorage.setItem('restroflow_ingredients_ext', JSON.stringify(newExt));
  };

  const saveSuppliersData = (newSuppliers: Supplier[]) => {
    setSuppliers(newSuppliers);
    localStorage.setItem('restroflow_suppliers', JSON.stringify(newSuppliers));
  };

  const saveStockInData = (newLogs: StockInTransaction[]) => {
    setStockInLogs(newLogs);
    localStorage.setItem('restroflow_stock_in', JSON.stringify(newLogs));
  };

  const saveStockOutData = (newLogs: StockOutTransaction[]) => {
    setStockOutLogs(newLogs);
    localStorage.setItem('restroflow_stock_out', JSON.stringify(newLogs));
  };

  // Compile Ingredients combined model
  const ingredientsList = useMemo(() => {
    return inventory.map((core) => {
      const ext = ingredientsExt[core.id] || {
        category: 'Other',
        costPerUnit: 0,
        status: 'active',
        displayUnit: (core.unit === 'pcs' ? 'Pieces' : core.unit === 'kg' ? 'Kg' : core.unit === 'g' ? 'Gram' : core.unit === 'L' ? 'Litre' : core.unit === 'ml' ? 'ML' : core.unit === 'box' ? 'Boxes' : 'Pieces') as DisplayUnit
      };
      return {
        ...core,
        category: ext.category,
        costPerUnit: ext.costPerUnit,
        status: ext.status,
        displayUnit: ext.displayUnit
      };
    });
  }, [inventory, ingredientsExt]);

  // Filters computed
  const filteredIngredients = useMemo(() => {
    return ingredientsList.filter((ing) => {
      const matchSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase()) || ing.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === 'all' || ing.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [ingredientsList, searchQuery, categoryFilter]);

  const lowStockIngredients = useMemo(() => {
    return ingredientsList.filter((ing) => ing.quantity <= ing.lowStockLevel);
  }, [ingredientsList]);

  const filteredPurchaseHistory = useMemo(() => {
    return stockInLogs.filter((log) => {
      const ing = ingredientsList.find((i) => i.id === log.ingredientId);
      const sup = suppliers.find((s) => s.id === log.supplierId);
      
      const matchSearch = (ing?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (sup?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchSup = supplierFilter === 'all' || log.supplierId === supplierFilter;
      
      let matchDate = true;
      if (startDate) {
        matchDate = matchDate && new Date(log.date) >= new Date(startDate);
      }
      if (endDate) {
        matchDate = matchDate && new Date(log.date) <= new Date(endDate);
      }

      return matchSearch && matchSup && matchDate;
    });
  }, [stockInLogs, ingredientsList, suppliers, searchQuery, supplierFilter, startDate, endDate]);

  // Dashboard metrics computations
  const dashboardMetrics = useMemo(() => {
    const totalIngredients = ingredientsList.length;
    const lowStockCount = lowStockIngredients.length;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPurchasesAmount = stockInLogs
      .filter((log) => log.date === todayStr)
      .reduce((sum, log) => sum + (log.quantity * log.purchasePrice), 0);

    const inventoryValue = ingredientsList
      .filter((ing) => ing.status === 'active')
      .reduce((sum, ing) => sum + (ing.quantity * ing.costPerUnit), 0);

    const recentPurchases = [...stockInLogs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return {
      totalIngredients,
      lowStockCount,
      todayPurchasesAmount,
      inventoryValue,
      recentPurchases
    };
  }, [ingredientsList, lowStockIngredients, stockInLogs]);

  // Add/Edit Ingredient submit
  const handleSaveIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    setIngredientError('');

    if (!ingName.trim()) {
      setIngredientError('Ingredient name is required');
      return;
    }

    const trimmedName = ingName.trim();
    const nameExists = ingredientsList.some(
      (ing) => ing.name.toLowerCase() === trimmedName.toLowerCase() && ing.id !== editingIngredient?.id
    );
    if (nameExists) {
      setIngredientError('Ingredient name already exists');
      return;
    }

    const mappedDbUnit = mapToDbUnit(ingUnit);

    if (editingIngredient) {
      // Edit core in Supabase list
      const updatedInventory = inventory.map((core) => {
        if (core.id === editingIngredient.id) {
          return {
            ...core,
            name: trimmedName,
            unit: mappedDbUnit,
            quantity: ingQty,
            lowStockLevel: ingMinQty
          };
        }
        return core;
      });
      storage.setInventory(updatedInventory);
      setInventory(updatedInventory);

      // Save metadata
      const newExt = { ...ingredientsExt };
      newExt[editingIngredient.id] = {
        category: ingCategory,
        costPerUnit: ingCost,
        status: ingStatus,
        displayUnit: ingUnit
      };
      saveExtData(newExt);
    } else {
      // Add new
      const newId = storage.generateId();
      const newCoreItem: InventoryItem = {
        id: newId,
        name: trimmedName,
        unit: mappedDbUnit,
        quantity: ingQty,
        lowStockLevel: ingMinQty
      };
      const updatedInventory = [...inventory, newCoreItem];
      storage.setInventory(updatedInventory);
      setInventory(updatedInventory);

      const newExt = { ...ingredientsExt };
      newExt[newId] = {
        category: ingCategory,
        costPerUnit: ingCost,
        status: ingStatus,
        displayUnit: ingUnit
      };
      saveExtData(newExt);
    }

    setShowIngredientModal(false);
    setEditingIngredient(null);
  };

  const handleOpenAddIngredient = () => {
    setEditingIngredient(null);
    setIngName('');
    setIngCategory('Vegetables');
    setIngUnit('Pieces');
    setIngQty(0);
    setIngMinQty(5);
    setIngCost(0);
    setIngStatus('active');
    setIngredientError('');
    setShowIngredientModal(true);
  };

  const handleOpenEditIngredient = (ing: any) => {
    setEditingIngredient(ing);
    setIngName(ing.name);
    setIngCategory(ing.category);
    setIngUnit(ing.displayUnit);
    setIngQty(ing.quantity);
    setIngMinQty(ing.lowStockLevel);
    setIngCost(ing.costPerUnit);
    setIngStatus(ing.status);
    setIngredientError('');
    setShowIngredientModal(true);
  };

  // Add/Edit Supplier submit
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierError('');

    if (!supName.trim()) {
      setSupplierError('Supplier name is required');
      return;
    }

    if (editingSupplier) {
      const updated = suppliers.map((s) => {
        if (s.id === editingSupplier.id) {
          return {
            ...s,
            name: supName.trim(),
            phone: supPhone.trim(),
            email: supEmail.trim(),
            address: supAddress.trim(),
            gst: supGST.trim(),
            notes: supNotes.trim()
          };
        }
        return s;
      });
      saveSuppliersData(updated);
    } else {
      const newSupplier: Supplier = {
        id: storage.generateId(),
        name: supName.trim(),
        phone: supPhone.trim(),
        email: supEmail.trim(),
        address: supAddress.trim(),
        gst: supGST.trim(),
        notes: supNotes.trim()
      };
      saveSuppliersData([...suppliers, newSupplier]);
    }

    setShowSupplierModal(false);
    setEditingSupplier(null);
  };

  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupPhone('');
    setSupEmail('');
    setSupAddress('');
    setSupGST('');
    setSupNotes('');
    setSupplierError('');
    setShowSupplierModal(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupPhone(sup.phone);
    setSupEmail(sup.email);
    setSupAddress(sup.address);
    setSupGST(sup.gst);
    setSupNotes(sup.notes);
    setSupplierError('');
    setShowSupplierModal(true);
  };

  // Stock In submit
  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStockInError('');

    if (!stockInIngId) {
      setStockInError('Please select an ingredient');
      return;
    }
    if (stockInQty === '' || Number(stockInQty) <= 0) {
      setStockInError('Quantity must be greater than 0');
      return;
    }
    if (stockInPrice === '' || Number(stockInPrice) < 0) {
      setStockInError('Price must be a valid number');
      return;
    }

    // 1. Record stock transaction
    const newTx: StockInTransaction = {
      id: storage.generateId(),
      ingredientId: stockInIngId,
      supplierId: stockInSupId || 'walk-in',
      quantity: Number(stockInQty),
      unit: stockInUnit,
      purchasePrice: Number(stockInPrice),
      date: stockInDate,
      remarks: stockInRemarks.trim(),
      invoiceNumber: stockInInvoice.trim() || 'N/A'
    };
    saveStockInData([...stockInLogs, newTx]);

    // 2. Increase stock quantity in core
    const updatedInventory = inventory.map((core) => {
      if (core.id === stockInIngId) {
        return {
          ...core,
          quantity: core.quantity + Number(stockInQty)
        };
      }
      return core;
    });
    storage.setInventory(updatedInventory);
    setInventory(updatedInventory);

    // 3. Update average cost per unit in metadata
    const newExt = { ...ingredientsExt };
    if (newExt[stockInIngId]) {
      newExt[stockInIngId].costPerUnit = Number(stockInPrice);
      saveExtData(newExt);
    }

    // Reset Form
    setStockInIngId('');
    setStockInSupId('');
    setStockInQty('');
    setStockInPrice('');
    setStockInInvoice('');
    setStockInRemarks('');
    alert('Stock added successfully!');
  };

  // Stock Out submit
  const handleStockOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStockOutError('');

    if (!stockOutIngId) {
      setStockOutError('Please select an ingredient');
      return;
    }
    if (stockOutQty === '' || Number(stockOutQty) <= 0) {
      setStockOutError('Quantity must be greater than 0');
      return;
    }

    const selectedIng = ingredientsList.find((i) => i.id === stockOutIngId);
    if (!selectedIng) return;

    if (selectedIng.quantity < Number(stockOutQty)) {
      setStockOutError(`Insufficient stock. Current stock is ${selectedIng.quantity} ${selectedIng.displayUnit}`);
      return;
    }

    // 1. Record transaction
    const newTx: StockOutTransaction = {
      id: storage.generateId(),
      ingredientId: stockOutIngId,
      quantity: Number(stockOutQty),
      reason: stockOutReason,
      date: stockOutDate
    };
    saveStockOutData([...stockOutLogs, newTx]);

    // 2. Deduct quantity in core
    const updatedInventory = inventory.map((core) => {
      if (core.id === stockOutIngId) {
        return {
          ...core,
          quantity: Math.max(0, core.quantity - Number(stockOutQty))
        };
      }
      return core;
    });
    storage.setInventory(updatedInventory);
    setInventory(updatedInventory);

    // Reset Form
    setStockOutIngId('');
    setStockOutQty('');
    alert('Stock deducted successfully!');
  };

  // Delete Confirm Triggers
  const handleOpenDelete = (type: 'ingredient' | 'supplier', id: string) => {
    setDeleteTarget({ type, id });
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'ingredient') {
      const updatedInventory = inventory.filter((item) => item.id !== deleteTarget.id);
      storage.setInventory(updatedInventory);
      setInventory(updatedInventory);

      const newExt = { ...ingredientsExt };
      delete newExt[deleteTarget.id];
      saveExtData(newExt);
    } else if (deleteTarget.type === 'supplier') {
      const updated = suppliers.filter((s) => s.id !== deleteTarget.id);
      saveSuppliersData(updated);
    }

    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  // CSV Export helper
  const handleCSVExport = () => {
    const headers = ['Ingredient Name', 'Category', 'Unit', 'Current Stock', 'Minimum Stock', 'Cost per Unit', 'Status'];
    const rows = filteredIngredients.map((i) => [
      `"${i.name}"`,
      `"${i.category}"`,
      `"${i.displayUnit}"`,
      i.quantity,
      i.lowStockLevel,
      i.costPerUnit,
      `"${i.status}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ingredients_inventory_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import helper
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      if (lines.length < 2) return;

      const newCoreItems: InventoryItem[] = [];
      const newExts: { [id: string]: IngredientExt } = { ...ingredientsExt };

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // basic comma splitting (ignores embedded commas in quotes for simple format)
        const cols = line.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
        const name = cols[0] || '';
        const category = cols[1] || 'Other';
        const displayUnit = (cols[2] || 'Pieces') as DisplayUnit;
        const quantity = Number(cols[3]) || 0;
        const minStock = Number(cols[4]) || 5;
        const cost = Number(cols[5]) || 0;
        const status = (cols[6] || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';

        if (name) {
          const newId = storage.generateId();
          newCoreItems.push({
            id: newId,
            name,
            unit: mapToDbUnit(displayUnit),
            quantity,
            lowStockLevel: minStock
          });
          newExts[newId] = {
            category,
            costPerUnit: cost,
            status,
            displayUnit
          };
        }
      }

      if (newCoreItems.length > 0) {
        const updatedInventory = [...inventory, ...newCoreItems];
        storage.setInventory(updatedInventory);
        setInventory(updatedInventory);
        saveExtData(newExts);
        alert(`Successfully imported ${newCoreItems.length} ingredients!`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-page font-sans text-text-primary transition-all duration-[220ms] ease-in-out select-none">
      
      {/* LEFT SUB-SIDEBAR PANEL FOR INVENTORY SUBTABS */}
      <div className="w-[200px] bg-bg-card border-r border-border flex flex-col h-full shrink-0 no-print">
        <div className="p-4 border-b border-border bg-bg-card/50">
          <h2 className="text-[14px] font-bold text-primary uppercase tracking-wider">Inventory Menu</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 custom-scrollbar">
          {[
            { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'Ingredients', label: 'Ingredients Master', icon: Package },
            { id: 'Stock In', label: 'Stock In (Add)', icon: ArrowUpRight },
            { id: 'Stock Out', label: 'Stock Out (Deduct)', icon: ArrowDownRight },
            { id: 'Suppliers', label: 'Suppliers Ledger', icon: Users },
            { id: 'Purchase History', label: 'Purchase History', icon: FileText },
            { id: 'Low Stock', label: 'Low Stock Alerts', icon: AlertCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSearchQuery('');
                }}
                className={`w-full text-left px-3 py-2.5 rounded-btn text-[12px] font-semibold transition-all duration-150 flex items-center gap-2 border ${
                  isActive
                    ? 'bg-primary border-primary text-white shadow-card'
                    : 'bg-transparent border-transparent text-text-muted hover:bg-bg-page hover:text-text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-6">
        
        {/* --- TAB 1: DASHBOARD --- */}
        {activeTab === 'Dashboard' && (
          <div className="flex flex-col gap-6">
            
            {/* Page Header */}
            <div>
              <h1 className="page-title sentence-case">Inventory Overview</h1>
              <p className="page-subtitle mt-0.5">Real-time stock value and low stock metrics</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              
              {/* Card 1: Total Ingredients */}
              <div className="bg-bg-card border border-border p-4.5 rounded-card shadow-card flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-text-muted font-medium block">Total Ingredients</span>
                  <span className="text-[20px] font-bold text-text-primary mt-1 block font-mono">
                    {dashboardMetrics.totalIngredients}
                  </span>
                </div>
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <Package className="w-5 h-5" />
                </div>
              </div>

              {/* Card 2: Low Stock Items */}
              <div className={`bg-bg-card border p-4.5 rounded-card shadow-card flex items-center justify-between ${
                dashboardMetrics.lowStockCount > 0 ? 'border-danger/30 bg-danger/5' : 'border-border'
              }`}>
                <div>
                  <span className="text-[11px] text-text-muted font-medium block">Low Stock Items</span>
                  <span className={`text-[20px] font-bold mt-1 block font-mono ${
                    dashboardMetrics.lowStockCount > 0 ? 'text-danger' : 'text-text-primary'
                  }`}>
                    {dashboardMetrics.lowStockCount}
                  </span>
                </div>
                <div className={`p-3 rounded-full ${
                  dashboardMetrics.lowStockCount > 0 ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'
                }`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>

              {/* Card 3: Today's Purchases */}
              <div className="bg-bg-card border border-border p-4.5 rounded-card shadow-card flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-text-muted font-medium block">Today's Purchases</span>
                  <span className="text-[20px] font-bold text-[#1A7A4A] mt-1 block font-mono">
                    {formatCurrency(dashboardMetrics.todayPurchasesAmount)}
                  </span>
                </div>
                <div className="p-3 bg-[#DCFCE7] text-[#1A7A4A] rounded-full">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>

              {/* Card 4: Inventory Asset Value */}
              <div className="bg-bg-card border border-border p-4.5 rounded-card shadow-card flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-text-muted font-medium block">Inventory Value</span>
                  <span className="text-[20px] font-bold text-text-primary mt-1 block font-mono">
                    {formatCurrency(dashboardMetrics.inventoryValue)}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
                  <Coins className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Split row: Low stock alerts (40%) & Recent Purchases (60%) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              
              {/* Critical Low Stock list */}
              <div className="bg-bg-card border border-border rounded-card p-5 shadow-card lg:col-span-2 h-[320px] flex flex-col">
                <h4 className="text-[14px] font-bold text-text-primary flex items-center gap-1.5 mb-3">
                  <AlertTriangle className="w-4 h-4 text-danger" />
                  Low Stock Alerts
                </h4>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2.5">
                  {lowStockIngredients.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-text-hint text-[12px]">
                      All ingredient stocks healthy
                    </div>
                  ) : (
                    lowStockIngredients.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-2 border border-danger/25 bg-danger/5 rounded-btn">
                        <span className="text-[12px] font-bold text-text-primary sentence-case">{item.name}</span>
                        <span className="text-[11px] font-mono font-extrabold text-danger">
                          {item.quantity} / {item.lowStockLevel} {item.displayUnit}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Purchases */}
              <div className="bg-bg-card border border-border rounded-card p-5 shadow-card lg:col-span-3 h-[320px] flex flex-col">
                <h4 className="text-[14px] font-bold text-text-primary flex items-center gap-1.5 mb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  Recent Stock In Purchases
                </h4>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {dashboardMetrics.recentPurchases.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-text-hint text-[12px]">
                      No purchase logs recorded
                    </div>
                  ) : (
                    <table className="w-full text-left text-[12px]">
                      <thead>
                        <tr className="text-text-muted border-b border-border/80 font-bold">
                          <th className="pb-2">Ingredient</th>
                          <th className="pb-2 text-right">Qty</th>
                          <th className="pb-2 text-right">Amount</th>
                          <th className="pb-2 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {dashboardMetrics.recentPurchases.map((log) => {
                          const ing = ingredientsList.find((i) => i.id === log.ingredientId);
                          return (
                            <tr key={log.id} className="hover:bg-bg-page/50">
                              <td className="py-2 sentence-case font-bold">{ing?.name || 'Unknown'}</td>
                              <td className="py-2 text-right font-mono font-medium">{log.quantity} {log.unit}</td>
                              <td className="py-2 text-right font-mono font-bold text-text-primary">
                                {formatCurrency(log.quantity * log.purchasePrice)}
                              </td>
                              <td className="py-2 text-right font-mono text-text-muted">
                                {new Date(log.date).toLocaleDateString('en-GB')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: INGREDIENTS MASTER --- */}
        {activeTab === 'Ingredients' && (
          <div className="flex flex-col gap-6">
            
            {/* Page Header */}
            <div className="flex justify-between items-center no-print">
              <div>
                <h1 className="page-title sentence-case">Ingredients Master</h1>
                <p className="page-subtitle mt-0.5">Define your raw materials and stock levels</p>
              </div>
              <div className="flex items-center gap-2">
                
                {/* CSV Import */}
                <label className="h-[36px] border border-border hover:bg-bg-page rounded-btn px-3 text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer select-none">
                  <Upload className="w-4 h-4 text-text-muted" />
                  Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVImport}
                    className="hidden"
                  />
                </label>

                {/* CSV Export */}
                <button
                  onClick={handleCSVExport}
                  className="h-[36px] border border-border hover:bg-bg-page rounded-btn px-3 text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-text-muted" />
                  Export CSV
                </button>

                {isAdmin && (
                  <button
                    onClick={handleOpenAddIngredient}
                    className="h-[36px] bg-primary hover:bg-primary-dark text-white rounded-btn px-4 text-[12px] font-bold flex items-center gap-1.5 shadow-card"
                  >
                    <Plus className="w-4 h-4" />
                    Add Ingredient
                  </button>
                )}
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 bg-bg-card border border-border p-4 rounded-card shadow-card no-print">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-hint" />
                <input
                  type="text"
                  placeholder="Search ingredient by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[38px] pl-9 pr-3 text-[13px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              <div className="w-48">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-[38px] px-3 text-[13px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ingredients Table */}
            <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
              {filteredIngredients.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No ingredients found"
                  subtitle="Define your kitchen raw items or adjust filters to begin."
                />
              ) : (
                <table className="w-full text-left text-[13px] font-sans">
                  <thead>
                    <tr className="text-text-muted border-b border-border/80 font-bold">
                      <th className="pb-2.5">Name</th>
                      <th className="pb-2.5">Category</th>
                      <th className="pb-2.5 text-right">Current Stock</th>
                      <th className="pb-2.5 text-right">Min Stock</th>
                      <th className="pb-2.5 text-right">Cost/Unit</th>
                      <th className="pb-2.5 text-center">Status</th>
                      {isAdmin && <th className="pb-2.5 text-center no-print">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredIngredients.map((item) => {
                      const isLow = item.quantity <= item.lowStockLevel;
                      return (
                        <tr key={item.id} className="hover:bg-bg-page/50">
                          <td className="py-3 font-bold sentence-case text-text-primary">{item.name}</td>
                          <td className="py-3 font-medium text-text-muted">{item.category}</td>
                          <td className={`py-3 text-right font-mono font-bold ${
                            isLow ? 'text-danger' : 'text-text-primary'
                          }`}>
                            {item.quantity} {item.displayUnit}
                          </td>
                          <td className="py-3 text-right font-mono font-medium text-text-muted">
                            {item.lowStockLevel} {item.displayUnit}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-text-primary">
                            {formatCurrency(item.costPerUnit)}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 border rounded-badge text-[10px] font-semibold uppercase ${
                              item.status === 'active'
                                ? 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]'
                                : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3 text-center no-print">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleOpenEditIngredient(item)}
                                  className="p-1.5 hover:bg-bg-page rounded-btn text-text-muted hover:text-primary transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenDelete('ingredient', item.id)}
                                  className="p-1.5 hover:bg-bg-page rounded-btn text-text-muted hover:text-danger transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 3: STOCK IN (ADD) --- */}
        {activeTab === 'Stock In' && (
          <div className="flex flex-col gap-6 max-w-[620px]">
            <div>
              <h1 className="page-title sentence-case">Record Stock In</h1>
              <p className="page-subtitle mt-0.5">Add raw material intake and link to supplier purchases</p>
            </div>

            <div className="bg-bg-card border border-border p-6 rounded-card shadow-card">
              <form onSubmit={handleStockInSubmit} className="flex flex-col gap-4">
                
                {stockInError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-danger rounded-btn text-[12px] font-medium">
                    {stockInError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="input-label-custom">Ingredient *</label>
                    <select
                      value={stockInIngId}
                      onChange={(e) => {
                        setStockInIngId(e.target.value);
                        const ing = ingredientsList.find((i) => i.id === e.target.value);
                        if (ing) setStockInUnit(ing.displayUnit);
                      }}
                      className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium text-[13px]"
                    >
                      <option value="">Select Ingredient</option>
                      {ingredientsList
                        .filter((i) => i.status === 'active')
                        .map((ing) => (
                          <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="input-label-custom">Supplier</label>
                    <select
                      value={stockInSupId}
                      onChange={(e) => setStockInSupId(e.target.value)}
                      className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium text-[13px]"
                    >
                      <option value="">Walk-in Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="input-label-custom">Quantity *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 10"
                        value={stockInQty}
                        onChange={(e) => setStockInQty(e.target.value ? Number(e.target.value) : '')}
                        className="flex-1 h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
                      />
                      <select
                        value={stockInUnit}
                        onChange={(e) => setStockInUnit(e.target.value as any)}
                        className="w-24 h-[38px] px-2 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[12px] font-medium"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="input-label-custom">Purchase Price per Unit (₹) *</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 150"
                      value={stockInPrice}
                      onChange={(e) => setStockInPrice(e.target.value ? Number(e.target.value) : '')}
                      className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="input-label-custom">Invoice / Bill Number</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-1002"
                      value={stockInInvoice}
                      onChange={(e) => setStockInInvoice(e.target.value)}
                      className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="input-label-custom">Purchase Date</label>
                    <input
                      type="date"
                      value={stockInDate}
                      onChange={(e) => setStockInDate(e.target.value)}
                      className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="input-label-custom">Remarks</label>
                  <textarea
                    placeholder="Wastage note or stock details..."
                    value={stockInRemarks}
                    onChange={(e) => setStockInRemarks(e.target.value)}
                    className="h-[64px] p-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="h-[40px] bg-primary hover:bg-primary-dark text-white rounded-btn font-bold text-[13px] shadow-card mt-2 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Commit Stock In
                </button>

              </form>
            </div>
          </div>
        )}

        {/* --- TAB 4: STOCK OUT (DEDUCT) --- */}
        {activeTab === 'Stock Out' && (
          <div className="flex flex-col gap-6 max-w-[500px]">
            <div>
              <h1 className="page-title sentence-case">Record Stock Out</h1>
              <p className="page-subtitle mt-0.5">Deduct raw items due to spoilage, wastage, or correction logs</p>
            </div>

            <div className="bg-bg-card border border-border p-6 rounded-card shadow-card">
              <form onSubmit={handleStockOutSubmit} className="flex flex-col gap-4">
                
                {stockOutError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-danger rounded-btn text-[12px] font-medium">
                    {stockOutError}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="input-label-custom">Ingredient *</label>
                  <select
                    value={stockOutIngId}
                    onChange={(e) => setStockOutIngId(e.target.value)}
                    className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium text-[13px]"
                  >
                    <option value="">Select Ingredient</option>
                    {ingredientsList
                      .filter((i) => i.status === 'active')
                      .map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} (Current: {ing.quantity} {ing.displayUnit})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="input-label-custom">Quantity *</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5"
                      value={stockOutQty}
                      onChange={(e) => setStockOutQty(e.target.value ? Number(e.target.value) : '')}
                      className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="input-label-custom">Reason / Purpose *</label>
                    <select
                      value={stockOutReason}
                      onChange={(e) => setStockOutReason(e.target.value as any)}
                      className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium text-[13px]"
                    >
                      <option value="Wastage">Wastage</option>
                      <option value="Spoilage">Spoilage</option>
                      <option value="Staff Consumption">Staff Consumption</option>
                      <option value="Corrections">Corrections</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="input-label-custom">Deduction Date</label>
                  <input
                    type="date"
                    value={stockOutDate}
                    onChange={(e) => setStockOutDate(e.target.value)}
                    className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="h-[40px] bg-[#B02020] hover:bg-[#801010] text-white rounded-btn font-bold text-[13px] shadow-card mt-2 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowDownRight className="w-4 h-4" />
                  Commit Stock Out
                </button>

              </form>
            </div>
          </div>
        )}

        {/* --- TAB 5: SUPPLIERS LEDGER --- */}
        {activeTab === 'Suppliers' && (
          <div className="flex flex-col gap-6">
            
            {/* Page Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="page-title sentence-case">Suppliers Ledger</h1>
                <p className="page-subtitle mt-0.5">Manage your ingredient suppliers and merchants list</p>
              </div>
              <button
                onClick={handleOpenAddSupplier}
                className="h-[36px] bg-primary hover:bg-primary-dark text-white rounded-btn px-4 text-[12px] font-bold flex items-center gap-1.5 shadow-card"
              >
                <Plus className="w-4 h-4" />
                Add Supplier
              </button>
            </div>

            {/* Suppliers Table */}
            <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
              {suppliers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No suppliers registered"
                  subtitle="Add your raw product suppliers to start linking stock-in records."
                />
              ) : (
                <table className="w-full text-left text-[13px] font-sans">
                  <thead>
                    <tr className="text-text-muted border-b border-border/80 font-bold">
                      <th className="pb-2.5">Supplier Name</th>
                      <th className="pb-2.5">Phone</th>
                      <th className="pb-2.5">Email</th>
                      <th className="pb-2.5">GST</th>
                      <th className="pb-2.5">Address</th>
                      <th className="pb-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {suppliers.map((sup) => (
                      <tr key={sup.id} className="hover:bg-bg-page/50 text-[12px]">
                        <td className="py-2.5 font-bold text-text-primary sentence-case">{sup.name}</td>
                        <td className="py-2.5 font-mono">{sup.phone || 'N/A'}</td>
                        <td className="py-2.5 font-mono">{sup.email || 'N/A'}</td>
                        <td className="py-2.5 font-mono font-bold text-text-primary">{sup.gst || 'N/A'}</td>
                        <td className="py-2.5 text-text-muted max-w-[160px] truncate">{sup.address || 'N/A'}</td>
                        <td className="py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEditSupplier(sup)}
                              className="p-1.5 hover:bg-bg-page rounded-btn text-text-muted hover:text-primary transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenDelete('supplier', sup.id)}
                              className="p-1.5 hover:bg-bg-page rounded-btn text-text-muted hover:text-danger transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 6: PURCHASE HISTORY --- */}
        {activeTab === 'Purchase History' && (
          <div className="flex flex-col gap-6">
            
            {/* Page Header */}
            <div>
              <h1 className="page-title sentence-case">Purchase History</h1>
              <p className="page-subtitle mt-0.5">Chronological record of stock acquisitions</p>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 bg-bg-card border border-border p-4 rounded-card shadow-card items-center">
              <div className="flex-1 relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-hint" />
                <input
                  type="text"
                  placeholder="Search by ingredient or supplier name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[38px] pl-9 pr-3 text-[13px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div className="w-48 w-full md:w-auto">
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="w-full h-[38px] px-3 text-[13px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium"
                >
                  <option value="all">All Suppliers</option>
                  <option value="walk-in">Walk-in Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                <Calendar className="w-4 h-4 text-text-muted" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-[38px] px-2.5 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary font-medium focus:outline-none focus:border-primary"
                />
                <span className="text-[11px] text-text-hint font-medium">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-[38px] px-2.5 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary font-medium focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Purchase History Table */}
            <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
              {filteredPurchaseHistory.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No purchases found"
                  subtitle="Verify dates or record new Stock In purchases to see records here."
                />
              ) : (
                <table className="w-full text-left text-[13px] font-sans">
                  <thead>
                    <tr className="text-text-muted border-b border-border/80 font-bold">
                      <th className="pb-2.5">Invoice #</th>
                      <th className="pb-2.5">Supplier</th>
                      <th className="pb-2.5">Ingredient</th>
                      <th className="pb-2.5 text-right">Quantity</th>
                      <th className="pb-2.5 text-right">Rate</th>
                      <th className="pb-2.5 text-right">Total Amount</th>
                      <th className="pb-2.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredPurchaseHistory.map((log) => {
                      const ing = ingredientsList.find((i) => i.id === log.ingredientId);
                      const sup = suppliers.find((s) => s.id === log.supplierId);
                      return (
                        <tr key={log.id} className="hover:bg-bg-page/50 text-[12px]">
                          <td className="py-3 font-bold font-mono text-primary">{log.invoiceNumber}</td>
                          <td className="py-3 font-semibold text-text-primary sentence-case">{sup?.name || 'Walk-in Supplier'}</td>
                          <td className="py-3 font-semibold text-text-primary sentence-case">{ing?.name || 'Unknown'}</td>
                          <td className="py-3 text-right font-mono font-medium">{log.quantity} {log.unit}</td>
                          <td className="py-3 text-right font-mono">{formatCurrency(log.purchasePrice)}</td>
                          <td className="py-3 text-right font-mono font-bold text-text-primary">
                            {formatCurrency(log.quantity * log.purchasePrice)}
                          </td>
                          <td className="py-3 text-right font-mono text-text-muted">
                            {new Date(log.date).toLocaleDateString('en-GB')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 7: LOW STOCK ALERTS --- */}
        {activeTab === 'Low Stock' && (
          <div className="flex flex-col gap-6">
            
            {/* Page Header */}
            <div>
              <h1 className="page-title sentence-case text-danger">Low Stock Board</h1>
              <p className="page-subtitle mt-0.5">Ingredients running critical threshold limits</p>
            </div>

            {/* Low Stock Table */}
            <div className="bg-bg-card border border-danger/25 rounded-card p-5 shadow-card bg-danger/5">
              {lowStockIngredients.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 bg-white rounded-card border border-border">
                  <Package className="w-8 h-8 text-[#1A7A4A] mb-1" />
                  <span className="text-[14px] font-bold text-text-primary">All ingredient quantities healthy</span>
                  <span className="text-[12px] text-text-muted">No items are below minimum stock limits currently.</span>
                </div>
              ) : (
                <table className="w-full text-left text-[13px] font-sans">
                  <thead>
                    <tr className="text-danger border-b border-danger/30 font-bold">
                      <th className="pb-2.5">Ingredient Name</th>
                      <th className="pb-2.5">Category</th>
                      <th className="pb-2.5 text-right">Current Stock</th>
                      <th className="pb-2.5 text-right">Minimum Stock Limit</th>
                      <th className="pb-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-danger/20">
                    {lowStockIngredients.map((item) => (
                      <tr key={item.id} className="hover:bg-danger/10 text-[12px]">
                        <td className="py-3 font-bold sentence-case text-danger">{item.name}</td>
                        <td className="py-3 font-medium text-danger/80">{item.category}</td>
                        <td className="py-3 text-right font-mono font-bold text-danger">
                          {item.quantity} {item.displayUnit}
                        </td>
                        <td className="py-3 text-right font-mono font-medium text-danger/70">
                          {item.lowStockLevel} {item.displayUnit}
                        </td>
                        <td className="py-3 text-center">
                          <span className="px-2 py-0.5 bg-[#FEE2E2] text-danger border border-red-300 rounded-badge text-[10px] font-bold uppercase">
                            Low Limit Alert
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>

      {/* --- MODAL 1: ADD/EDIT INGREDIENT --- */}
      <Modal isOpen={showIngredientModal} onClose={() => setShowIngredientModal(false)} title={editingIngredient ? 'Edit Ingredient' : 'Add Ingredient'}>
        <form onSubmit={handleSaveIngredient} className="flex flex-col gap-4">
          
          {ingredientError && (
            <div className="p-3 bg-red-50 border border-red-200 text-danger rounded-btn text-[12px] font-medium">
              {ingredientError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="input-label-custom">Ingredient Name *</label>
            <input
              type="text"
              placeholder="e.g. Chicken breast, Olive oil"
              value={ingName}
              onChange={(e) => setIngName(e.target.value)}
              className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">Category</label>
              <select
                value={ingCategory}
                onChange={(e) => setIngCategory(e.target.value)}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium text-[13px]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">Unit *</label>
              <select
                value={ingUnit}
                onChange={(e) => setIngUnit(e.target.value as DisplayUnit)}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium text-[13px]"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">Current Stock Quantity</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 50"
                value={ingQty}
                onChange={(e) => setIngQty(Number(e.target.value))}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">Minimum Stock Limit</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 10"
                value={ingMinQty}
                onChange={(e) => setIngMinQty(Number(e.target.value))}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">Cost per Unit (₹)</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 120"
                value={ingCost}
                onChange={(e) => setIngCost(Number(e.target.value))}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">Status</label>
              <select
                value={ingStatus}
                onChange={(e) => setIngStatus(e.target.value as any)}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium text-[13px]"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowIngredientModal(false)}
              className="flex-1 h-[38px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[13px] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-[38px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[13px] font-bold transition-colors shadow-card"
            >
              Save Ingredient
            </button>
          </div>

        </form>
      </Modal>

      {/* --- MODAL 2: ADD/EDIT SUPPLIER --- */}
      <Modal isOpen={showSupplierModal} onClose={() => setShowSupplierModal(false)} title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSaveSupplier} className="flex flex-col gap-4">
          
          {supplierError && (
            <div className="p-3 bg-red-50 border border-red-200 text-danger rounded-btn text-[12px] font-medium">
              {supplierError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="input-label-custom">Supplier Name *</label>
            <input
              type="text"
              placeholder="e.g. Metro Wholesale Foods"
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">Phone</label>
              <input
                type="text"
                placeholder="e.g. +91 9876543210"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">Email</label>
              <input
                type="email"
                placeholder="e.g. contact@metro.com"
                value={supEmail}
                onChange={(e) => setSupEmail(e.target.value)}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">GSTIN Registration</label>
              <input
                type="text"
                placeholder="e.g. 37AAAAA0000A1Z2"
                value={supGST}
                onChange={(e) => setSupGST(e.target.value)}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="input-label-custom">Address</label>
              <input
                type="text"
                placeholder="e.g. Satyanarayanapuram, Vijayawada"
                value={supAddress}
                onChange={(e) => setSupAddress(e.target.value)}
                className="h-[38px] px-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="input-label-custom">Merchants Notes</label>
            <textarea
              placeholder="Merchants payment settings or details..."
              value={supNotes}
              onChange={(e) => setSupNotes(e.target.value)}
              className="h-[54px] p-3 border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary text-[13px] font-medium resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowSupplierModal(false)}
              className="flex-1 h-[38px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[13px] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-[38px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[13px] font-bold transition-colors shadow-card"
            >
              Save Supplier
            </button>
          </div>

        </form>
      </Modal>

      {/* --- MODAL 3: CONFIRM DELETE --- */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion">
        <div className="flex flex-col gap-4">
          <div className="text-[13px] text-text-muted leading-relaxed">
            Are you sure you want to permanently delete this {deleteTarget?.type}? This action cannot be undone.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[13px] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="flex-1 h-[36px] bg-[#B02020] hover:bg-[#801010] text-white rounded-btn text-[13px] font-bold transition-colors shadow-card"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
