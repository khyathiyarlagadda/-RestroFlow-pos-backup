import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { storage } from './utils/storage';
import { supabase } from './utils/supabaseClient';
import type { Session } from './types';
import { Sidebar } from './components/Sidebar';


// Screens
import { SetupWizard } from './screens/SetupWizard';
import { Login } from './screens/Login';
import { POSBilling } from './screens/POSBilling';
import { Dashboard } from './screens/Dashboard';
import { MenuManagement } from './screens/MenuManagement';
import { Inventory } from './screens/Inventory';
import { Tables } from './screens/Tables';
import { KOTScreen } from './screens/KOT';
import { Reports } from './screens/Reports';
import { SalesHistory } from './screens/SalesHistory';
import { Customers } from './screens/Customers';
import { SettingsScreen } from './screens/Settings';
import { UserManagement } from './screens/UserManagement';
import { SupabaseConfigRequired } from './components/SupabaseConfigRequired';

// Layout wrapper for authenticated screens
const AppLayout: React.FC<{ session: Session; onLogout: () => void }> = ({ session, onLogout }) => {
  return (
    <div className="flex h-screen w-screen bg-bg-page overflow-hidden font-sans text-text-primary">
      {/* Fixed Left Sidebar */}
      <Sidebar userRole={session.role} username={session.username} onLogout={onLogout} />

      {/* Main panel container */}
      <div className="flex-1 h-full overflow-hidden relative">
        <Outlet />
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [hasUsers, setHasUsers] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);

  const checkInitialState = async () => {
    try {
      setLoading(true);
      const configured = !!(
        import.meta.env.VITE_SUPABASE_URL && 
        import.meta.env.VITE_SUPABASE_ANON_KEY &&
        !String(import.meta.env.VITE_SUPABASE_URL).includes('placeholder')
      );
      setIsConfigured(configured);

      if (!configured) {
        setLoading(false);
        return;
      }

      // Check if any restaurant exists in database
      const hasRestaurant = await storage.hasAnyRestaurant();
      console.log("[RestroFlow] Restaurant detected in Supabase:", hasRestaurant);
      setHasUsers(hasRestaurant);

      if (!hasRestaurant) {
        setSession(null);
        setLoading(false);
        return;
      }

      // Check active Supabase session
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (supabaseSession) {
        const profile = await storage.getUserProfile(supabaseSession.user.id);
        if (profile && profile.status === 'active') {
          // Initialize local cache from Supabase
          await storage.initializeSupabase(profile.restaurant_id);
          
          storage.setAuth({
            userId: profile.id,
            username: profile.username,
            role: profile.role,
            loginTime: new Date().toISOString()
          });
          setSession(storage.getAuth());
        } else {
          await supabase.auth.signOut();
          storage.clearAuth();
          setSession(null);
        }
      } else {
        storage.clearAuth();
        setSession(null);
      }
    } catch (e) {
      console.error("Initialization error:", e);
      setHasUsers(false);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkInitialState();
  }, []);

  const handleLoginSuccess = () => {
    checkInitialState();
  };

  const handleLogout = () => {
    storage.clearAuth();
    setSession(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center text-text-muted">
        Loading RestroFlow...
      </div>
    );
  }

  if (!isConfigured) {
    return <SupabaseConfigRequired />;
  }

  return (
    <HashRouter>
      <Routes>
        {/* If no users exist, force setup wizard */}
        {!hasUsers ? (
          <Route path="*" element={<SetupWizard onSetupComplete={checkInitialState} />} />
        ) : (
          <>
            {/* Setup Wizard direct path */}
            <Route path="/setup" element={<Navigate to="/login" replace />} />

            {/* Login Route */}
            <Route
              path="/login"
              element={
                session ? (
                  session.role === 'Restaurant Owner' || session.role === 'Owner' ? (
                    <Navigate to="/pos" replace />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                ) : (
                  <Login onLoginSuccess={handleLoginSuccess} />
                )
              }
            />

            {/* Protected Routes Wrapper */}
            {session ? (
              <Route element={<AppLayout session={session} onLogout={handleLogout} />}>
                {/* Dashboard */}
                <Route path="/dashboard" element={<Dashboard />} />

                {/* POS Billing */}
                <Route path="/pos" element={<POSBilling />} />

                {/* Menu items */}
                <Route path="/menu" element={<MenuManagement />} />


                {/* Inventory (Admin & Owner) */}
                <Route path="/inventory" element={<Inventory />} />

                {/* Tables (Admin & Owner) */}
                <Route path="/tables" element={<Tables />} />

                {/* KOT: KOT maps for admin, Orders maps for owner */}
                <Route path="/kot" element={<KOTScreen />} />
                <Route path="/orders" element={<KOTScreen />} />

                {/* Reports (Admin & Owner) */}
                <Route path="/reports" element={<Reports />} />

                {/* Customers (Admin & Owner) */}
                <Route path="/customers" element={<Customers />} />

                {/* Sales History (Admin & Owner) */}
                <Route path="/sales-history" element={<SalesHistory />} />

                {/* User management (Admin only) */}
                <Route
                  path="/users"
                  element={
                    session.role === 'Administrator' ? (
                      <UserManagement />
                    ) : (
                      <Navigate to="/pos" replace />
                    )
                  }
                />

                {/* Settings */}
                <Route path="/settings" element={<SettingsScreen />} />

                {/* Fallback route */}
                <Route
                  path="*"
                  element={
                    session.role === 'Restaurant Owner' || session.role === 'Owner' ? (
                      <Navigate to="/pos" replace />
                    ) : (
                      <Navigate to="/dashboard" replace />
                    )
                  }
                />
              </Route>
            ) : (
              // If not authenticated, redirect to Login
              <Route path="*" element={<Navigate to="/login" replace />} />
            )}
          </>
        )}
      </Routes>
    </HashRouter>
  );
};

export default App;
