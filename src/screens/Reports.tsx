import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  Filter,
  Printer,
  Download,
  Users,
  UtensilsCrossed,
  Clock,
  TrendingUp,
  Briefcase,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Search
} from 'lucide-react';
import { storage } from '../utils/storage';
import type { SaleInvoice, MenuItem, Category, InventoryItem, User } from '../types';
import { EmptyState } from '../components/EmptyState';

// Helper to format currency
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(val);
};

// Stable Hash for Staff mapping
const associateInvoiceToUser = (invoiceId: string, usersList: User[]): string => {
  if (usersList.length === 0) return 'System';
  let hash = 0;
  for (let i = 0; i < invoiceId.length; i++) {
    hash = invoiceId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % usersList.length;
  return usersList[idx].username;
};

// SVG Donut Chart slice
interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const DonutChart: React.FC<{ data: DonutSlice[] }> = ({ data }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let accumulatedAngle = 0;

  if (total === 0) {
    return (
      <div className="h-[180px] flex items-center justify-center text-text-hint text-[12px]">
        No proportion data
      </div>
    );
  }

  return (
    <div className="flex items-center justify-around gap-4">
      <svg viewBox="0 0 160 160" className="w-[140px] h-[140px] overflow-visible">
        {data.map((slice, i) => {
          if (slice.value === 0) return null;
          const percentage = slice.value / total;
          const strokeDash = percentage * 2 * Math.PI * 40; // radius = 40
          const strokeOffset = (1 - accumulatedAngle) * 2 * Math.PI * 40;
          accumulatedAngle += percentage;

          return (
            <circle
              key={i}
              cx="80"
              cy="80"
              r="40"
              fill="transparent"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${strokeDash} ${2 * Math.PI * 40}`}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 80 80)"
              className="transition-all duration-300 hover:stroke-[20] cursor-pointer"
            >
              <title>{`${slice.label}: ${slice.value.toFixed(0)} (${(percentage * 100).toFixed(1)}%)`}</title>
            </circle>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 max-w-[150px]">
        {data.map((slice, i) => {
          if (slice.value === 0) return null;
          const percentage = (slice.value / total) * 100;
          return (
            <div key={i} className="flex items-center gap-2 text-[11px] text-text-muted">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }}></span>
              <span className="truncate font-semibold text-text-primary sentence-case">{slice.label}</span>
              <span className="font-mono text-text-hint shrink-0">({percentage.toFixed(0)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Dashboard' | 'Sales' | 'ItemPerformance' | 'Category' | 'Hourly' | 'DailyComparison' | 'Profit' | 'Customer' | 'Staff'>('Dashboard');

  // Core stores
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Global filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [selectedPayMethod, setSelectedPayMethod] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedMenuItem, setSelectedMenuItem] = useState('all');

  // Sorting
  const [itemSortOption, setItemSortOption] = useState<'revenue' | 'most-sold' | 'least-sold'>('revenue');

  useEffect(() => {
    setSales(storage.getSales());
    setMenuItems(storage.getMenuItems());
    setCategories(storage.getCategories());
    setInventory(storage.getInventory());
    setUsers(storage.getUsers());

    const handleSales = () => setSales(storage.getSales());
    const handleMenu = () => setMenuItems(storage.getMenuItems());
    const handleCats = () => setCategories(storage.getCategories());
    const handleInv = () => setInventory(storage.getInventory());
    const handleUsers = () => setUsers(storage.getUsers());

    window.addEventListener('salesUpdated', handleSales);
    window.addEventListener('menuUpdated', handleMenu);
    window.addEventListener('categoriesUpdated', handleCats);
    window.addEventListener('inventoryUpdated', handleInv);
    window.addEventListener('usersUpdated', handleUsers);

    return () => {
      window.removeEventListener('salesUpdated', handleSales);
      window.removeEventListener('menuUpdated', handleMenu);
      window.removeEventListener('categoriesUpdated', handleCats);
      window.removeEventListener('inventoryUpdated', handleInv);
      window.removeEventListener('usersUpdated', handleUsers);
    };
  }, []);

  // Category name mapper
  const categoryMap = useMemo(() => {
    const map: { [key: string]: string } = {};
    categories.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  // Unified Filter mapping
  const filteredSales = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();

    return sales.filter((sale) => {
      // 1. Date filter
      const saleDateStr = sale.dateTime.split('T')[0];
      if (dateFilter === 'today' && saleDateStr !== todayStr) return false;
      if (dateFilter === 'yesterday' && saleDateStr !== yesterdayStr) return false;
      if (dateFilter === 'week') {
        const limit = new Date();
        limit.setDate(limit.getDate() - 6);
        limit.setHours(0,0,0,0);
        if (new Date(sale.dateTime) < limit) return false;
      }
      if (dateFilter === 'month') {
        const limit = new Date();
        limit.setDate(limit.getDate() - 29);
        limit.setHours(0,0,0,0);
        if (new Date(sale.dateTime) < limit) return false;
      }
      if (dateFilter === 'year') {
        const currentYear = new Date().getFullYear().toString();
        if (!sale.dateTime.startsWith(currentYear)) return false;
      }
      if (dateFilter === 'custom') {
        if (startDate && saleDateStr < startDate) return false;
        if (endDate && saleDateStr > endDate) return false;
      }

      // 2. Staff filter
      if (selectedStaff !== 'all') {
        const assocStaffName = associateInvoiceToUser(sale.id || 'N/A', users);
        if (assocStaffName !== selectedStaff) return false;
      }

      // 3. Payment method filter
      if (selectedPayMethod !== 'all' && sale.paymentMethod !== selectedPayMethod) return false;

      // 4. Customer filter
      if (selectedCustomer && !sale.customerName.toLowerCase().includes(selectedCustomer.toLowerCase())) return false;

      // 5. Category & Menu Item filter inside cart items
      let hasValidItems = false;
      const filteredItems = sale.items.filter((item) => {
        // category check
        const menuObj = menuItems.find((m) => m.name === item.name);
        const itemCatId = menuObj?.categoryId || '';
        const itemCatName = categoryMap[itemCatId] || 'Other';

        const matchesCat = selectedCategory === 'all' || itemCatName === selectedCategory;
        const matchesMenuItem = selectedMenuItem === 'all' || item.name === selectedMenuItem;

        return matchesCat && matchesMenuItem;
      });

      if (filteredItems.length > 0) hasValidItems = true;

      // If category or menu item filters are active, we must restrict to matching sales
      if ((selectedCategory !== 'all' || selectedMenuItem !== 'all') && !hasValidItems) return false;

      return true;
    });
  }, [sales, dateFilter, startDate, endDate, selectedStaff, selectedPayMethod, selectedCustomer, selectedCategory, selectedMenuItem, users, menuItems, categoryMap]);

  // Estimating cost based on matching ingredient name or standard 35% food cost
  const estimateInvoiceCost = useCallback((sale: SaleInvoice): number => {
    let totalCost = 0;
    sale.items.forEach((item) => {
      const matchIng = inventory.find((i) => i.name.toLowerCase() === item.name.toLowerCase());
      if (matchIng) {
        // Retrieve cost from ingredients metadata or standard check
        const savedExt = localStorage.getItem('restroflow_ingredients_ext');
        const ext = savedExt ? JSON.parse(savedExt) : {};
        const costPerUnit = ext[matchIng.id]?.costPerUnit || 0;
        totalCost += costPerUnit * item.quantity;
      } else {
        // Standard food cost percentage fallback (35% of invoice selling price)
        totalCost += (item.price * item.quantity) * 0.35;
      }
    });
    return totalCost;
  }, [inventory]);

  // Metrics Dashboard calculations
  const dashboardStats = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + s.grandTotal, 0);
    const totalOrders = filteredSales.length;
    const avgBill = totalOrders > 0 ? totalSales / totalOrders : 0;
    const inventoryCost = filteredSales.reduce((sum, s) => sum + estimateInvoiceCost(s), 0);
    const estimatedProfit = Math.max(0, totalSales - inventoryCost);

    return {
      totalSales,
      totalOrders,
      avgBill,
      inventoryCost,
      estimatedProfit
    };
  }, [filteredSales, estimateInvoiceCost]);

  // Hourly Performance calculations
  const hourlyData = useMemo(() => {
    const data: { label: string; value: number }[] = [];
    for (let hr = 8; hr <= 22; hr++) {
      const label = `${hr === 12 ? 12 : hr % 12} ${hr >= 12 ? 'PM' : 'AM'}`;
      const salesVal = filteredSales
        .filter((s) => new Date(s.dateTime).getHours() === hr)
        .reduce((sum, s) => sum + s.grandTotal, 0);
      data.push({ label, value: salesVal });
    }
    return data;
  }, [filteredSales]);

  // Daily Comparison calculations
  const comparisonStats = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();

    // Today vs Yesterday
    const todaySales = sales.filter((s) => s.dateTime.startsWith(todayStr));
    const yesterdaySales = sales.filter((s) => s.dateTime.startsWith(yesterdayStr));

    const todayRev = todaySales.reduce((sum, s) => sum + s.grandTotal, 0);
    const yesterdayRev = yesterdaySales.reduce((sum, s) => sum + s.grandTotal, 0);
    const dayDiff = yesterdayRev > 0 ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 : 0;

    // This Week vs Last Week
    const limitThisWeek = new Date();
    limitThisWeek.setDate(today.getDate() - 6);
    const thisWeekSales = sales.filter((s) => new Date(s.dateTime) >= limitThisWeek);

    const limitLastWeekStart = new Date();
    limitLastWeekStart.setDate(today.getDate() - 13);
    const limitLastWeekEnd = new Date();
    limitLastWeekEnd.setDate(today.getDate() - 7);
    const lastWeekSales = sales.filter((s) => {
      const d = new Date(s.dateTime);
      return d >= limitLastWeekStart && d <= limitLastWeekEnd;
    });

    const thisWeekRev = thisWeekSales.reduce((sum, s) => sum + s.grandTotal, 0);
    const lastWeekRev = lastWeekSales.reduce((sum, s) => sum + s.grandTotal, 0);
    const weekDiff = lastWeekRev > 0 ? ((thisWeekRev - lastWeekRev) / lastWeekRev) * 100 : 0;

    // This Month vs Last Month
    const limitThisMonth = new Date();
    limitThisMonth.setDate(today.getDate() - 29);
    const thisMonthSales = sales.filter((s) => new Date(s.dateTime) >= limitThisMonth);

    const limitLastMonthStart = new Date();
    limitLastMonthStart.setDate(today.getDate() - 59);
    const limitLastMonthEnd = new Date();
    limitLastMonthEnd.setDate(today.getDate() - 30);
    const lastMonthSales = sales.filter((s) => {
      const d = new Date(s.dateTime);
      return d >= limitLastMonthStart && d <= limitLastMonthEnd;
    });

    const thisMonthRev = thisMonthSales.reduce((sum, s) => sum + s.grandTotal, 0);
    const lastMonthRev = lastMonthSales.reduce((sum, s) => sum + s.grandTotal, 0);
    const monthDiff = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

    return {
      todayRev,
      yesterdayRev,
      dayDiff,
      thisWeekRev,
      lastWeekRev,
      weekDiff,
      thisMonthRev,
      lastMonthRev,
      monthDiff
    };
  }, [sales]);

  // Item Performance Report calculations
  const itemPerformance = useMemo(() => {
    const itemMap: { [key: string]: { name: string; qty: number; revenue: number } } = {};
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const key = item.variationName ? `${item.name} (${item.variationName})` : item.name;
        if (!itemMap[key]) {
          itemMap[key] = { name: key, qty: 0, revenue: 0 };
        }
        itemMap[key].qty += item.quantity;
        itemMap[key].revenue += item.price * item.quantity;
      });
    });

    const list = Object.values(itemMap).map((it) => ({
      ...it,
      avgPrice: it.qty > 0 ? it.revenue / it.qty : 0
    }));

    // Sorting logic
    if (itemSortOption === 'revenue') {
      list.sort((a, b) => b.revenue - a.revenue);
    } else if (itemSortOption === 'most-sold') {
      list.sort((a, b) => b.qty - a.qty);
    } else if (itemSortOption === 'least-sold') {
      list.sort((a, b) => a.qty - b.qty);
    }

    return list;
  }, [filteredSales, itemSortOption]);

  // Category Performance calculations
  const categoryPerformance = useMemo(() => {
    const catMap: { [key: string]: { name: string; orders: number; revenue: number } } = {};
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const menuObj = menuItems.find((m) => m.name === item.name);
        const catId = menuObj?.categoryId || '';
        const catName = categoryMap[catId] || 'Other';

        if (!catMap[catName]) {
          catMap[catName] = { name: catName, orders: 0, revenue: 0 };
        }
        catMap[catName].orders += item.quantity;
        catMap[catName].revenue += item.price * item.quantity;
      });
    });

    const list = Object.values(catMap);
    const totalRev = list.reduce((sum, c) => sum + c.revenue, 0);

    return list.map((c) => ({
      ...c,
      pct: totalRev > 0 ? (c.revenue / totalRev) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, menuItems, categoryMap]);

  // Customer Spenders calculations
  const customerSpenders = useMemo(() => {
    const custMap: { [id: string]: { id: string; name: string; orders: number; spent: number } } = {};
    filteredSales.forEach((sale) => {
      if (!custMap[sale.customerId]) {
        custMap[sale.customerId] = { id: sale.customerId, name: sale.customerName, orders: 0, spent: 0 };
      }
      custMap[sale.customerId].orders += 1;
      custMap[sale.customerId].spent += sale.grandTotal;
    });

    const list = Object.values(custMap);
    const totalCusts = list.length;
    const repeatCusts = list.filter((c) => c.orders >= 2).length;
    const newCusts = totalCusts - repeatCusts;

    const topSpenders = [...list].sort((a, b) => b.spent - a.spent).slice(0, 10);

    return {
      totalCusts,
      repeatCusts,
      newCusts,
      topSpenders
    };
  }, [filteredSales]);

  // Staff Performance calculations
  const staffPerformance = useMemo(() => {
    const staffMap: { [name: string]: { name: string; orders: number; revenue: number; aov: number; cancelled: number } } = {};
    
    // Seed staff list
    users.forEach((u) => {
      staffMap[u.username] = { name: u.username, orders: 0, revenue: 0, aov: 0, cancelled: 0 };
    });

    filteredSales.forEach((sale) => {
      const cashierName = associateInvoiceToUser(sale.id || 'N/A', users);
      if (!staffMap[cashierName]) {
        staffMap[cashierName] = { name: cashierName, orders: 0, revenue: 0, aov: 0, cancelled: 0 };
      }
      staffMap[cashierName].orders += 1;
      staffMap[cashierName].revenue += sale.grandTotal;
    });

    return Object.values(staffMap).map((s) => ({
      ...s,
      aov: s.orders > 0 ? s.revenue / s.orders : 0
    })).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, users]);

  // CSV Export utility mapping active tab data
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = 'reports_export';

    if (activeTab === 'ItemPerformance') {
      filename = 'item_sales_report';
      headers = ['Rank', 'Item Name', 'Quantity Sold', 'Revenue', 'Average Selling Price'];
      rows = itemPerformance.map((it, idx) => [idx + 1, `"${it.name}"`, it.qty, it.revenue, it.avgPrice]);
    } else if (activeTab === 'Category') {
      filename = 'category_sales_report';
      headers = ['Category Name', 'Items Sold', 'Revenue', 'Percentage Contribution'];
      rows = categoryPerformance.map((c) => [`"${c.name}"`, c.orders, c.revenue, `${c.pct.toFixed(2)}%`]);
    } else if (activeTab === 'Customer') {
      filename = 'customer_spending_report';
      headers = ['Rank', 'Customer Name', 'Total Orders', 'Total Spent'];
      rows = customerSpenders.topSpenders.map((c, idx) => [idx + 1, `"${c.name}"`, c.orders, c.spent]);
    } else if (activeTab === 'Staff') {
      filename = 'staff_performance_report';
      headers = ['Rank', 'Staff Member', 'Orders Processed', 'Revenue Generated', 'Average Bill Value'];
      rows = staffPerformance.map((s, idx) => [idx + 1, `"${s.name}"`, s.orders, s.revenue, s.aov]);
    } else {
      filename = 'sales_totals_summary';
      headers = ['Date Range filter', 'Total Completed Orders', 'Gross Revenue', 'Estimated Profit'];
      rows = [[dateFilter, dashboardStats.totalOrders, dashboardStats.totalSales, dashboardStats.estimatedProfit]];
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerPrintWindow = () => {
    window.print();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-page font-sans text-text-primary transition-all duration-[220ms] ease-in-out select-none">
      
      {/* LEFT REPORT TABS SELECTOR SIDEBAR */}
      <div className="w-[200px] bg-bg-card border-r border-border flex flex-col h-full shrink-0 no-print">
        <div className="p-4 border-b border-border bg-bg-card/50">
          <h2 className="text-[14px] font-bold text-primary uppercase tracking-wider">Reports Menu</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 custom-scrollbar">
          {[
            { id: 'Dashboard', label: 'Reports Dashboard', icon: LayoutDashboard },
            { id: 'Sales', label: 'Sales Trends', icon: TrendingUp },
            { id: 'ItemPerformance', label: 'Item Performance', icon: BarChart3 },
            { id: 'Category', label: 'Category Report', icon: Layers },
            { id: 'Hourly', label: 'Hourly Performance', icon: Clock },
            { id: 'DailyComparison', label: 'Daily Comparisons', icon: BarChart3 },
            { id: 'Profit', label: 'Profit Summary', icon: Percent },
            { id: 'Customer', label: 'Customer Analytics', icon: Users },
            { id: 'Staff', label: 'Staff Performance', icon: Briefcase }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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

      {/* RIGHT REPORT COMPONENT WORKSPACE */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar p-6">
        
        {/* UNIFIED REPORT FILTERS HEADER (NO-PRINT) */}
        <div className="bg-bg-card border border-border p-4.5 rounded-card shadow-card flex flex-col gap-4 mb-6 no-print">
          <div className="flex justify-between items-center border-b border-border/60 pb-3">
            <h3 className="text-[14px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide">
              <Filter className="w-4 h-4" />
              Unified Report Filters
            </h3>
            
            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={triggerPrintWindow}
                className="h-[32px] px-3.5 border border-border hover:bg-bg-page text-[12px] font-semibold flex items-center gap-1.5 rounded-btn cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-text-muted" />
                Print / PDF
              </button>
              <button
                onClick={handleExportCSV}
                className="h-[32px] px-3.5 border border-border hover:bg-bg-page text-[12px] font-semibold flex items-center gap-1.5 rounded-btn cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-text-muted" />
                Excel / CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            
            {/* Date Preset */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-bold">Date Scope</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="h-[34px] px-2.5 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="year">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-bold">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-[34px] px-2.5 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Staff Cashier Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-bold">Staff Cashier</label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="h-[34px] px-2.5 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium"
              >
                <option value="all">All Staff</option>
                {users.map((u) => (
                  <option key={u.id} value={u.username}>{u.username}</option>
                ))}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-bold">Payment Method</label>
              <select
                value={selectedPayMethod}
                onChange={(e) => setSelectedPayMethod(e.target.value)}
                className="h-[34px] px-2.5 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium"
              >
                <option value="all">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
              </select>
            </div>

            {/* Customer Search Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-bold">Customer Name</label>
              <div className="relative">
                <Search className="w-3 h-3 text-text-hint absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter name..."
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full h-[34px] pl-7 pr-2 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium"
                />
              </div>
            </div>

            {/* Menu Item Filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-bold">Menu Item</label>
              <select
                value={selectedMenuItem}
                onChange={(e) => setSelectedMenuItem(e.target.value)}
                className="h-[34px] px-2.5 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary font-medium"
              >
                <option value="all">All Items</option>
                {menuItems.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Custom Date Picker Inputs */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 border-t border-border/50 pt-3.5">
              <span className="text-[11px] text-text-muted font-medium">Custom Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-[30px] px-2 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary"
              />
              <span className="text-[11px] text-text-hint">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-[30px] px-2 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* --- REPORT VIEWPORTS --- */}

        {/* --- VIEW 1: DASHBOARD --- */}
        {activeTab === 'Dashboard' && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="page-title sentence-case">Reports Dashboard</h1>
              <p className="page-subtitle mt-0.5">High-level financial summaries for the selected filters</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              
              {/* Today's Sales */}
              <div className="bg-bg-card border border-border p-4 rounded-card shadow-card">
                <span className="text-[11px] text-text-muted font-bold block">Today's Sales</span>
                <span className="text-[18px] font-extrabold text-primary font-mono mt-1 block">
                  {formatCurrency(comparisonStats.todayRev)}
                </span>
              </div>

              {/* Today's Orders */}
              <div className="bg-bg-card border border-border p-4 rounded-card shadow-card">
                <span className="text-[11px] text-text-muted font-bold block">Today's Orders</span>
                <span className="text-[18px] font-extrabold text-text-primary font-mono mt-1 block">
                  {sales.filter(s => s.dateTime.startsWith(new Date().toISOString().split('T')[0])).length}
                </span>
              </div>

              {/* Average Bill */}
              <div className="bg-bg-card border border-border p-4 rounded-card shadow-card">
                <span className="text-[11px] text-text-muted font-bold block">Avg Bill Value</span>
                <span className="text-[18px] font-extrabold text-text-primary font-mono mt-1 block">
                  {formatCurrency(dashboardStats.avgBill)}
                </span>
              </div>

              {/* Gross Revenue */}
              <div className="bg-bg-card border border-border p-4 rounded-card shadow-card">
                <span className="text-[11px] text-text-muted font-bold block">Gross Revenue</span>
                <span className="text-[18px] font-extrabold text-text-primary font-mono mt-1 block">
                  {formatCurrency(dashboardStats.totalSales)}
                </span>
              </div>

              {/* Estimated Profit */}
              <div className="bg-bg-card border border-border p-4 rounded-card shadow-card">
                <span className="text-[11px] text-text-muted font-bold block">Estimated Profit</span>
                <span className="text-[18px] font-extrabold text-[#1A7A4A] font-mono mt-1 block">
                  {formatCurrency(dashboardStats.estimatedProfit)}
                </span>
              </div>

              {/* Cancelled Orders */}
              <div className="bg-bg-card border border-border p-4 rounded-card shadow-card">
                <span className="text-[11px] text-text-muted font-bold block">Cancelled Orders</span>
                <span className="text-[18px] font-extrabold text-text-primary font-mono mt-1 block">
                  0
                </span>
              </div>
            </div>

            {/* Proportion splits: Payment Method Distribution & Category share */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Payment distribution */}
              <div className="bg-bg-card border border-border p-5 rounded-card shadow-card">
                <h4 className="text-[13px] font-bold text-text-primary mb-4 uppercase tracking-wider">Payment Method Share</h4>
                <DonutChart
                  data={[
                    {
                      label: 'Cash',
                      value: filteredSales.filter(s => s.paymentMethod === 'Cash').reduce((sum, s) => sum + s.grandTotal, 0),
                      color: '#7B1E1E'
                    },
                    {
                      label: 'UPI',
                      value: filteredSales.filter(s => s.paymentMethod === 'UPI').reduce((sum, s) => sum + s.grandTotal, 0),
                      color: '#2563EB'
                    },
                    {
                      label: 'Card',
                      value: filteredSales.filter(s => s.paymentMethod === 'Card').reduce((sum, s) => sum + s.grandTotal, 0),
                      color: '#16A34A'
                    }
                  ]}
                />
              </div>

              {/* Category Share */}
              <div className="bg-bg-card border border-border p-5 rounded-card shadow-card">
                <h4 className="text-[13px] font-bold text-text-primary mb-4 uppercase tracking-wider">Top Category Revenue Contribution</h4>
                <DonutChart
                  data={categoryPerformance.slice(0, 4).map((c, idx) => ({
                    label: c.name,
                    value: c.revenue,
                    color: ['#7B1E1E', '#D97706', '#2563EB', '#16A34A'][idx] || '#4B5563'
                  }))}
                />
              </div>

            </div>
          </div>
        )}

        {/* --- VIEW 2: SALES TRENDS --- */}
        {activeTab === 'Sales' && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="page-title sentence-case">Sales Trends & performance</h1>
              <p className="page-subtitle mt-0.5">High-level financial summaries for the current filter settings</p>
            </div>

            <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="border-r border-border/80 last:border-0 p-2">
                  <span className="text-[11px] text-text-muted font-semibold block uppercase">Total Revenue</span>
                  <span className="text-[20px] font-extrabold text-primary font-mono mt-1 block">
                    {formatCurrency(dashboardStats.totalSales)}
                  </span>
                </div>
                <div className="border-r border-border/80 last:border-0 p-2">
                  <span className="text-[11px] text-text-muted font-semibold block uppercase">Orders Placed</span>
                  <span className="text-[20px] font-extrabold text-text-primary font-mono mt-1 block">
                    {dashboardStats.totalOrders}
                  </span>
                </div>
                <div className="border-r border-border/80 last:border-0 p-2">
                  <span className="text-[11px] text-text-muted font-semibold block uppercase">Average Ticket Spend</span>
                  <span className="text-[20px] font-extrabold text-text-primary font-mono mt-1 block">
                    {formatCurrency(dashboardStats.avgBill)}
                  </span>
                </div>
                <div className="p-2">
                  <span className="text-[11px] text-text-muted font-semibold block uppercase">Sales Growth %</span>
                  <span className="text-[20px] font-extrabold text-[#1A7A4A] font-mono mt-1 block">
                    {comparisonStats.dayDiff >= 0 ? '+' : ''}{comparisonStats.dayDiff.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 3: ITEM PERFORMANCE --- */}
        {activeTab === 'ItemPerformance' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="page-title sentence-case">Item Performance Report</h1>
                <p className="page-subtitle mt-0.5">Quantity sold, pricing performance, and dish rankings</p>
              </div>
              <div className="w-48 no-print">
                <select
                  value={itemSortOption}
                  onChange={(e) => setItemSortOption(e.target.value as any)}
                  className="w-full h-[36px] px-3 text-[12px] border border-border rounded-btn bg-bg-card text-text-primary focus:outline-none focus:border-primary font-semibold"
                >
                  <option value="revenue">Sort by Highest Revenue</option>
                  <option value="most-sold">Sort by Most Sold Qty</option>
                  <option value="least-sold">Sort by Least Sold Qty</option>
                </select>
              </div>
            </div>

            <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
              {itemPerformance.length === 0 ? (
                <EmptyState icon={UtensilsCrossed} title="No items matched" subtitle="Adjust filters to search for selling items." />
              ) : (
                <table className="w-full text-left text-[13px] font-sans">
                  <thead>
                    <tr className="text-text-muted border-b border-border/80 font-bold">
                      <th className="pb-2.5">Rank</th>
                      <th className="pb-2.5">Item Name</th>
                      <th className="pb-2.5 text-right">Quantity Sold</th>
                      <th className="pb-2.5 text-right">Total Revenue</th>
                      <th className="pb-2.5 text-right">Avg Selling Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {itemPerformance.map((it, idx) => (
                      <tr key={it.name} className="hover:bg-bg-page/50 text-[12px]">
                        <td className="py-2.5 font-bold text-primary font-mono">#{idx + 1}</td>
                        <td className="py-2.5 font-bold text-text-primary sentence-case">{it.name}</td>
                        <td className="py-2.5 text-right font-mono font-medium">{it.qty}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-text-primary">
                          {formatCurrency(it.revenue)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-text-muted">
                          {formatCurrency(it.avgPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* --- VIEW 4: CATEGORY REPORT --- */}
        {activeTab === 'Category' && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="page-title sentence-case">Category contribution report</h1>
              <p className="page-subtitle mt-0.5">Total orders and revenue distribution grouped by menu category</p>
            </div>

            <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
              {categoryPerformance.length === 0 ? (
                <EmptyState icon={Layers} title="No category records" subtitle="Adjust filters to see grouped contributions." />
              ) : (
                <table className="w-full text-left text-[13px] font-sans">
                  <thead>
                    <tr className="text-text-muted border-b border-border/80 font-bold">
                      <th className="pb-2.5">Category Name</th>
                      <th className="pb-2.5 text-right">Items Sold</th>
                      <th className="pb-2.5 text-right">Total Revenue</th>
                      <th className="pb-2.5 text-right">Percentage Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-[12px]">
                    {categoryPerformance.map((cat) => (
                      <tr key={cat.name} className="hover:bg-bg-page/50">
                        <td className="py-3 font-bold text-text-primary sentence-case">{cat.name}</td>
                        <td className="py-3 text-right font-mono font-medium">{cat.orders}</td>
                        <td className="py-3 text-right font-mono font-bold text-text-primary">
                          {formatCurrency(cat.revenue)}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 bg-border h-2 rounded-full overflow-hidden shrink-0">
                              <div
                                style={{ width: `${cat.pct}%` }}
                                className="bg-primary h-full rounded-full"
                              />
                            </div>
                            <span className="font-mono font-bold text-text-primary min-w-[50px] text-right">
                              {cat.pct.toFixed(1)}%
                            </span>
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

        {/* --- VIEW 5: HOURLY SALES --- */}
        {activeTab === 'Hourly' && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="page-title sentence-case">Hourly Sales Trend</h1>
              <p className="page-subtitle mt-0.5">Analyze performance trends to map peak business windows</p>
            </div>

            <div className="bg-bg-card border border-border p-5 rounded-card shadow-card flex flex-col justify-between min-h-[300px]">
              <div className="w-full h-[200px] mt-4">
                <svg viewBox="0 0 1000 200" className="w-full h-full overflow-visible">
                  {(() => {
                    const maxVal = Math.max(...hourlyData.map(h => h.value), 1000);
                    const barWidth = 40;
                    const spacing = 22;
                    return (
                      <>
                        {/* Render vertical bar charts */}
                        {hourlyData.map((pt, idx) => {
                          const x = 50 + idx * (barWidth + spacing);
                          const barHeight = (pt.value / maxVal) * 130;
                          const y = 160 - barHeight;
                          return (
                            <g key={idx} className="group cursor-pointer">
                              <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(barHeight, 2)}
                                fill="#7B1E1E"
                                rx="3"
                                className="transition-all duration-300 hover:fill-primary-dark"
                              />
                              <text
                                x={x + barWidth / 2}
                                y="180"
                                textAnchor="middle"
                                fill="#6B6460"
                                fontSize="9"
                                className="font-semibold font-sans"
                              >
                                {pt.label}
                              </text>
                              {/* Hover text label */}
                              <text
                                x={x + barWidth / 2}
                                y={Math.max(y - 6, 12)}
                                textAnchor="middle"
                                fill="#2F2F2F"
                                fontSize="8"
                                className="font-mono font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                              >
                                ₹{pt.value.toFixed(0)}
                              </text>
                            </g>
                          );
                        })}
                        <line x1="20" y1="162" x2="980" y2="162" stroke="#E8E1D9" strokeWidth="1.5" />
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 6: DAILY COMPARISON --- */}
        {activeTab === 'DailyComparison' && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="page-title sentence-case">Daily Comparison Analytics</h1>
              <p className="page-subtitle mt-0.5">Growth trends and period comparisons</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: Today vs Yesterday */}
              <div className="bg-bg-card border border-border p-5 rounded-card shadow-card flex flex-col justify-between min-h-[160px]">
                <div>
                  <span className="text-[11px] text-text-muted font-bold block uppercase">Today vs Yesterday</span>
                  <span className="text-[18px] font-extrabold text-text-primary font-mono mt-1.5 block">
                    {formatCurrency(comparisonStats.todayRev)} <span className="text-[11px] font-normal text-text-hint">vs {formatCurrency(comparisonStats.yesterdayRev)}</span>
                  </span>
                </div>
                <div className={`flex items-center gap-1 text-[13px] font-bold mt-4 ${
                  comparisonStats.dayDiff >= 0 ? 'text-[#1A7A4A]' : 'text-danger'
                }`}>
                  {comparisonStats.dayDiff >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 shrink-0" />
                  )}
                  <span>{Math.abs(comparisonStats.dayDiff).toFixed(1)}% {comparisonStats.dayDiff >= 0 ? 'increase' : 'decrease'}</span>
                </div>
              </div>

              {/* Card 2: This Week vs Last Week */}
              <div className="bg-bg-card border border-border p-5 rounded-card shadow-card flex flex-col justify-between min-h-[160px]">
                <div>
                  <span className="text-[11px] text-text-muted font-bold block uppercase">This Week vs Last Week</span>
                  <span className="text-[18px] font-extrabold text-text-primary font-mono mt-1.5 block">
                    {formatCurrency(comparisonStats.thisWeekRev)} <span className="text-[11px] font-normal text-text-hint">vs {formatCurrency(comparisonStats.lastWeekRev)}</span>
                  </span>
                </div>
                <div className={`flex items-center gap-1 text-[13px] font-bold mt-4 ${
                  comparisonStats.weekDiff >= 0 ? 'text-[#1A7A4A]' : 'text-danger'
                }`}>
                  {comparisonStats.weekDiff >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 shrink-0" />
                  )}
                  <span>{Math.abs(comparisonStats.weekDiff).toFixed(1)}% {comparisonStats.weekDiff >= 0 ? 'increase' : 'decrease'}</span>
                </div>
              </div>

              {/* Card 3: This Month vs Last Month */}
              <div className="bg-bg-card border border-border p-5 rounded-card shadow-card flex flex-col justify-between min-h-[160px]">
                <div>
                  <span className="text-[11px] text-text-muted font-bold block uppercase">This Month vs Last Month</span>
                  <span className="text-[18px] font-extrabold text-text-primary font-mono mt-1.5 block">
                    {formatCurrency(comparisonStats.thisMonthRev)} <span className="text-[11px] font-normal text-text-hint">vs {formatCurrency(comparisonStats.lastMonthRev)}</span>
                  </span>
                </div>
                <div className={`flex items-center gap-1 text-[13px] font-bold mt-4 ${
                  comparisonStats.monthDiff >= 0 ? 'text-[#1A7A4A]' : 'text-danger'
                }`}>
                  {comparisonStats.monthDiff >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 shrink-0" />
                  )}
                  <span>{Math.abs(comparisonStats.monthDiff).toFixed(1)}% {comparisonStats.monthDiff >= 0 ? 'increase' : 'decrease'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 7: PROFIT SUMMARY --- */}
        {activeTab === 'Profit' && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="page-title sentence-case">Profit & food cost summary</h1>
              <p className="page-subtitle mt-0.5">Estimated gross profits matching item revenues against raw material purchase ledger costs</p>
            </div>

            <div className="bg-bg-card border border-border rounded-card p-6 shadow-card max-w-[620px] flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-border pb-3.5">
                <span className="text-[12px] text-text-muted font-bold uppercase">Estimated Gross Revenue</span>
                <span className="text-[16px] font-extrabold text-text-primary font-mono">
                  {formatCurrency(dashboardStats.totalSales)}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-3.5">
                <span className="text-[12px] text-text-muted font-bold uppercase">Estimated Inventory Cost</span>
                <span className="text-[16px] font-extrabold text-[#B02020] font-mono">
                  {formatCurrency(dashboardStats.inventoryCost)}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-3.5">
                <span className="text-[12px] text-text-muted font-bold uppercase">Estimated Gross Profit</span>
                <span className="text-[16px] font-extrabold text-[#1A7A4A] font-mono">
                  {formatCurrency(dashboardStats.estimatedProfit)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-[12px] text-text-muted font-bold uppercase">Estimated Profit Margin %</span>
                <span className="text-[20px] font-extrabold text-[#1A7A4A] font-mono">
                  {dashboardStats.totalSales > 0 
                    ? ((dashboardStats.estimatedProfit / dashboardStats.totalSales) * 100).toFixed(1)
                    : '0.0'}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 8: CUSTOMER ANALYTICS --- */}
        {activeTab === 'Customer' && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="page-title sentence-case">Customer Analytics</h1>
              <p className="page-subtitle mt-0.5">Segmentations and spending performance logs</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Total Customers */}
              <div className="bg-bg-card border border-border p-4.5 rounded-card shadow-card">
                <span className="text-[11px] text-text-muted font-bold block">Total Customers Served</span>
                <span className="text-[20px] font-extrabold text-text-primary font-mono mt-1 block">
                  {customerSpenders.totalCusts}
                </span>
              </div>

              {/* Repeat Customers */}
              <div className="bg-bg-card border border-border p-4.5 rounded-card shadow-card">
                <span className="text-[11px] text-text-muted font-bold block">Repeat Customers</span>
                <span className="text-[20px] font-extrabold text-[#1A7A4A] font-mono mt-1 block">
                  {customerSpenders.repeatCusts}
                </span>
              </div>

              {/* New Customers */}
              <div className="bg-bg-card border border-border p-4.5 rounded-card shadow-card">
                <span className="text-[11px] text-text-muted font-bold block">New Customers</span>
                <span className="text-[20px] font-extrabold text-primary font-mono mt-1 block">
                  {customerSpenders.newCusts}
                </span>
              </div>
            </div>

            {/* Top Customer Spenders Table */}
            <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
              <h4 className="text-[13px] font-bold text-text-primary mb-4 uppercase tracking-wider">Top Spenders Log</h4>
              {customerSpenders.topSpenders.length === 0 ? (
                <EmptyState icon={Users} title="No customer spend logs" subtitle="Complete sales transactions to view top spenders." />
              ) : (
                <table className="w-full text-left text-[13px] font-sans">
                  <thead>
                    <tr className="text-text-muted border-b border-border/80 font-bold">
                      <th className="pb-2.5">Rank</th>
                      <th className="pb-2.5">Customer Name</th>
                      <th className="pb-2.5 text-right font-semibold">Total Orders placed</th>
                      <th className="pb-2.5 text-right font-semibold">Total Amount spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-[12px]">
                    {customerSpenders.topSpenders.map((cust, idx) => (
                      <tr key={cust.id} className="hover:bg-bg-page/50">
                        <td className="py-2.5 font-bold font-mono text-primary">#{idx + 1}</td>
                        <td className="py-2.5 font-bold text-text-primary sentence-case">{cust.name}</td>
                        <td className="py-2.5 text-right font-mono font-medium">{cust.orders}</td>
                        <td className="py-2.5 text-right font-mono font-bold text-[#1A7A4A]">
                          {formatCurrency(cust.spent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* --- VIEW 9: STAFF PERFORMANCE --- */}
        {activeTab === 'Staff' && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="page-title sentence-case">Staff Performance Rankings</h1>
              <p className="page-subtitle mt-0.5">Ranked orders processed, total billing revenues, and ticket values</p>
            </div>

            <div className="bg-bg-card border border-border rounded-card p-5 shadow-card">
              {staffPerformance.length === 0 ? (
                <EmptyState icon={Briefcase} title="No staff records" subtitle="Complete billing transactions to view ranking details." />
              ) : (
                <table className="w-full text-left text-[13px] font-sans">
                  <thead>
                    <tr className="text-text-muted border-b border-border/80 font-bold">
                      <th className="pb-2.5">Rank</th>
                      <th className="pb-2.5">Staff Cashier Name</th>
                      <th className="pb-2.5 text-right">Orders Processed</th>
                      <th className="pb-2.5 text-right">Gross Revenue Generated</th>
                      <th className="pb-2.5 text-right">Average Bill Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-[12px]">
                    {staffPerformance.map((staff, idx) => (
                      <tr key={staff.name} className="hover:bg-bg-page/50">
                        <td className="py-3 font-bold font-mono text-primary">#{idx + 1}</td>
                        <td className="py-3 font-bold text-text-primary sentence-case">{staff.name}</td>
                        <td className="py-3 text-right font-mono font-medium">{staff.orders}</td>
                        <td className="py-3 text-right font-mono font-bold text-[#1A7A4A]">
                          {formatCurrency(staff.revenue)}
                        </td>
                        <td className="py-3 text-right font-mono text-text-muted">
                          {formatCurrency(staff.aov)}
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
    </div>
  );
};
