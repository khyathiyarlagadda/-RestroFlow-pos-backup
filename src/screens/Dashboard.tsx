import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  DollarSign,
  UtensilsCrossed,
  ArrowRight,
  Clock,
  Coffee
} from 'lucide-react';
import { storage } from '../utils/storage';
import type { SaleInvoice, Table, MenuItem } from '../types';
import { EmptyState } from '../components/EmptyState';


export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [role, setRole] = useState<'Administrator' | 'Restaurant Owner' | 'Owner' | 'Staff'>('Administrator');

  useEffect(() => {
    setSales(storage.getSales());
    setTables(storage.getTables());
    setMenuItems(storage.getMenuItems());
    const auth = storage.getAuth();
    if (auth) {
      setRole(auth.role);
    }

    const handleCatsUpdate = () => {
      setMenuItems(storage.getMenuItems());
    };
    const handleMenuUpdate = () => {
      setMenuItems(storage.getMenuItems());
    };
    const handleSalesUpdate = () => {
      setSales(storage.getSales());
    };
    const handleTablesUpdate = () => {
      setTables(storage.getTables());
    };

    window.addEventListener('categoriesUpdated', handleCatsUpdate);
    window.addEventListener('menuUpdated', handleMenuUpdate);
    window.addEventListener('salesUpdated', handleSalesUpdate);
    window.addEventListener('tablesUpdated', handleTablesUpdate);

    return () => {
      window.removeEventListener('categoriesUpdated', handleCatsUpdate);
      window.removeEventListener('menuUpdated', handleMenuUpdate);
      window.removeEventListener('salesUpdated', handleSalesUpdate);
      window.removeEventListener('tablesUpdated', handleTablesUpdate);
    };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter today's sales
  const todaysSalesList = useMemo(() => {
    return sales.filter((s) => s.dateTime.startsWith(todayStr));
  }, [sales, todayStr]);

  // Today's Stats
  const todaySalesVal = useMemo(() => {
    return todaysSalesList.reduce((sum, s) => sum + s.grandTotal, 0);
  }, [todaysSalesList]);

  const todayOrdersCount = todaysSalesList.length;

  const uniqueCustomersCount = useMemo(() => {
    const custs = new Set(sales.map((s) => s.customerId));
    return custs.size;
  }, [sales]);

  // Monthly Revenue (current calendar month)
  const monthlyRevenueVal = useMemo(() => {
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    return sales
      .filter((s) => s.dateTime.startsWith(currentMonth))
      .reduce((sum, s) => sum + s.grandTotal, 0);
  }, [sales]);

  // Check if system setup is incomplete (no menu items or no sales at all)
  const isSetupIncomplete = menuItems.length === 0;
  const hasNoSalesData = sales.length === 0;

  // Recent 10 Orders
  const recentOrders = useMemo(() => {
    return [...sales].sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()).slice(0, 10);
  }, [sales]);

  // Top Selling Items (calculated)
  const topSellingItems = useMemo(() => {
    const counts: { [key: string]: { name: string; qty: number; revenue: number } } = {};
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const key = item.variationName ? `${item.name} (${item.variationName})` : item.name;
        if (!counts[key]) {
          counts[key] = { name: key, qty: 0, revenue: 0 };
        }
        counts[key].qty += item.quantity;
        counts[key].revenue += item.price * item.quantity;
      });
    });
    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales]);

  // Order Type Breakdown (Dine In vs Takeaway vs Delivery)
  const orderTypeBreakdown = useMemo(() => {
    const breakdown = { 'Dine In': 0, Takeaway: 0, Delivery: 0 };
    sales.forEach((s) => {
      if (breakdown[s.orderType] !== undefined) {
        breakdown[s.orderType] += 1;
      }
    });
    const total = sales.length || 1;
    return Object.entries(breakdown).map(([type, count]) => ({
      type,
      count,
      pct: Math.round((count / total) * 100)
    }));
  }, [sales]);

  // Revenue trends for the last 7 days (CSS Chart)
  const last7DaysRevenue = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      
      const daySales = sales
        .filter((s) => s.dateTime.startsWith(dateStr))
        .reduce((sum, s) => sum + s.grandTotal, 0);

      days.push({ dayName, amount: daySales });
    }
    return days;
  }, [sales]);

  const maxDailyRevenue = useMemo(() => {
    const max = Math.max(...last7DaysRevenue.map((d) => d.amount));
    return max || 1;
  }, [last7DaysRevenue]);

  // --- RENDERING ---

  if (isSetupIncomplete) {
    return (
      <div className="flex h-screen overflow-hidden bg-bg-page font-sans text-text-primary transition-all duration-[220ms] ease-in-out">
        <div className="flex-1 overflow-y-auto p-8 flex flex-col justify-center items-center">
          <EmptyState
            icon={Coffee}
            title="Restaurant setup is incomplete"
            subtitle="Please add menu items and categories first, then start billing to view analytics."
            ctaText="Go to Menu Management"
            onCtaClick={() => navigate('/menu')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container custom-scrollbar transition-all duration-[220ms] ease-in-out select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title sentence-case">
            {role === 'Administrator' ? 'Admin Dashboard' : 'Owner Dashboard'}
          </h1>
          <p className="page-subtitle mt-0.5 sentence-case">
            Real-time restaurant metrics summary
          </p>
        </div>
          {(role === 'Restaurant Owner' || role === 'Owner') && (
            <button
              onClick={() => navigate('/pos')}
              className="h-[36px] bg-primary hover:bg-primary-dark text-white rounded-btn px-4 text-[13px] font-medium flex items-center gap-2 transition-colors duration-150 shadow-card"
            >
              <UtensilsCrossed className="w-4 h-4" />
              Go to Billing
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {role === 'Administrator' ? (
          // ================== ADMINISTRATOR DASHBOARD ==================
          <div className="flex flex-col gap-6">
            {/* ROW 1: Stat Cards (4 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Stat 1 */}
              <div className="bg-bg-card border border-border p-[1.25rem] rounded-card shadow-card flex items-center justify-between">
                <div>
                  <span className="card-metric-label sentence-case">Today's sales</span>
                  <h3 className="card-metric-number mt-1">
                    ₹{todaySalesVal.toLocaleString('en-IN')}
                  </h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 2 */}
              <div className="bg-bg-card border border-border p-[1.25rem] rounded-card shadow-card flex items-center justify-between">
                <div>
                  <span className="card-metric-label sentence-case">Today's orders</span>
                  <h3 className="card-metric-number mt-1">
                    {todayOrdersCount}
                  </h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 3 */}
              <div className="bg-bg-card border border-border p-[1.25rem] rounded-card shadow-card flex items-center justify-between">
                <div>
                  <span className="card-metric-label sentence-case">Customers served</span>
                  <h3 className="card-metric-number mt-1">
                    {uniqueCustomersCount}
                  </h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              {/* Stat 4 */}
              <div className="bg-bg-card border border-border p-[1.25rem] rounded-card shadow-card flex items-center justify-between">
                <div>
                  <span className="card-metric-label sentence-case">Monthly revenue</span>
                  <h3 className="card-metric-number mt-1">
                    ₹{monthlyRevenueVal.toLocaleString('en-IN')}
                  </h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* ROW 2: Charts (60% Trend, 40% Top items) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue Trend Chart (60% width) */}
              <div className="bg-bg-card border border-border rounded-card p-5 shadow-card lg:col-span-2 flex flex-col justify-between min-h-[300px]">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[15px] font-medium text-text-primary sentence-case">Last 7 days revenue</h4>
                  <span className="text-[11px] text-text-muted font-mono">Real sales data</span>
                </div>

                {hasNoSalesData ? (
                  <div className="flex-1 flex items-center justify-center text-text-hint text-[14px]">
                    No sales data yet
                  </div>
                ) : (
                  <div className="flex-1 flex items-end justify-between h-48 pt-4 pb-2 px-2">
                    {last7DaysRevenue.map((d, i) => {
                      const pct = (d.amount / maxDailyRevenue) * 100;
                      return (
                        <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                          <div className="relative w-8 bg-primary/10 rounded-t-[4px] hover:bg-primary transition-all duration-200 h-32 flex items-end">
                            <div
                              style={{ height: `${Math.max(4, pct)}%` }}
                              className="w-full bg-primary rounded-t-[4px] group-hover:bg-primary-dark transition-all duration-150"
                            />
                            {/* Hover amount tooltip */}
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-text-primary text-white text-[10px] px-1.5 py-0.5 rounded font-mono z-10">
                              ₹{d.amount}
                            </div>
                          </div>
                          <span className="text-[11px] text-text-muted font-medium">{d.dayName}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Selling Items (40% width) */}
              <div className="bg-bg-card border border-border rounded-card p-5 shadow-card flex flex-col justify-between min-h-[300px]">
                <div className="mb-4">
                  <h4 className="text-[15px] font-medium text-text-primary sentence-case">Top selling items</h4>
                </div>

                {hasNoSalesData ? (
                  <div className="flex-1 flex items-center justify-center text-text-hint text-[14px]">
                    No sales data yet
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-3 justify-center">
                    {topSellingItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[13px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-text-primary font-medium truncate sentence-case">
                            {item.name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-text-muted font-medium font-mono block">
                            {item.qty} sold
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ROW 3: Recent Orders Table (50%) & Order Type (50%) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Orders table */}
              <div className="bg-bg-card border border-border rounded-card p-5 shadow-card flex flex-col h-[340px]">
                <h4 className="text-[15px] font-medium text-text-primary mb-4 sentence-case">Recent orders</h4>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {hasNoSalesData ? (
                    <div className="h-full flex items-center justify-center text-text-hint text-[14px]">
                      No sales data yet
                    </div>
                  ) : (
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="text-text-muted border-b border-border/80 pb-2">
                          <th className="font-medium pb-2">Token Number</th>
                          <th className="font-medium pb-2">Customer</th>
                          <th className="font-medium pb-2">Type</th>
                          <th className="font-medium pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {recentOrders.map((ord) => (
                          <tr key={ord.tokenNo} className="hover:bg-bg-page/50">
                            <td className="py-2.5 font-medium font-mono text-primary">Token #{ord.tokenNo.split('-').pop()}</td>
                            <td className="py-2.5 max-w-[120px] truncate sentence-case">{ord.customerName}</td>
                            <td className="py-2.5 sentence-case">{ord.orderType}</td>
                            <td className="py-2.5 text-right font-mono font-medium">₹{ord.grandTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Order Type Breakdown */}
              <div className="bg-bg-card border border-border rounded-card p-5 shadow-card flex flex-col h-[340px]">
                <h4 className="text-[15px] font-medium text-text-primary mb-4 sentence-case">Order type breakdown</h4>
                <div className="flex-1 flex flex-col justify-center">
                  {hasNoSalesData ? (
                    <div className="h-full flex items-center justify-center text-text-hint text-[14px]">
                      No sales data yet
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {orderTypeBreakdown.map((item) => (
                        <div key={item.type} className="flex flex-col gap-1 text-[13px]">
                          <div className="flex justify-between font-medium">
                            <span className="sentence-case">{item.type}</span>
                            <span className="font-mono text-text-muted">
                              {item.count} orders ({item.pct}%)
                            </span>
                          </div>
                          {/* Beautiful Maroon custom progress bar */}
                          <div className="w-full bg-border h-2 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${item.pct}%` }}
                              className="bg-primary h-full rounded-full transition-all duration-300"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ================== OWNER SIMPLIFIED DASHBOARD ==================
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Billing Summary Card */}
              <div className="bg-bg-card border border-border p-6 rounded-card shadow-card">
                <h3 className="text-[16px] font-medium text-text-primary mb-4 sentence-case">Today's billing summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="border border-border p-3.5 rounded-btn bg-bg-page/40">
                    <span className="text-[11px] text-text-muted block sentence-case">Gross Sales</span>
                    <span className="text-[18px] font-semibold text-primary font-mono block mt-1">
                      ₹{todaySalesVal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="border border-border p-3.5 rounded-btn bg-bg-page/40">
                    <span className="text-[11px] text-text-muted block sentence-case">Orders Processed</span>
                    <span className="text-[18px] font-semibold text-text-primary block mt-1 font-mono">
                      {todayOrdersCount}
                    </span>
                  </div>
                  <div className="border border-border p-3.5 rounded-btn bg-bg-page/40">
                    <span className="text-[11px] text-text-muted block sentence-case">Active Tables</span>
                    <span className="text-[18px] font-semibold text-warning block mt-1 font-mono">
                      {tables.filter((t) => t.status === 'Occupied').length} / {tables.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* My Recent Bills (last 5) */}
              <div className="bg-bg-card border border-border p-6 rounded-card shadow-card flex flex-col h-[280px]">
                <h4 className="text-[15px] font-medium text-text-primary mb-4 sentence-case">My recent bills</h4>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {todaysSalesList.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-text-hint text-[14px]">
                      No bills processed today
                    </div>
                  ) : (
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="text-text-muted border-b border-border/80 pb-2">
                          <th className="font-medium pb-2">Token Number</th>
                          <th className="font-medium pb-2">Time</th>
                          <th className="font-medium pb-2">Payment</th>
                          <th className="font-medium pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {todaysSalesList.slice(0, 5).map((ord) => (
                          <tr key={ord.tokenNo} className="hover:bg-bg-page/50">
                            <td className="py-2 font-medium font-mono text-primary">Token #{ord.tokenNo.split('-').pop()}</td>
                            <td className="py-2 font-mono">
                              {new Date(ord.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 sentence-case">{ord.paymentMethod}</td>
                            <td className="py-2 text-right font-mono font-medium">₹{ord.grandTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Table Status Overview */}
            <div className="bg-bg-card border border-border p-6 rounded-card shadow-card flex flex-col justify-between">
              <div>
                <h4 className="text-[15px] font-medium text-text-primary mb-4 flex items-center gap-2 sentence-case">
                  <Clock className="w-4 h-4 text-primary" />
                  Table status overview
                </h4>
                <div className="flex flex-col gap-3">
                  {tables.map((table) => {
                    let badgeBg = 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]';
                    if (table.status === 'Occupied') {
                      badgeBg = 'bg-[#FEF9C3] text-[#854D0E] border-[#FDE047]';
                    } else if (table.status === 'Billing Pending') {
                      badgeBg = 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]';
                    }

                    return (
                      <div key={table.id} className="flex justify-between items-center p-2.5 border border-border rounded-btn hover:bg-bg-page/40 transition-colors duration-150">
                        <span className="text-[14px] font-medium text-text-primary">
                          Table {table.number}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 border rounded-badge font-medium ${badgeBg}`}>
                          {table.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-border mt-4">
                <button
                  onClick={() => navigate('/pos')}
                  className="w-full h-[40px] bg-primary hover:bg-primary-dark text-white rounded-btn text-[14px] font-medium transition-colors duration-150"
                >
                  Quick Billing Screen
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
