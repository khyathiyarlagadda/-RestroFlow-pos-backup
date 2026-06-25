import React, { useState, useEffect, useMemo, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { BarChart3, Download, Calendar, Filter, Printer, FileText } from 'lucide-react';
import { storage } from '../utils/storage';
import type { SaleInvoice, MenuItem, Category, InventoryItem } from '../types';
import { EmptyState } from '../components/EmptyState';

type ReportTab =
  | 'daily-sales'
  | 'item-sales'
  | 'group-summary'
  | 'order-type-sales'
  | 'customer-history'
  | 'stock-summary';

// Safe Utilities to prevent formatting & invalid date crashes
const parseDateSafe = (dateString: string, defaultTime: 'start' | 'end') => {
  if (!dateString) return null;
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  
  const date = new Date(year, month, day);
  if (defaultTime === 'start') {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

const formatSafeDate = (dateStr: any) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

const formatSafeDateTime = (dateStr: any) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const getSafeTokenNo = (tokenNo: any) => {
  if (!tokenNo) return 'N/A';
  if (typeof tokenNo !== 'string') return String(tokenNo);
  return tokenNo.split('-').pop() || 'N/A';
};

// React Error Boundary to prevent white screen crashes
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ReportsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Reports Error Boundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-bg-page p-6 text-center select-none font-sans w-full">
          <div className="max-w-md w-full bg-bg-card border border-border p-8 rounded-card shadow-card flex flex-col items-center">
            <span className="text-[48px] mb-4">⚠️</span>
            <h2 className="text-[20px] font-bold text-text-primary mb-2">Something went wrong</h2>
            <p className="text-[13px] text-text-muted mb-6">
              An error occurred while rendering the reports module. We have caught the error and prevented a blank screen.
            </p>
            <div className="w-full bg-bg-page/50 border border-border p-3 rounded font-mono text-[11px] text-primary/80 overflow-auto max-h-[150px] mb-6 text-left whitespace-pre-wrap">
              {this.state.error?.toString()}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="h-[36px] bg-primary hover:bg-primary-hover text-white rounded-btn px-6 text-[13px] font-medium transition-colors cursor-pointer"
            >
              Reload Reports
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ReportsContent: React.FC = () => {
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Selected Report
  const [activeReport, setActiveReport] = useState<ReportTab>('daily-sales');

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sortOption, setSortOption] = useState<'most' | 'least' | 'high-rev' | 'low-rev'>('most');

  useEffect(() => {
    setSales(storage.getSales());
    setMenuItems(storage.getMenuItems());
    setCategories(storage.getCategories());
    setInventory(storage.getInventory());

    const handleCatsUpdate = () => {
      setCategories(storage.getCategories());
    };
    const handleMenuUpdate = () => {
      setMenuItems(storage.getMenuItems());
    };
    const handleSalesUpdate = () => {
      setSales(storage.getSales());
    };
    const handleInventoryUpdate = () => {
      setInventory(storage.getInventory());
    };

    window.addEventListener('categoriesUpdated', handleCatsUpdate);
    window.addEventListener('menuUpdated', handleMenuUpdate);
    window.addEventListener('salesUpdated', handleSalesUpdate);
    window.addEventListener('inventoryUpdated', handleInventoryUpdate);

    return () => {
      window.removeEventListener('categoriesUpdated', handleCatsUpdate);
      window.removeEventListener('menuUpdated', handleMenuUpdate);
      window.removeEventListener('salesUpdated', handleSalesUpdate);
      window.removeEventListener('inventoryUpdated', handleInventoryUpdate);
    };
  }, []);

  const categoryMap = useMemo(() => {
    const map: { [key: string]: string } = {};
    categories.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  // Date Filtering Helper (local timezone dates)
  const dateFilteredSales = useMemo(() => {
    const now = new Date();
    const localTodayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD local format
    
    const salesList = Array.isArray(sales) ? sales : [];

    return salesList.filter((sale) => {
      if (!sale || !sale.dateTime) return false;
      
      const saleDate = new Date(sale.dateTime);
      if (isNaN(saleDate.getTime())) return false;
      
      const saleDateStr = saleDate.toLocaleDateString('en-CA');
      
      if (dateFilter === 'today') {
        return saleDateStr === localTodayStr;
      }
      
      if (dateFilter === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');
        return saleDateStr === yesterdayStr;
      }
      
      if (dateFilter === 'week') {
        // Current calendar week starting Monday
        const startOfWeek = new Date();
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        return saleDate >= startOfWeek && saleDate <= now;
      }
      
      if (dateFilter === 'month') {
        // Current Month (start of calendar month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        return saleDate >= startOfMonth && saleDate <= now;
      }

      if (dateFilter === 'year') {
        // Current Year (start of calendar year)
        const startOfYear = new Date();
        startOfYear.setMonth(0, 1);
        startOfYear.setHours(0, 0, 0, 0);
        return saleDate >= startOfYear && saleDate <= now;
      }
      
      if (dateFilter === 'custom') {
        const start = parseDateSafe(customStart, 'start');
        const end = parseDateSafe(customEnd, 'end');
        if (start && end) {
          return saleDate >= start && saleDate <= end;
        } else if (start) {
          return saleDate >= start;
        } else if (end) {
          return saleDate <= end;
        }
        return true;
      }
      
      return true;
    });
  }, [sales, dateFilter, customStart, customEnd]);

  // Date Range Display String
  const dateRangeDisplay = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'today') {
      return `Date: ${now.toLocaleDateString()}`;
    }
    if (dateFilter === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      return `Date: ${yesterday.toLocaleDateString()}`;
    }
    if (dateFilter === 'week') {
      const startOfWeek = new Date();
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      return `Range: ${startOfWeek.toLocaleDateString()} - ${now.toLocaleDateString()}`;
    }
    if (dateFilter === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      return `Range: ${startOfMonth.toLocaleDateString()} - ${now.toLocaleDateString()}`;
    }
    if (dateFilter === 'year') {
      const startOfYear = new Date();
      startOfYear.setMonth(0, 1);
      return `Range: ${startOfYear.toLocaleDateString()} - ${now.toLocaleDateString()}`;
    }
    if (dateFilter === 'custom') {
      const start = parseDateSafe(customStart, 'start');
      const end = parseDateSafe(customEnd, 'end');
      const startStr = start ? start.toLocaleDateString() : 'Beginning';
      const endStr = end ? end.toLocaleDateString() : now.toLocaleDateString();
      return `Range: ${startStr} - ${endStr}`;
    }
    return '';
  }, [dateFilter, customStart, customEnd]);

  // 1. Item Sales Summary
  const itemSummaryData = useMemo(() => {
    const data: {
      [key: string]: {
        name: string;
        categoryId: string;
        qtySold: number;
        revenue: number;
        avgPrice: number;
        lastSold: string;
      };
    } = {};

    const filtered = Array.isArray(dateFilteredSales) ? dateFilteredSales : [];
    const menu = Array.isArray(menuItems) ? menuItems : [];

    filtered.forEach((sale) => {
      if (!sale || !sale.items || !Array.isArray(sale.items)) return;
      sale.items.forEach((item) => {
        if (!item) return;
        const key = item.variationName ? `${item.name} (${item.variationName})` : item.name;
        if (!key) return;
        
        if (!data[key]) {
          const mItem = menu.find((m) => m && m.id === item.menuItemId);
          data[key] = {
            name: key,
            categoryId: mItem ? mItem.categoryId : '',
            qtySold: 0,
            revenue: 0,
            avgPrice: 0,
            lastSold: sale.dateTime || ''
          };
        }
        data[key].qtySold += item.quantity || 0;
        data[key].revenue += (item.price || 0) * (item.quantity || 0);
        
        const saleTime = sale.dateTime ? new Date(sale.dateTime).getTime() : 0;
        const lastSoldTime = data[key].lastSold ? new Date(data[key].lastSold).getTime() : 0;
        if (saleTime > lastSoldTime) {
          data[key].lastSold = sale.dateTime || '';
        }
      });
    });

    Object.keys(data).forEach((k) => {
      const item = data[k];
      item.avgPrice = item.qtySold > 0 ? item.revenue / item.qtySold : 0;
    });

    return Object.values(data).sort((a, b) => {
      if (sortOption === 'most') return (b.qtySold || 0) - (a.qtySold || 0);
      if (sortOption === 'least') return (a.qtySold || 0) - (b.qtySold || 0);
      if (sortOption === 'high-rev') return (b.revenue || 0) - (a.revenue || 0);
      if (sortOption === 'low-rev') return (a.revenue || 0) - (b.revenue || 0);
      return 0;
    });
  }, [dateFilteredSales, menuItems, sortOption]);

  // 2. Group Summary (Category breakdown)
  const categorySummaryData = useMemo(() => {
    const data: {
      [key: string]: {
        name: string;
        qtySold: number;
        revenue: number;
      };
    } = {};

    const filtered = Array.isArray(dateFilteredSales) ? dateFilteredSales : [];
    const menu = Array.isArray(menuItems) ? menuItems : [];

    filtered.forEach((sale) => {
      if (!sale || !sale.items || !Array.isArray(sale.items)) return;
      sale.items.forEach((item) => {
        if (!item) return;
        const mItem = menu.find((m) => m && m.id === item.menuItemId);
        const catId = mItem ? mItem.categoryId : 'uncategorized';
        const catName = mItem && categoryMap[catId] ? categoryMap[catId] : 'Uncategorized';

        if (!data[catId]) {
          data[catId] = {
            name: catName,
            qtySold: 0,
            revenue: 0
          };
        }
        data[catId].qtySold += item.quantity || 0;
        data[catId].revenue += (item.price || 0) * (item.quantity || 0);
      });
    });

    return Object.values(data).sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  }, [dateFilteredSales, menuItems, categoryMap]);

  // 3. Order Summary (Order type breakdown)
  const orderSummaryData = useMemo(() => {
    const data = {
      'Dine In': { count: 0, revenue: 0 },
      'Takeaway': { count: 0, revenue: 0 },
      'Delivery': { count: 0, revenue: 0 }
    };
    
    const filtered = Array.isArray(dateFilteredSales) ? dateFilteredSales : [];
    filtered.forEach((s) => {
      if (s && s.orderType && data[s.orderType]) {
        data[s.orderType].count += 1;
        data[s.orderType].revenue += s.grandTotal || 0;
      }
    });
    return Object.entries(data).map(([type, stats]) => ({
      type,
      count: stats.count,
      revenue: stats.revenue
    }));
  }, [dateFilteredSales]);

  // 4. Customer History
  const customerHistoryData = useMemo(() => {
    const data: {
      [id: string]: {
        name: string;
        email?: string;
        phone?: string;
        ordersCount: number;
        spent: number;
        lastOrder: string;
      };
    } = {};

    const filtered = Array.isArray(dateFilteredSales) ? dateFilteredSales : [];

    filtered.forEach((sale) => {
      if (!sale) return;
      const cid = sale.customerId || 'walk-in';
      const cname = sale.customerName || 'Walk-in Customer';

      if (!data[cid]) {
        const custs = storage.getCustomers();
        const cust = Array.isArray(custs) ? custs.find((c) => c && c.id === cid) : null;
        data[cid] = {
          name: cname,
          email: cust?.email,
          phone: cust?.phone,
          ordersCount: 0,
          spent: 0,
          lastOrder: sale.dateTime || ''
        };
      }

      data[cid].ordersCount += 1;
      data[cid].spent += sale.grandTotal || 0;
      
      const saleTime = sale.dateTime ? new Date(sale.dateTime).getTime() : 0;
      const lastOrderTime = data[cid].lastOrder ? new Date(data[cid].lastOrder).getTime() : 0;
      if (saleTime > lastOrderTime) {
        data[cid].lastOrder = sale.dateTime || '';
      }
    });

    return Object.values(data).sort((a, b) => (b.spent || 0) - (a.spent || 0));
  }, [dateFilteredSales]);

  // Generic CSV exporter (Excel compatible)
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    const filename = `Report_${activeReport}_${dateFilter}`;
    const filtered = Array.isArray(dateFilteredSales) ? dateFilteredSales : [];

    if (activeReport === 'daily-sales') {
      headers = ['Token Number', 'Date & Time', 'Order Type', 'Payment Method', 'Order Total'];
      rows = filtered.map((sale) => [
        `Token #${getSafeTokenNo(sale.tokenNo)}`,
        formatSafeDateTime(sale.dateTime),
        sale.orderType || '—',
        sale.paymentMethod || '—',
        `₹${sale.grandTotal || 0}`
      ]);
    } else if (activeReport === 'item-sales') {
      headers = ['Item Name', 'Category', 'Qty Sold', 'Revenue', 'Avg Price', 'Last Sold'];
      rows = itemSummaryData.map((item) => [
        item.name || '—',
        categoryMap[item.categoryId] || 'Uncategorized',
        item.qtySold || 0,
        `₹${item.revenue || 0}`,
        `₹${Math.round(item.avgPrice || 0)}`,
        formatSafeDate(item.lastSold)
      ]);
    } else if (activeReport === 'group-summary') {
      headers = ['Category Name', 'Total Items Sold', 'Total Revenue'];
      rows = categorySummaryData.map((item) => [
        item.name || '—',
        item.qtySold || 0,
        `₹${item.revenue || 0}`
      ]);
    } else if (activeReport === 'order-type-sales') {
      headers = ['Order Type', 'Total Orders', 'Total Billings'];
      rows = orderSummaryData.map((item) => [
        item.type || '—',
        item.count || 0,
        `₹${item.revenue || 0}`
      ]);
    } else if (activeReport === 'customer-history') {
      headers = ['Customer Name', 'Phone', 'Email', 'Orders Count', 'Total Spent', 'Last Order'];
      rows = customerHistoryData.map((c) => [
        c.name || '—',
        c.phone || '—',
        c.email || '—',
        c.ordersCount || 0,
        `₹${c.spent || 0}`,
        formatSafeDate(c.lastOrder)
      ]);
    } else if (activeReport === 'stock-summary') {
      headers = ['Item Name', 'Unit', 'Remaining Quantity', 'Alert level'];
      const invList = Array.isArray(inventory) ? inventory : [];
      rows = invList.map((item) => [
        item.name || '—',
        item.unit || '—',
        item.quantity ?? 0,
        item.lowStockLevel ?? 0
      ]);
    }

    if (rows.length === 0) return;

    const formatCSVValue = (val: any) => {
      const stringVal = String(val);
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    };

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map(formatCSVValue).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    alert("To save this report as PDF, choose 'Save as PDF' or 'Microsoft Print to PDF' in the Destination list of the print dialog.");
    window.print();
  };

  const hasNoSalesData = !Array.isArray(sales) || sales.length === 0;

  return (
    <div className="flex h-screen overflow-hidden bg-bg-page font-sans text-text-primary transition-all duration-[220ms] ease-in-out select-none">
      
      {/* LEFT PANEL: Report Selection (200px) */}
      <div className="w-[200px] bg-bg-card border-r border-border flex flex-col h-full shrink-0 print:hidden">
        <div className="p-4 border-b border-border bg-bg-card/50">
          <h2 className="text-[14px] font-medium text-text-muted sentence-case">Reports Panel</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-4 custom-scrollbar text-[13px]">
          
          {/* Section 1: Sales reports */}
          <div className="flex flex-col gap-1">
            <span className="px-2 text-[11px] text-text-hint font-medium uppercase tracking-wider mb-1 sentence-case">
              Sales Reports
            </span>
            <button
              onClick={() => setActiveReport('daily-sales')}
              className={`w-full text-left px-2 py-1.5 rounded transition-all cursor-pointer ${
                activeReport === 'daily-sales'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-muted hover:bg-bg-page'
              }`}
            >
              Sales Summary
            </button>
            <button
              onClick={() => setActiveReport('item-sales')}
              className={`w-full text-left px-2 py-1.5 rounded transition-all cursor-pointer ${
                activeReport === 'item-sales'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-muted hover:bg-bg-page'
              }`}
            >
              Item Summary
            </button>
            <button
              onClick={() => setActiveReport('group-summary')}
              className={`w-full text-left px-2 py-1.5 rounded transition-all cursor-pointer ${
                activeReport === 'group-summary'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-muted hover:bg-bg-page'
              }`}
            >
              Group Summary
            </button>
            <button
              onClick={() => setActiveReport('order-type-sales')}
              className={`w-full text-left px-2 py-1.5 rounded transition-all cursor-pointer ${
                activeReport === 'order-type-sales'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-muted hover:bg-bg-page'
              }`}
            >
              Order Summary
            </button>
          </div>

          {/* Section 2: Inventory */}
          <div className="flex flex-col gap-1">
            <span className="px-2 text-[11px] text-text-hint font-medium uppercase tracking-wider mb-1 sentence-case">
              Inventory Reports
            </span>
            <button
              onClick={() => setActiveReport('stock-summary')}
              className={`w-full text-left px-2 py-1.5 rounded transition-all cursor-pointer ${
                activeReport === 'stock-summary'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-muted hover:bg-bg-page'
              }`}
            >
              Stock Summary
            </button>
          </div>

          {/* Section 3: Customers */}
          <div className="flex flex-col gap-1">
            <span className="px-2 text-[11px] text-text-hint font-medium uppercase tracking-wider mb-1 sentence-case">
              Customer Reports
            </span>
            <button
              onClick={() => setActiveReport('customer-history')}
              className={`w-full text-left px-2 py-1.5 rounded transition-all cursor-pointer ${
                activeReport === 'customer-history'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-muted hover:bg-bg-page'
              }`}
            >
              Customer History
            </button>
          </div>

        </div>
      </div>

      {/* RIGHT PANEL: Report View Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Header & Filter Controls */}
        <div className="p-6 bg-bg-card border-b border-border flex flex-col gap-4 shrink-0 shadow-card print:hidden">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="page-title sentence-case flex items-center gap-2 flex-wrap text-[28px]">
                {activeReport === 'daily-sales' && 'Sales Summary'}
                {activeReport === 'item-sales' && 'Item Summary'}
                {activeReport === 'group-summary' && 'Group Summary'}
                {activeReport === 'order-type-sales' && 'Order Summary'}
                {activeReport === 'stock-summary' && 'Stock Summary'}
                {activeReport === 'customer-history' && 'Customer History'}
                <span className="text-[12px] font-normal text-text-hint px-2 py-0.5 border border-border rounded bg-bg-page font-mono">
                  {dateRangeDisplay}
                </span>
              </h1>
              <p className="page-subtitle mt-0.5 sentence-case">
                Visualizing restaurant inventory and billing metrics
              </p>
            </div>
            {!hasNoSalesData && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="h-[36px] border border-border hover:bg-bg-page text-text-primary rounded-btn px-4 text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                  title="Export Excel (CSV)"
                >
                  <Download className="w-4 h-4" />
                  Export Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  className="h-[36px] border border-border hover:bg-bg-page text-text-primary rounded-btn px-4 text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                  title="Export PDF"
                >
                  <FileText className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="h-[36px] border border-border hover:bg-bg-page text-text-primary rounded-btn px-4 text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 cursor-pointer"
                  title="Print Report"
                >
                  <Printer className="w-4 h-4" />
                  Print Report
                </button>
              </div>
            )}
          </div>

          {/* Filters (Applicable to all reports except stock summary) */}
          {activeReport !== 'stock-summary' && !hasNoSalesData && (
            <div className="flex flex-wrap items-center gap-4 bg-bg-page/40 p-3 rounded-card border border-border/80 text-[13px]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-muted" />
                <span className="font-medium text-text-muted sentence-case">Range:</span>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="h-8 py-0 px-2 text-[13px]"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 animate-[fadeIn_150ms_ease]">
                  <span className="text-text-muted">From:</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 py-0 px-2 text-[13px] font-mono"
                  />
                  <span className="text-text-hint">To:</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 py-0 px-2 text-[13px] font-mono"
                  />
                </div>
              )}

              {activeReport === 'item-sales' && (
                <div className="flex items-center gap-2 ml-auto">
                  <Filter className="w-4 h-4 text-text-muted" />
                  <span className="font-medium text-text-muted sentence-case">Sort by:</span>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as any)}
                    className="h-8 py-0 px-2 text-[13px]"
                  >
                    <option value="most">Most Sold</option>
                    <option value="least">Least Sold</option>
                    <option value="high-rev">Highest Revenue</option>
                    <option value="low-rev">Lowest Revenue</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Pane */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar print:overflow-visible print:p-0">
          {hasNoSalesData ? (
            <EmptyState
              icon={BarChart3}
              title="No sales data available yet"
              subtitle="Start billing orders to generate analytics, trend graphs, and inventory reports."
            />
          ) : activeReport !== 'stock-summary' && (!dateFilteredSales || dateFilteredSales.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 bg-bg-card border border-border rounded-card shadow-card select-none">
              <BarChart3 className="w-12 h-12 text-text-hint mb-4" />
              <h3 className="text-[16px] font-bold text-text-primary mb-1">No sales found for selected period</h3>
              <p className="text-[13px] text-text-muted">Try selecting a different date range or category filter.</p>
            </div>
          ) : (
            <div className="bg-bg-card border border-border rounded-card shadow-card overflow-hidden print:border-none print:shadow-none print-area">
              
              {/* PRINT ONLY Header */}
              <div className="hidden print:flex flex-col gap-1 p-5 border-b border-dashed border-black/40 text-center mb-6">
                <span className="text-[20px] font-bold">RestroFlow Restaurant Management System</span>
                <span className="text-[14px] font-semibold uppercase">
                  {activeReport === 'daily-sales' && 'Sales Summary Report'}
                  {activeReport === 'item-sales' && 'Item Summary Report'}
                  {activeReport === 'group-summary' && 'Group Summary (Categories) Report'}
                  {activeReport === 'order-type-sales' && 'Order Type Breakdown Report'}
                  {activeReport === 'stock-summary' && 'Stock Summary Report'}
                  {activeReport === 'customer-history' && 'Customer Purchase History Report'}
                </span>
                <span className="text-[11px] font-mono italic">{dateRangeDisplay}</span>
              </div>

              {/* 1. SALES SUMMARY VIEW */}
              {activeReport === 'daily-sales' && (() => {
                const totalBills = dateFilteredSales.length;
                const grossBillings = dateFilteredSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
                const avgTicket = totalBills > 0 ? Math.round(grossBillings / totalBills) : 0;

                return (
                  <div className="p-6 flex flex-col gap-6 text-[14px] print:p-0">
                    <div>
                      <h4 className="font-semibold text-text-primary text-[16px] mb-1 print:hidden">Sales Performance Summary</h4>
                      <p className="text-[12px] text-text-muted print:hidden">Calculated directly from completed sales transactions within the selected range.</p>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border border-border p-4 rounded-btn bg-bg-page/40 shadow-card print:border-black/30 print:bg-transparent">
                        <span className="text-[11px] text-text-muted uppercase block font-semibold print:text-black">Total Bills Processed</span>
                        <strong className="text-[22px] font-bold text-primary font-mono block mt-1 print:text-black">{totalBills}</strong>
                        <span className="text-[10px] text-text-hint block mt-1.5 font-mono italic print:text-black">Formula: Count(Filtered Sales)</span>
                      </div>
                      <div className="border border-border p-4 rounded-btn bg-bg-page/40 shadow-card print:border-black/30 print:bg-transparent">
                        <span className="text-[11px] text-text-muted uppercase block font-semibold print:text-black">Gross Billings Generated</span>
                        <strong className="text-[22px] font-bold text-primary font-mono block mt-1 print:text-black">₹{grossBillings.toLocaleString('en-IN')}</strong>
                        <span className="text-[10px] text-text-hint block mt-1.5 font-mono italic print:text-black">Formula: Sum(Grand Total)</span>
                      </div>
                      <div className="border border-border p-4 rounded-btn bg-bg-page/40 shadow-card print:border-black/30 print:bg-transparent">
                        <span className="text-[11px] text-text-muted uppercase block font-semibold print:text-black">Average Ticket Value</span>
                        <strong className="text-[22px] font-bold text-primary font-mono block mt-1 print:text-black">₹{avgTicket.toLocaleString('en-IN')}</strong>
                        <span className="text-[10px] text-text-hint block mt-1.5 font-mono italic print:text-black">Formula: Gross Billings / Total Bills</span>
                      </div>
                    </div>

                    <div className="border-b border-border/80 my-1 print:border-black/30" />

                    {/* Filtered Sales Table */}
                    <div>
                      <h5 className="font-semibold text-text-primary text-[14px] mb-3 print:text-black">Completed Sales Transactions ({totalBills})</h5>
                      {dateFilteredSales.length === 0 ? (
                        <div className="text-center py-8 text-text-hint bg-bg-page/20 border border-dashed border-border rounded-btn italic print:border-black print:text-black">
                          No completed sales records found for this range.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-border rounded-btn bg-bg-card print:border-black print:overflow-visible">
                          <table className="w-full text-left border-collapse text-[13px] print:text-black">
                            <thead>
                              <tr className="bg-bg-page/50 border-b border-border text-text-muted font-semibold print:bg-transparent print:border-black/30">
                                <th className="p-3">Token Number</th>
                                <th className="p-3">Date & Time</th>
                                <th className="p-3">Order Type</th>
                                <th className="p-3">Payment Method</th>
                                <th className="p-3 text-right">Order Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 print:divide-black/20">
                              {dateFilteredSales.map((sale, idx) => (
                                <tr key={sale.tokenNo || idx} className="hover:bg-bg-page/20 transition-colors duration-100 print:hover:bg-transparent">
                                  <td className="p-3 font-mono font-bold text-primary print:text-black">
                                    Token #{getSafeTokenNo(sale.tokenNo)}
                                  </td>
                                  <td className="p-3">
                                    {formatSafeDateTime(sale.dateTime)}
                                  </td>
                                  <td className="p-3">{sale.orderType || '—'}</td>
                                  <td className="p-3">
                                    <span className="text-[11px] font-medium text-text-muted bg-bg-page px-2 py-0.5 border border-border rounded-badge print:bg-transparent print:border-black/30 print:text-black">
                                      {sale.paymentMethod || '—'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right font-mono font-semibold text-text-primary print:text-black">
                                    ₹{(sale.grandTotal || 0).toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 2. ITEM SALES SUMMARY VIEW */}
              {activeReport === 'item-sales' && (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse text-[14px] print:text-black">
                    <thead>
                      <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted print:bg-transparent print:border-black/30">
                        <th className="p-4 font-medium">Item Name</th>
                        <th className="p-4 font-medium">Category</th>
                        <th className="p-4 font-medium text-center">Quantity Sold</th>
                        <th className="p-4 font-medium text-right">Revenue</th>
                        <th className="p-4 font-medium text-right">Avg Price</th>
                        <th className="p-4 font-medium text-right">Last Sold</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 print:divide-black/20">
                      {itemSummaryData.map((item, i) => (
                        <tr key={i} className="hover:bg-bg-page/10 transition-colors duration-100 print:hover:bg-transparent">
                          <td className="p-4 font-medium text-text-primary sentence-case print:text-black">{item.name || '—'}</td>
                          <td className="p-4">
                            <span className="text-[11px] font-medium text-text-muted bg-bg-page px-2 py-0.5 border border-border rounded-badge sentence-case print:bg-transparent print:border-black/30 print:text-black">
                              {categoryMap[item.categoryId] || 'Uncategorized'}
                            </span>
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-primary print:text-black">{item.qtySold || 0}</td>
                          <td className="p-4 text-right font-mono font-medium print:text-black">₹{(item.revenue || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right font-mono text-text-muted print:text-black">₹{Math.round(item.avgPrice || 0)}</td>
                          <td className="p-4 text-right font-mono text-text-muted print:text-black">
                            {formatSafeDate(item.lastSold)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 3. GROUP SUMMARY VIEW (Category breakdown) */}
              {activeReport === 'group-summary' && (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse text-[14px] print:text-black">
                    <thead>
                      <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted print:bg-transparent print:border-black/30">
                        <th className="p-4 font-medium">Category Name</th>
                        <th className="p-4 font-medium text-center">Total Items Sold</th>
                        <th className="p-4 font-medium text-right">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 print:divide-black/20">
                      {categorySummaryData.map((item, i) => (
                        <tr key={i} className="hover:bg-bg-page/10 transition-colors duration-100 print:hover:bg-transparent">
                          <td className="p-4 font-medium text-text-primary sentence-case print:text-black">{item.name || '—'}</td>
                          <td className="p-4 text-center font-mono font-bold text-primary print:text-black">{item.qtySold || 0}</td>
                          <td className="p-4 text-right font-mono font-medium print:text-black">₹{(item.revenue || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 4. ORDER SUMMARY VIEW */}
              {activeReport === 'order-type-sales' && (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse text-[14px] print:text-black">
                    <thead>
                      <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted print:bg-transparent print:border-black/30">
                        <th className="p-4 font-medium">Order Type</th>
                        <th className="p-4 font-medium text-center">Total Orders</th>
                        <th className="p-4 font-medium text-right">Total Billings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 print:divide-black/20">
                      {orderSummaryData.map((item, i) => (
                        <tr key={i} className="hover:bg-bg-page/10 transition-colors duration-100 print:hover:bg-transparent">
                          <td className="p-4 font-medium text-text-primary print:text-black">{item.type || '—'}</td>
                          <td className="p-4 text-center font-mono font-bold text-primary print:text-black">{item.count || 0}</td>
                          <td className="p-4 text-right font-mono font-medium print:text-black">₹{(item.revenue || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. CUSTOMER HISTORY VIEW */}
              {activeReport === 'customer-history' && (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse text-[14px] print:text-black">
                    <thead>
                      <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted print:bg-transparent print:border-black/30">
                        <th className="p-4 font-medium">Customer Name</th>
                        <th className="p-4 font-medium">Phone</th>
                        <th className="p-4 font-medium">Email</th>
                        <th className="p-4 font-medium text-center">Orders Count</th>
                        <th className="p-4 font-medium text-right">Total Spent</th>
                        <th className="p-4 font-medium text-right">Last Order Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 print:divide-black/20">
                      {customerHistoryData.map((c, i) => (
                        <tr key={i} className="hover:bg-bg-page/10 transition-colors duration-100 print:hover:bg-transparent">
                          <td className="p-4 font-medium text-text-primary sentence-case print:text-black">{c.name || '—'}</td>
                          <td className="p-4 text-text-muted print:text-black">{c.phone || '—'}</td>
                          <td className="p-4 text-text-muted print:text-black">{c.email || '—'}</td>
                          <td className="p-4 text-center font-mono font-bold text-primary print:text-black">{c.ordersCount || 0}</td>
                          <td className="p-4 text-right font-mono font-medium print:text-black">₹{(c.spent || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-right font-mono text-text-muted print:text-black">
                            {formatSafeDate(c.lastOrder)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6. STOCK SUMMARY VIEW */}
              {activeReport === 'stock-summary' && (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left border-collapse text-[14px] print:text-black">
                    <thead>
                      <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted print:bg-transparent print:border-black/30">
                        <th className="p-4 font-medium">Item Name</th>
                        <th className="p-4 font-medium">Unit</th>
                        <th className="p-4 font-medium text-center">Remaining Quantity</th>
                        <th className="p-4 font-medium text-center">Alert level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 print:divide-black/20">
                      {inventory.map((item, i) => (
                        <tr key={i} className="hover:bg-bg-page/10 transition-colors duration-100 print:hover:bg-transparent">
                          <td className="p-4 font-medium text-text-primary sentence-case print:text-black">{item.name || '—'}</td>
                          <td className="p-4 text-text-muted print:text-black">{item.unit || '—'}</td>
                          <td className="p-4 text-center font-mono font-bold print:text-black">{item.quantity ?? 0}</td>
                          <td className="p-4 text-center font-mono text-text-muted print:text-black">{item.lowStockLevel ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Reports: React.FC = () => {
  return (
    <ReportsErrorBoundary>
      <ReportsContent />
    </ReportsErrorBoundary>
  );
};

