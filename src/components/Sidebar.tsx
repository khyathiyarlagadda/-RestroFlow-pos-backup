import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  UtensilsCrossed,
  LayoutDashboard,
  BookOpen,
  Package,
  Table2,
  ClipboardList,
  BarChart2,
  Users,
  Receipt,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { storage } from '../utils/storage';

interface SidebarProps {
  userRole: 'Administrator' | 'Restaurant Owner' | 'Owner' | 'Staff';
  username: string;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ userRole, username, onLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    storage.clearAuth();
    onLogout();
    navigate('/login');
  };

  // Define sidebar items for Administrator
  const adminItems = [
    { icon: UtensilsCrossed, label: 'POS Billing', path: '/pos' },
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: BookOpen, label: 'Menu', path: '/menu' },
    { icon: Package, label: 'Inventory', path: '/inventory' },
    { icon: Table2, label: 'Tables', path: '/tables' },
    { icon: ClipboardList, label: 'KOT', path: '/kot' },
    { icon: BarChart2, label: 'Reports', path: '/reports' },
    { icon: Users, label: 'Customers', path: '/customers' },
    { icon: Receipt, label: 'Sales History', path: '/sales-history' },
    { icon: UserCog, label: 'Users', path: '/users' },
    { icon: Settings, label: 'Settings', path: '/settings' }
  ];

  // Define sidebar items for Restaurant Owner
  const ownerItems = [
    { icon: UtensilsCrossed, label: 'POS Billing', path: '/pos' },
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: BookOpen, label: 'Menu', path: '/menu' },
    { icon: Package, label: 'Inventory', path: '/inventory' },
    { icon: Table2, label: 'Tables', path: '/tables' },
    { icon: ClipboardList, label: 'Orders', path: '/orders' },
    { icon: BarChart2, label: 'Reports', path: '/reports' },
    { icon: Users, label: 'Customers', path: '/customers' },
    { icon: Receipt, label: 'Sales History', path: '/sales-history' },
    { icon: Settings, label: 'Settings', path: '/settings' }
  ];

  const items = userRole === 'Administrator' ? adminItems : ownerItems;

  return (
    <div
      className={`h-full bg-[#7B1E1E] text-white flex flex-col justify-between z-40 select-none shadow-popup border-r border-[#9E2A2A] transition-all duration-[220ms] ease-in-out no-print shrink-0 ${
        isCollapsed ? 'w-16' : 'w-[220px]'
      }`}
    >
      {/* Header Monogram / Logo */}
      <div className="h-[60px] flex items-center border-b border-[#9E2A2A]/40 px-4 justify-center">
        {isCollapsed ? (
          <UtensilsCrossed className="w-[22px] h-[22px] text-white" />
        ) : (
          <div className="flex items-center gap-2 w-full justify-start">
            <div className="p-1 bg-white rounded-full text-[#7B1E1E] shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <span className="text-[20px] font-bold tracking-tight select-none">
              <span className="text-white">Restro</span>
              <span className="text-white/65">Flow</span>
            </span>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar flex flex-col gap-1 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group relative flex items-center rounded-btn h-10 px-3 transition-colors duration-150 ${
                isActive
                  ? 'bg-white/15 border-l-[3px] border-white text-white pl-[9px]'
                  : 'text-white/85 hover:bg-white/8 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-center">
                <Icon
                  className={`w-[18px] h-[18px] transition-colors duration-150 ${
                    isActive ? 'text-white' : 'text-white/75 group-hover:text-white'
                  }`}
                />
              </div>

              {!isCollapsed && (
                <span className={`ml-3 sidebar-nav-label truncate sentence-case ${
                  isActive ? 'text-white' : 'text-white/85 group-hover:text-white'
                }`}>
                  {item.label}
                </span>
              )}

              {/* Tooltip for Collapsed State */}
              {isCollapsed && (
                <div className="absolute left-14 hidden group-hover:block bg-[#7B1E1E] text-white text-[12px] px-2.5 py-1.5 rounded-[4px] shadow-popup border border-[#9E2A2A] whitespace-nowrap z-50 animate-[fadeIn_150ms_ease]">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer User Profile & Collapse */}
      <div className="border-t border-[#9E2A2A]/40 p-2 flex flex-col gap-2 bg-[#5E1515]/30">
        {/* User Badge */}
        <div className="flex items-center justify-between p-1.5 rounded-btn">
          {isCollapsed ? (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[13px] font-medium text-white mx-auto">
              {username.substring(0, 2).toUpperCase()}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-[14px] font-medium text-white shrink-0">
                {username.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-medium text-white truncate sentence-case">
                  {username}
                </span>
                <span className="text-[10px] text-white/60 truncate sentence-case">
                  {userRole === 'Administrator' ? 'Admin' : 'Owner'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1">
          {/* Logout button */}
          <button
            onClick={handleLogout}
            className={`group relative flex items-center rounded-btn h-10 px-3 text-white/75 hover:bg-white/8 hover:text-white transition-colors duration-150 ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Logout"
          >
            <LogOut className="w-[18px] h-[18px]" />
            {!isCollapsed && <span className="ml-3 text-[14px] sentence-case">Logout</span>}
            {isCollapsed && (
              <div className="absolute left-14 hidden group-hover:block bg-[#7B1E1E] text-white text-[12px] px-2.5 py-1.5 rounded-[4px] shadow-popup border border-[#9E2A2A] whitespace-nowrap z-50">
                Logout
              </div>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`flex items-center rounded-btn h-10 px-3 text-white/75 hover:bg-white/8 hover:text-white transition-colors duration-150 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            {isCollapsed ? (
              <ChevronRight className="w-[18px] h-[18px]" />
            ) : (
              <div className="flex items-center gap-3">
                <ChevronLeft className="w-[18px] h-[18px]" />
                <span className="text-[13px] sentence-case">Collapse sidebar</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
