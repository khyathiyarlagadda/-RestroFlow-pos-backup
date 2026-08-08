import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { storage } from './utils/storage';
import { supabase } from './utils/supabaseClient';
import { networkManager } from './utils/networkManager';
import { syncManager } from './services/syncManager';
import { getMasterCache } from './db/indexedDB';
import type { Session } from './types';
import { Sidebar } from './components/Sidebar';

// Screens
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

      // Read persisted session immediately from localStorage or IndexedDB
      const cachedAuth = storage.getAuth() || (await getMasterCache<Session>('auth_session'));
      const cachedRestaurantId = storage.getRestaurantId() || localStorage.getItem('restroflow_restaurant_id');

      const isOffline = typeof navigator !== 'undefined' && (!navigator.onLine || !networkManager.isOnline);

      const loadLocalOfflineSession = async () => {
        if (cachedAuth && cachedRestaurantId) {
          console.log('Offline session restored.');
          storage.setAuth(cachedAuth);
          await storage.initializeSupabase(cachedRestaurantId);
          setSession(cachedAuth);
        } else {
          console.log('No cached session found.');
          setSession(null);
        }
      };

      // 1. If Offline: Load immediately without ANY network calls (<100ms)
      if (isOffline) {
        await loadLocalOfflineSession();
        setLoading(false);
        return;
      }

      // 2. If Online: Fast 800ms race to check Supabase session
      const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) =>
        setTimeout(() => resolve({ isTimeout: true }), 800)
      );

      const authCheckPromise = (async () => {
        try {
          const { data: { session: supabaseSession } } = await supabase.auth.getSession();
          if (supabaseSession) {
            const profile = await storage.getUserProfile(supabaseSession.user.id);
            if (profile && profile.status === 'active') {
              await storage.initializeSupabase(profile.restaurant_id);
              const activeSession: Session = {
                userId: profile.id,
                username: profile.username,
                role: profile.role,
                loginTime: new Date().toISOString()
              };
              storage.setAuth(activeSession);
              return { session: activeSession, isTimeout: false };
            }
          }
          return { session: null, isTimeout: false };
        } catch (err) {
          console.warn('[App] Supabase online check error:', err);
          return { session: cachedAuth, isTimeout: false };
        }
      })();

      const result = await Promise.race([authCheckPromise, timeoutPromise]);

      if ('isTimeout' in result && result.isTimeout) {
        console.warn('[App] Online check timed out (>800ms). Restoring local session...');
        await loadLocalOfflineSession();
      } else {
        const sess = (result as any).session;
        if (sess) {
          setSession(sess);
          syncManager.syncPending().catch(console.error);
        } else if (cachedAuth && cachedRestaurantId) {
          await loadLocalOfflineSession();
          if (networkManager.isOnline) {
            syncManager.syncPending().catch(console.error);
          }
        } else {
          console.log('No cached session found.');
          setSession(null);
        }
      }
    } catch (e) {
      console.error('[App] Initialization error:', e);
      const cachedAuth = storage.getAuth();
      const cachedRestaurantId = storage.getRestaurantId() || localStorage.getItem('restroflow_restaurant_id');
      if (cachedAuth && cachedRestaurantId) {
        try {
          console.log('Offline session restored.');
          storage.setAuth(cachedAuth);
          await storage.initializeSupabase(cachedRestaurantId);
          setSession(cachedAuth);
          if (networkManager.isOnline) {
            syncManager.syncPending().catch(console.error);
          }
        } catch {
          console.log('No cached session found.');
          setSession(null);
        }
      } else {
        console.log('No cached session found.');
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkInitialState();

    const unsubscribe = networkManager.subscribe((isOnline) => {
      if (isOnline) {
        console.log('[App] Network reconnected. Triggering syncManager.syncPending()...');
        syncManager.syncPending().catch(console.error);
        const cachedRestaurantId = storage.getRestaurantId();
        if (cachedRestaurantId) {
          storage.initializeSupabase(cachedRestaurantId).catch(console.error);
        }
      }
    });

    return () => {
      unsubscribe();
    };
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
      </Routes>
    </HashRouter>
  );
};

export default App;
