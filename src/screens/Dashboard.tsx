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
  Coffee,
  AlertCircle,
  FileText,
  Flame,
  Lightbulb,
  XCircle
} from 'lucide-react';
import { storage } from '../utils/storage';
import type { SaleInvoice, MenuItem } from '../types';
import { EmptyState } from '../components/EmptyState';

// Helper to format currency
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [role, setRole] = useState<'Administrator' | 'Restaurant Owner' | 'Owner' | 'Staff'>('Administrator');

  // Filter state
  const [activeFilter, setActiveFilter] = useState<'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Monthly' | 'Yearly' | 'Custom'>('Today');
  const [customRange, setCustomRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Hover states for line chart tooltip
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

  useEffect(() => {
    setSales(storage.getSales());
    setMenuItems(storage.getMenuItems());
    const auth = storage.getAuth();
    if (auth) {
      setRole(auth.role);
    }

    const handleCatsUpdate = () => setMenuItems(storage.getMenuItems());
    const handleMenuUpdate = () => setMenuItems(storage.getMenuItems());
    const handleSalesUpdate = () => setSales(storage.getSales());

    window.addEventListener('categoriesUpdated', handleCatsUpdate);
    window.addEventListener('menuUpdated', handleMenuUpdate);
    window.addEventListener('salesUpdated', handleSalesUpdate);

    return () => {
      window.removeEventListener('categoriesUpdated', handleCatsUpdate);
      window.removeEventListener('menuUpdated', handleMenuUpdate);
      window.removeEventListener('salesUpdated', handleSalesUpdate);
    };
  }, []);

  // Filtered sales and comparisons
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }, []);

  // Filter logic helper
  const parsedSales = useMemo(() => {
    
    if (activeFilter === 'Today') {
      return sales.filter((s) => s.dateTime.startsWith(todayStr));
    }
    if (activeFilter === 'Yesterday') {
      return sales.filter((s) => s.dateTime.startsWith(yesterdayStr));
    }
    if (activeFilter === 'Last 7 Days') {
      const limit = new Date();
      limit.setDate(limit.getDate() - 6);
      limit.setHours(0, 0, 0, 0);
      return sales.filter((s) => new Date(s.dateTime) >= limit);
    }
    if (activeFilter === 'Last 30 Days') {
      const limit = new Date();
      limit.setDate(limit.getDate() - 29);
      limit.setHours(0, 0, 0, 0);
      return sales.filter((s) => new Date(s.dateTime) >= limit);
    }
    if (activeFilter === 'Monthly') {
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      return sales.filter((s) => s.dateTime.startsWith(currentMonth));
    }
    if (activeFilter === 'Yearly') {
      const currentYear = new Date().getFullYear().toString();
      return sales.filter((s) => s.dateTime.startsWith(currentYear));
    }
    if (activeFilter === 'Custom') {
      const start = new Date(customRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      return sales.filter((s) => {
        const d = new Date(s.dateTime);
        return d >= start && d <= end;
      });
    }
    return sales;
  }, [sales, activeFilter, customRange, todayStr, yesterdayStr]);

  // Previous period sales helper (for comparison percentages)
  const previousPeriodSales = useMemo(() => {
    const now = new Date();
    
    if (activeFilter === 'Today') {
      return sales.filter((s) => s.dateTime.startsWith(yesterdayStr));
    }
    if (activeFilter === 'Yesterday') {
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      const dbyStr = dayBeforeYesterday.toISOString().split('T')[0];
      return sales.filter((s) => s.dateTime.startsWith(dbyStr));
    }
    if (activeFilter === 'Last 7 Days') {
      const start = new Date();
      start.setDate(now.getDate() - 13);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(now.getDate() - 7);
      end.setHours(23, 59, 59, 999);
      return sales.filter((s) => {
        const d = new Date(s.dateTime);
        return d >= start && d <= end;
      });
    }
    if (activeFilter === 'Last 30 Days') {
      const start = new Date();
      start.setDate(now.getDate() - 59);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setDate(now.getDate() - 30);
      end.setHours(23, 59, 59, 999);
      return sales.filter((s) => {
        const d = new Date(s.dateTime);
        return d >= start && d <= end;
      });
    }
    if (activeFilter === 'Monthly') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = lm.getFullYear();
      const month = (lm.getMonth() + 1).toString().padStart(2, '0');
      const lastMonthPrefix = `${year}-${month}`;
      return sales.filter((s) => s.dateTime.startsWith(lastMonthPrefix));
    }
    if (activeFilter === 'Yearly') {
      const prevYear = (now.getFullYear() - 1).toString();
      return sales.filter((s) => s.dateTime.startsWith(prevYear));
    }
    if (activeFilter === 'Custom') {
      // Offset by the same range size
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      const diffMs = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - diffMs - 24 * 60 * 60 * 1000);
      const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
      return sales.filter((s) => {
        const d = new Date(s.dateTime);
        return d >= prevStart && d <= prevEnd;
      });
    }
    return [];
  }, [sales, activeFilter, customRange, yesterdayStr]);

  // Compute stats helper
  const getPeriodStats = (salesList: SaleInvoice[]) => {
    const revenue = salesList.reduce((sum, s) => sum + s.grandTotal, 0);
    const orders = salesList.length;
    const aov = orders > 0 ? revenue / orders : 0;
    const uniqueCustomers = new Set(salesList.map((s) => s.customerId)).size;
    return { revenue, orders, aov, uniqueCustomers };
  };

  const currentStats = useMemo(() => getPeriodStats(parsedSales), [parsedSales]);
  const prevStats = useMemo(() => getPeriodStats(previousPeriodSales), [previousPeriodSales]);

  // Calculate comparison texts
  const getComparisonLabel = (currVal: number, prevVal: number) => {
    if (prevVal === 0) return { text: 'Stable vs Prev Period', type: 'stable' };
    const pctChange = ((currVal - prevVal) / prevVal) * 100;
    const symbol = pctChange >= 0 ? '▲' : '▼';
    const colorClass = pctChange >= 0 ? 'text-[#1A7A4A] font-semibold' : 'text-[#B02020] font-semibold';
    return {
      text: `${symbol} ${Math.abs(pctChange).toFixed(1)}% vs Prev Period`,
      type: pctChange >= 0 ? 'up' : 'down',
      colorClass
    };
  };

  // KPI metadata
  const kpis = useMemo(() => {
    return [
      {
        title: activeFilter === 'Today' ? "Today's Revenue" : "Revenue",
        value: formatCurrency(currentStats.revenue),
        comparison: getComparisonLabel(currentStats.revenue, prevStats.revenue),
        icon: DollarSign,
        bgIcon: 'bg-primary/10 text-primary'
      },
      {
        title: activeFilter === 'Today' ? "Today's Orders" : "Orders",
        value: currentStats.orders.toString(),
        comparison: getComparisonLabel(currentStats.orders, prevStats.orders),
        icon: ShoppingBag,
        bgIcon: 'bg-blue-50 text-blue-600'
      },
      {
        title: "Avg Order Value",
        value: formatCurrency(currentStats.aov),
        comparison: getComparisonLabel(currentStats.aov, prevStats.aov),
        icon: TrendingUp,
        bgIcon: 'bg-emerald-50 text-emerald-600'
      },
      {
        title: "Customers Served",
        value: currentStats.uniqueCustomers.toString(),
        comparison: getComparisonLabel(currentStats.uniqueCustomers, prevStats.uniqueCustomers),
        icon: Users,
        bgIcon: 'bg-purple-50 text-purple-600'
      },
      {
        title: "Cancelled Orders",
        value: "0",
        comparison: { text: "0% vs Prev Period", type: 'stable', colorClass: 'text-text-hint' },
        icon: XCircle,
        bgIcon: 'bg-red-50 text-red-500'
      }
    ];
  }, [currentStats, prevStats, activeFilter]);

  // Aggregation for the SVG Line Chart
  const chartPoints = useMemo(() => {
    if (activeFilter === 'Today' || activeFilter === 'Yesterday') {
      // Group by hour of the day (8:00 to 22:00)
      const data = [];
      for (let hour = 8; hour <= 22; hour++) {
        const label = `${hour === 12 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`;
        const val = parsedSales
          .filter((s) => new Date(s.dateTime).getHours() === hour)
          .reduce((sum, s) => sum + s.grandTotal, 0);
        data.push({ label, value: val });
      }
      return data;
    }
    if (activeFilter === 'Last 7 Days') {
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        const val = parsedSales
          .filter((s) => s.dateTime.startsWith(d.toISOString().split('T')[0]))
          .reduce((sum, s) => sum + s.grandTotal, 0);
        data.push({ label, value: val });
      }
      return data;
    }
    if (activeFilter === 'Last 30 Days') {
      const data = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        const val = parsedSales
          .filter((s) => s.dateTime.startsWith(d.toISOString().split('T')[0]))
          .reduce((sum, s) => sum + s.grandTotal, 0);
        data.push({ label, value: val });
      }
      return data;
    }
    if (activeFilter === 'Monthly') {
      const data = [];
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), i);
        const label = i.toString().padStart(2, '0');
        const val = parsedSales
          .filter((s) => s.dateTime.startsWith(d.toISOString().split('T')[0]))
          .reduce((sum, s) => sum + s.grandTotal, 0);
        data.push({ label, value: val });
      }
      return data;
    }
    if (activeFilter === 'Yearly') {
      const data: { label: string; value: number }[] = [];
      const now = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach((m, idx) => {
        const prefix = `${now.getFullYear()}-${(idx + 1).toString().padStart(2, '0')}`;
        const val = parsedSales
          .filter((s) => s.dateTime.startsWith(prefix))
          .reduce((sum, s) => sum + s.grandTotal, 0);
        data.push({ label: m, value: val });
      });
      return data;
    }
    if (activeFilter === 'Custom') {
      const data: { label: string; value: number }[] = [];
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      const current = new Date(start);
      while (current <= end) {
        const label = current.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        const val = parsedSales
          .filter((s) => s.dateTime.startsWith(current.toISOString().split('T')[0]))
          .reduce((sum, s) => sum + s.grandTotal, 0);
        data.push({ label, value: val });
        current.setDate(current.getDate() + 1);
        if (data.length > 90) break; // safeguard
      }
      return data;
    }
    return [];
  }, [parsedSales, activeFilter, customRange]);

  // Compute line path coordinates for SVG chart
  const maxValue = useMemo(() => {
    const vals = chartPoints.map((pt) => pt.value);
    const max = Math.max(...vals);
    return max > 0 ? max : 1000;
  }, [chartPoints]);

  // Peak business hours aggregator
  const peakHours = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hourNum: i, count: 0 }));
    parsedSales.forEach((s) => {
      const hr = new Date(s.dateTime).getHours();
      if (hours[hr]) hours[hr].count += 1;
    });
    // Filter standard business hours (8 AM to 10 PM)
    const busHours = hours.filter((h) => h.hourNum >= 8 && h.hourNum <= 22);
    const maxCount = Math.max(...busHours.map((h) => h.count), 1);
    return busHours.map((h) => {
      const rawHour = h.hourNum;
      const label = `${rawHour === 12 ? 12 : rawHour % 12} ${rawHour >= 12 ? 'PM' : 'AM'}`;
      return {
        label,
        count: h.count,
        pct: Math.round((h.count / maxCount) * 100)
      };
    });
  }, [parsedSales]);

  // Top Selling Items calculations
  const calculatedTopItems = useMemo(() => {
    const counts: { [key: string]: { name: string; qty: number; revenue: number } } = {};
    parsedSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const key = item.variationName ? `${item.name} (${item.variationName})` : item.name;
        if (!counts[key]) {
          counts[key] = { name: key, qty: 0, revenue: 0 };
        }
        counts[key].qty += item.quantity;
        counts[key].revenue += item.price * item.quantity;
      });
    });
    const sorted = Object.values(counts).sort((a, b) => b.qty - a.qty);
    const maxQty = sorted.length > 0 ? sorted[0].qty : 1;
    return sorted.slice(0, 5).map((item) => ({
      ...item,
      pct: Math.round((item.qty / maxQty) * 100)
    }));
  }, [parsedSales]);

  // Business Insights Generator
  const insights = useMemo(() => {
    const list = [];
    if (parsedSales.length === 0) {
      return ['No sales data recorded for the selected filter period yet. Add new bills to view insights.'];
    }

    // Insight 1: Sales Growth vs Prev Period
    if (currentStats.revenue > 0) {
      if (prevStats.revenue > 0) {
        const diff = ((currentStats.revenue - prevStats.revenue) / prevStats.revenue) * 100;
        const trendStr = diff >= 0 ? 'increased' : 'decreased';
        list.push(`Sales revenue ${trendStr} by ${Math.abs(diff).toFixed(1)}% compared to the previous period.`);
      } else {
        list.push(`Sales revenue stands strong at ${formatCurrency(currentStats.revenue)} for this period.`);
      }
    }

    // Insight 2: Top Selling Menu Item percentage
    if (calculatedTopItems.length > 0 && currentStats.revenue > 0) {
      const top = calculatedTopItems[0];
      const pct = ((top.revenue / currentStats.revenue) * 100).toFixed(0);
      list.push(`"${top.name}" was the top seller, generating ${pct}% of total revenue (${formatCurrency(top.revenue)}).`);
    }

    // Insight 3: Peak Business Hours
    const sortedPeak = [...peakHours].sort((a, b) => b.count - a.count);
    if (sortedPeak.length > 0 && sortedPeak[0].count > 0) {
      list.push(`Peak business traffic was recorded at ${sortedPeak[0].label} with ${sortedPeak[0].count} orders placed.`);
    }

    // Insight 4: AOV Growth
    if (currentStats.aov > 0) {
      if (prevStats.aov > 0) {
        const diff = currentStats.aov - prevStats.aov;
        const sign = diff >= 0 ? 'increased by' : 'decreased by';
        list.push(`Average bill value ${sign} ${formatCurrency(Math.abs(diff))}.`);
      } else {
        list.push(`Average order spend for this period was ${formatCurrency(currentStats.aov)}.`);
      }
    }

    return list.slice(0, 4);
  }, [parsedSales, currentStats, prevStats, calculatedTopItems, peakHours]);

  // Recent 5 bills
  const recentBills = useMemo(() => {
    return [...parsedSales]
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
      .slice(0, 5);
  }, [parsedSales]);

  // Setup/empty check
  const isSetupIncomplete = menuItems.length === 0;

  if (isSetupIncomplete) {
    return (
      <div className="flex h-screen overflow-hidden bg-bg-page font-sans text-text-primary transition-all duration-[220ms] ease-in-out">
        <div className="flex-1 overflow-y-auto p-8 flex flex-col justify-center items-center">
          <EmptyState
            icon={Coffee}
            title="Restaurant Setup Incomplete"
            subtitle="Please add menu items and categories first, then start billing to view your dashboard insights."
            ctaText="Go to Menu Management"
            onCtaClick={() => navigate('/menu')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container custom-scrollbar transition-all duration-[220ms] ease-in-out select-none">
      
      {/* HEADER WITH TITLE & LIVE BADGE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title sentence-case">
              {role === 'Administrator' ? 'Admin Analytics Studio' : 'Owner Control Center'}
            </h1>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Live</span>
          </div>
          <p className="page-subtitle mt-0.5 sentence-case">
            Real-time business performance analytics and insights
          </p>
        </div>

        {/* Go to POS Quick Action */}
        <button
          onClick={() => navigate('/pos')}
          className="h-[38px] bg-primary hover:bg-primary-dark text-white rounded-btn px-4 text-[13px] font-semibold flex items-center gap-2 transition-all duration-200 shadow-card hover:-translate-y-[1px]"
        >
          <UtensilsCrossed className="w-4 h-4" />
          Go to POS Billing
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* FILTER CONTROL TAB BAR */}
      <div className="bg-bg-card border border-border p-1.5 rounded-card shadow-card flex flex-wrap gap-1.5 items-center justify-between mb-6">
        <div className="flex flex-wrap gap-1">
          {(['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Monthly', 'Yearly', 'Custom'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`h-[32px] px-3.5 rounded-btn text-[12px] font-medium transition-all duration-150 ${
                activeFilter === filter
                  ? 'bg-primary text-white shadow-card'
                  : 'text-text-muted hover:bg-bg-page hover:text-text-primary'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs */}
        {activeFilter === 'Custom' && (
          <div className="flex items-center gap-2 px-2 py-1 md:py-0 border-l border-border/80 ml-auto md:ml-0">
            <span className="text-[11px] text-text-hint font-medium">Range:</span>
            <input
              type="date"
              value={customRange.start}
              onChange={(e) => setCustomRange((prev) => ({ ...prev, start: e.target.value }))}
              className="h-[28px] px-2 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary font-medium focus:outline-none focus:border-primary"
            />
            <span className="text-[11px] text-text-hint font-medium">to</span>
            <input
              type="date"
              value={customRange.end}
              onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
              className="h-[28px] px-2 text-[12px] border border-border rounded-btn bg-bg-page text-text-primary font-medium focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* ROW 1: SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-bg-card border border-border p-4.5 rounded-card shadow-card flex flex-col justify-between hover:shadow-card-hover transition-all duration-200 hover:-translate-y-[2px] group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-text-muted font-medium tracking-tight sentence-case">{kpi.title}</span>
                <div className={`p-2.5 rounded-full ${kpi.bgIcon} transition-all duration-200 group-hover:scale-105`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-[20px] font-bold text-text-primary font-mono tracking-tight">
                  {kpi.value}
                </h3>
                <span className={`text-[10px] mt-1 block leading-tight ${kpi.comparison.colorClass}`}>
                  {kpi.comparison.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ROW 2: DETAILED REVENUE ANALYTICS LINE CHART */}
      <div className="bg-bg-card border border-border rounded-card p-5 shadow-card mb-6 flex flex-col min-h-[340px] relative">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h4 className="text-[15px] font-bold text-text-primary sentence-case">Revenue Performance Trend</h4>
            <p className="text-[11px] text-text-muted mt-0.5">Aggregate financial chart mapping sales curves</p>
          </div>
          <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 font-bold px-2 py-0.5 rounded-btn uppercase tracking-wider">
            {activeFilter}
          </span>
        </div>

        {parsedSales.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-text-hint text-[13px] gap-2 py-10">
            <AlertCircle className="w-5 h-5 text-text-hint" />
            No transaction records found for this scope.
          </div>
        ) : (
          <div className="flex-1 w-full relative">
            {/* Custom Responsive SVG Chart */}
            <div className="w-full h-[220px]">
              <svg viewBox="0 0 1000 220" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="chartLineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7B1E1E" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#7B1E1E" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = 20 + (1 - ratio) * 160;
                  return (
                    <g key={i}>
                      <line
                        x1="20"
                        y1={y}
                        x2="980"
                        y2={y}
                        stroke="#E8E1D9"
                        strokeDasharray="4,4"
                        strokeWidth="1"
                      />
                      <text
                        x="15"
                        y={y + 3}
                        textAnchor="end"
                        fill="#9E9590"
                        fontSize="8"
                        className="font-mono font-medium"
                      >
                        {formatCurrency(ratio * maxValue)}
                      </text>
                    </g>
                  );
                })}

                {/* Compute curve data */}
                {(() => {
                  const w = 960;
                  const pts = chartPoints.map((pt, idx) => {
                    const x = 30 + (idx / Math.max(1, chartPoints.length - 1)) * w;
                    const y = 180 - (pt.value / maxValue) * 160;
                    return { x, y, label: pt.label, value: pt.value };
                  });

                  if (pts.length === 0) return null;

                  // Create Smooth Bezier Path
                  let pathD = `M ${pts[0].x} ${pts[0].y}`;
                  for (let i = 0; i < pts.length - 1; i++) {
                    const curr = pts[i];
                    const next = pts[i + 1];
                    // Control points for curvature
                    const cpX1 = curr.x + (next.x - curr.x) / 3;
                    const cpY1 = curr.y;
                    const cpX2 = curr.x + (2 * (next.x - curr.x)) / 3;
                    const cpY2 = next.y;
                    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
                  }

                  const gradAreaPath = `${pathD} L ${pts[pts.length - 1].x} 180 L ${pts[0].x} 180 Z`;

                  return (
                    <>
                      {/* Gradient Fill under Curve */}
                      <path d={gradAreaPath} fill="url(#chartLineGrad)" className="transition-all duration-300" />
                      
                      {/* Stroke Line */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#7B1E1E"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />

                      {/* Interactive Point Circles */}
                      {pts.map((pt, i) => (
                        <g
                          key={i}
                          onMouseEnter={() => {
                            setHoveredPoint({
                              x: pt.x,
                              y: pt.y,
                              label: pt.label,
                              value: pt.value
                            });
                          }}
                          onMouseLeave={() => setHoveredPoint(null)}
                          className="group cursor-pointer"
                        >
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="4.5"
                            fill="#FFFFFF"
                            stroke="#7B1E1E"
                            strokeWidth="2.5"
                            className="transition-all duration-200 group-hover:r-6 group-hover:fill-primary"
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="12"
                            fill="transparent"
                          />
                        </g>
                      ))}

                      {/* SVG Level X-Axis Labels */}
                      {pts.filter((_, idx) => pts.length < 15 || idx % Math.ceil(pts.length / 8) === 0).map((pt, i) => (
                        <text
                          key={i}
                          x={pt.x}
                          y="205"
                          textAnchor="middle"
                          fill="#6B6460"
                          fontSize="9"
                          className="font-sans font-medium"
                        >
                          {pt.label}
                        </text>
                      ))}
                    </>
                  );
                })()}
              </svg>

              {/* HTML Floating Tooltip */}
              {hoveredPoint && (
                <div
                  style={{
                    left: `${(hoveredPoint.x / 1000) * 100}%`,
                    top: `${(hoveredPoint.y / 220) * 100 - 45}%`
                  }}
                  className="absolute pointer-events-none -translate-x-1/2 bg-text-primary text-white text-[11px] p-2 rounded-btn shadow-popup font-mono z-20 flex flex-col gap-0.5 shrink-0 transition-all duration-75"
                >
                  <span className="font-sans font-bold text-[9px] text-[#FAF8F4]/70 uppercase">{hoveredPoint.label}</span>
                  <span className="font-bold text-[#E8E1D9]">{formatCurrency(hoveredPoint.value)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ROW 3: PEAK HOURS (LEFT) & TOP SELLING ITEMS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        
        {/* Peak Hours (40% width) */}
        <div className="bg-bg-card border border-border p-5 rounded-card shadow-card lg:col-span-2 flex flex-col justify-between min-h-[300px]">
          <div className="mb-4">
            <h4 className="text-[15px] font-bold text-text-primary flex items-center gap-1.5 sentence-case">
              <Clock className="w-4 h-4 text-primary" />
              Peak Business Hours
            </h4>
            <p className="text-[11px] text-text-muted mt-0.5">Identify busiest times of day</p>
          </div>

          {parsedSales.length === 0 ? (
            <div className="flex-grow flex items-center justify-center text-text-hint text-[13px] py-10">
              No sales data yet
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[220px] custom-scrollbar flex flex-col gap-2.5 pr-1">
              {peakHours
                .filter((h) => h.count > 0)
                .map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[12px] gap-2">
                    <span className="w-14 font-medium text-text-muted shrink-0">{h.label}</span>
                    <div className="flex-1 bg-border h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${h.pct}%` }}
                        className="bg-primary h-full rounded-full transition-all duration-300"
                      />
                    </div>
                    <span className="w-16 text-right font-mono font-medium text-text-primary shrink-0">
                      {h.count} {h.count === 1 ? 'order' : 'orders'}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Top Selling Items (60% width) */}
        <div className="bg-bg-card border border-border p-5 rounded-card shadow-card lg:col-span-3 flex flex-col justify-between min-h-[300px]">
          <div className="mb-4">
            <h4 className="text-[15px] font-bold text-text-primary flex items-center gap-1.5 sentence-case">
              <Flame className="w-4 h-4 text-primary" />
              Top Selling Items
            </h4>
            <p className="text-[11px] text-text-muted mt-0.5">Most popular menu selections by volume</p>
          </div>

          {parsedSales.length === 0 ? (
            <div className="flex-grow flex items-center justify-center text-text-hint text-[13px] py-10">
              No sales data yet
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3.5 justify-center">
              {calculatedTopItems.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-extrabold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-text-primary font-semibold truncate sentence-case">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right font-mono text-[11px] text-text-muted font-medium shrink-0">
                      {item.qty} sold &bull; <span className="font-bold text-text-primary">{formatCurrency(item.revenue)}</span>
                    </div>
                  </div>
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

      {/* ROW 4: BUSINESS INSIGHTS (LEFT) & RECENT ORDERS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        
        {/* Smart Business Insights (40% width) */}
        <div className="bg-bg-card border border-border p-5 rounded-card shadow-card lg:col-span-2 flex flex-col justify-between min-h-[300px]">
          <div className="mb-4">
            <h4 className="text-[15px] font-bold text-text-primary flex items-center gap-1.5 sentence-case">
              <Lightbulb className="w-4 h-4 text-primary" />
              Smart Business Insights
            </h4>
            <p className="text-[11px] text-text-muted mt-0.5">Automated operations feedback loop</p>
          </div>

          <div className="flex-1 flex flex-col gap-3 justify-center">
            {insights.map((insight, idx) => (
              <div key={idx} className="flex gap-2.5 items-start text-[12px] leading-relaxed text-text-muted">
                <span className="w-2.5 h-2.5 mt-1 rounded-full bg-primary shrink-0"></span>
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders Table (60% width) */}
        <div className="bg-bg-card border border-border rounded-card p-5 shadow-card lg:col-span-3 flex flex-col h-[300px]">
          <h4 className="text-[15px] font-bold text-text-primary mb-1 sentence-case">Recent Orders Log</h4>
          <p className="text-[11px] text-text-muted mb-4">Latest generated customer transaction logs</p>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {parsedSales.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-hint text-[13px]">
                No sales logs yet
              </div>
            ) : (
              <table className="w-full text-left text-[13px] font-sans">
                <thead>
                  <tr className="text-text-muted border-b border-border/80 font-bold">
                    <th className="font-semibold pb-2">Token</th>
                    <th className="font-semibold pb-2">Customer</th>
                    <th className="font-semibold pb-2 text-right">Amount</th>
                    <th className="font-semibold pb-2 text-center">Status</th>
                    <th className="font-semibold pb-2 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentBills.map((ord) => (
                    <tr key={ord.tokenNo} className="hover:bg-bg-page/50 text-[12px]">
                      <td className="py-2.5 font-bold font-mono text-primary">Token #{ord.tokenNo.split('-').pop()}</td>
                      <td className="py-2.5 max-w-[120px] truncate sentence-case font-medium">{ord.customerName}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-text-primary">₹{ord.grandTotal}</td>
                      <td className="py-2.5 text-center">
                        <span className="px-2 py-0.5 bg-[#DCFCE7] text-[#1A7A4A] border border-[#86EFAC] rounded-badge text-[10px] font-semibold">
                          Completed
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-text-muted font-medium">
                        {new Date(ord.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ROW 5: QUICK ACTIONS SECTION (FUTURE COMPATIBLE DESIGN) */}
      <div className="bg-bg-card border border-border p-5 rounded-card shadow-card">
        <h4 className="text-[14px] font-bold text-text-primary mb-3.5 sentence-case">Quick Actions & Shortcuts</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          
          <button
            onClick={() => navigate('/pos')}
            className="flex flex-col items-center justify-center p-4 border border-border hover:border-primary/40 rounded-card hover:bg-bg-page/40 transition-all duration-200 group text-center shrink-0 cursor-pointer"
          >
            <div className="p-3 bg-primary/10 rounded-full text-primary mb-2 transition-transform duration-200 group-hover:scale-105">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-bold text-text-primary">New Order</span>
            <span className="text-[10px] text-text-muted mt-1 leading-none">POS Terminal</span>
          </button>

          <button
            onClick={() => navigate('/kot')}
            className="flex flex-col items-center justify-center p-4 border border-border hover:border-primary/40 rounded-card hover:bg-bg-page/40 transition-all duration-200 group text-center shrink-0 cursor-pointer"
          >
            <div className="p-3 bg-blue-50 rounded-full text-blue-600 mb-2 transition-transform duration-200 group-hover:scale-105">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-bold text-text-primary">Kitchen</span>
            <span className="text-[10px] text-text-muted mt-1 leading-none">KOT Display</span>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="flex flex-col items-center justify-center p-4 border border-border hover:border-primary/40 rounded-card hover:bg-bg-page/40 transition-all duration-200 group text-center shrink-0 cursor-pointer"
          >
            <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 mb-2 transition-transform duration-200 group-hover:scale-105">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-bold text-text-primary">Reports</span>
            <span className="text-[10px] text-text-muted mt-1 leading-none">Sales Summary</span>
          </button>

          <button
            onClick={() => navigate('/menu')}
            className="flex flex-col items-center justify-center p-4 border border-border hover:border-primary/40 rounded-card hover:bg-bg-page/40 transition-all duration-200 group text-center shrink-0 cursor-pointer"
          >
            <div className="p-3 bg-purple-50 rounded-full text-purple-600 mb-2 transition-transform duration-200 group-hover:scale-105">
              <Flame className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-bold text-text-primary">Menu</span>
            <span className="text-[10px] text-text-muted mt-1 leading-none">Dish Items</span>
          </button>

          <button
            onClick={() => navigate('/customers')}
            className="flex flex-col items-center justify-center p-4 border border-border hover:border-primary/40 rounded-card hover:bg-bg-page/40 transition-all duration-200 group text-center shrink-0 cursor-pointer"
          >
            <div className="p-3 bg-amber-50 rounded-full text-amber-600 mb-2 transition-transform duration-200 group-hover:scale-105">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-bold text-text-primary">Customers</span>
            <span className="text-[10px] text-text-muted mt-1 leading-none">History Logs</span>
          </button>
        </div>
      </div>

    </div>
  );
};
