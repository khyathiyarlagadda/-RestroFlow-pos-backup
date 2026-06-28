import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Eye, EyeOff, Loader2 } from 'lucide-react';
import { storage } from '../utils/storage';
import { supabase } from '../utils/supabaseClient';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Administrator' | 'Restaurant Owner' | 'Owner' | 'Staff'>('Administrator');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Field errors
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUsernameError(false);
    setPasswordError(false);

    if (!username.trim()) {
      setError('Username is required');
      setUsernameError(true);
      return;
    }
    if (!password) {
      setError('Password is required');
      setPasswordError(true);
      return;
    }

    setIsLoading(true);

    try {
      let derivedEmail = username.trim();
      if (!derivedEmail.includes('@')) {
        try {
          const { data: dbEmail, error: rpcError } = await supabase.rpc('get_user_email', { p_username: derivedEmail });
          if (!rpcError && dbEmail) {
            derivedEmail = dbEmail;
          } else {
            derivedEmail = `${derivedEmail}@restroflow.com`;
          }
        } catch {
          derivedEmail = `${derivedEmail}@restroflow.com`;
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: derivedEmail,
        password
      });

      if (authError) {
        setIsLoading(false);
        setError('Invalid username, email or password for selected role');
        setUsernameError(true);
        setPasswordError(true);
        return;
      }

      if (!authData.user) {
        throw new Error('Authentication failed');
      }

      // Fetch profile to verify role and status
      let profile = await storage.getUserProfile(authData.user.id);
      if (!profile) {
        try {
          // Get or create restaurant
          let restaurantId = '';
          const { data: restData } = await supabase.from('restaurants').select('id').limit(1);
          if (restData && restData.length > 0) {
            restaurantId = restData[0].id;
          } else {
            const { data: newRest, error: restError } = await supabase
              .from('restaurants')
              .insert({ name: 'My Restaurant' })
              .select('id')
              .single();
            if (restError) throw restError;
            restaurantId = newRest.id;
          }

          // Check if email column exists in profiles table
          let emailColumnExists = false;
          try {
            const { error: columnError } = await supabase.from('profiles').select('email').limit(1);
            if (!columnError) {
              emailColumnExists = true;
            } else if (columnError.code !== 'PGRST100' && !columnError.message.includes('does not exist')) {
              emailColumnExists = true;
            }
          } catch {
            emailColumnExists = true;
          }

          // Derive username and full name from user_metadata or email
          const meta = authData.user.user_metadata || {};
          const usernameVal = meta.username || authData.user.email?.split('@')[0] || 'admin';
          const fullNameVal = meta.full_name || 'Administrator';
          const roleVal = meta.role || 'Administrator';

          const insertRow: any = {
            id: authData.user.id,
            username: usernameVal,
            full_name: fullNameVal,
            role: roleVal,
            status: 'active',
            restaurant_id: restaurantId
          };
          if (emailColumnExists && authData.user.email) {
            insertRow.email = authData.user.email;
          }

          const { error: insertError } = await supabase.from('profiles').insert(insertRow);
          if (insertError) throw insertError;

          // Seed settings if missing
          const { data: existingSettings } = await supabase
            .from('system_settings')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

          if (!existingSettings) {
            await supabase.from('system_settings').insert({
              restaurant_id: restaurantId,
              cgst: 0,
              sgst: 0,
              gst_enabled: false,
              restaurant_name: 'My Restaurant',
              currency: '₹',
              footer_message: 'Thank you for dining with us!',
              print_type: 'Thermal',
              auto_print: true,
              container_charge_enabled: false,
              default_container_charge: 0,
              show_fields: {
                gstinOnReceipt: false,
                phoneOnReceipt: false,
                emailOnReceipt: false,
                footerOnReceipt: true
              }
            });
          }

          // Fetch the newly created profile
          profile = await storage.getUserProfile(authData.user.id);
        } catch (createErr: any) {
          console.error("Failed to auto-create profile:", createErr);
          await supabase.auth.signOut();
          setIsLoading(false);
          setError(`User profile not found and auto-creation failed: ${createErr.message}`);
          return;
        }
      }

      if (profile.role !== role) {
        const isOwnerMatch = (profile.role === 'Owner' || profile.role === 'Restaurant Owner') && 
                             (role === 'Owner' || role === 'Restaurant Owner');
        if (!isOwnerMatch) {
          await supabase.auth.signOut();
          setIsLoading(false);
          setError('Invalid username, email or password for selected role');
          return;
        }
      }

      if (profile.status === 'inactive') {
        await supabase.auth.signOut();
        setIsLoading(false);
        setError('This account has been deactivated');
        return;
      }

      // Initialize cached storage for the tenant
      await storage.initializeSupabase(profile.restaurant_id);

      // Create local session
      storage.setAuth({
        userId: profile.id,
        username: profile.username,
        role: profile.role,
        loginTime: new Date().toISOString()
      });

      setIsLoading(false);
      onLoginSuccess();

      // Redirect depending on role
      if (profile.role === 'Restaurant Owner') {
        navigate('/pos');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setIsLoading(false);
      setError(err.message || 'An error occurred during login');
    }
  };

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-6 select-none font-sans">
      <div className="bg-bg-card w-full max-w-[420px] rounded-[16px] shadow-popup border border-border p-10 flex flex-col gap-6">
        {/* Logo and Wordmark */}
        <div className="flex flex-col items-center text-center gap-2">
          <UtensilsCrossed className="w-[36px] h-[36px] text-primary" />
          <h1 className="text-[28px] font-bold tracking-[-0.5px] select-none">
            <span className="text-[#7B1E1E]">Restro</span>
            <span className="text-[#A52A2A]">Flow</span>
          </h1>
          <p className="text-[13px] font-medium text-[#9E9590] tracking-[0.5px] uppercase">
            Restaurant Management System
          </p>
        </div>

        <div className="border-b border-border my-0" />

        {/* Login Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="flex flex-col">
            <label htmlFor="username" className="input-label-custom">Username or Email</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username or email"
              value={username}
              disabled={isLoading}
              onChange={(e) => setUsername(e.target.value)}
              className={usernameError ? 'border-danger-custom' : ''}
              autoComplete="username"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="password" className="input-label-custom">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                disabled={isLoading}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pr-10 ${passwordError ? 'border-danger-custom' : ''}`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors duration-150"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <label htmlFor="role" className="input-label-custom">Role</label>
            <select
              id="role"
              value={role}
              disabled={isLoading}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full"
            >
              <option value="Administrator">Administrator</option>
              <option value="Owner">Owner</option>
              <option value="Restaurant Owner">Restaurant Owner (Legacy)</option>
              <option value="Staff">Staff</option>
            </select>
          </div>

          {error && (
            <span className="text-[13px] text-danger-custom font-semibold mt-1 sentence-case">
              {error}
            </span>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[42px] bg-primary text-white rounded-btn hover:bg-primary-dark font-semibold text-[14px] tracking-[0.2px] flex items-center justify-center gap-2 mt-2 transition-colors duration-150 disabled:opacity-80 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Logging in...
              </>
            ) : (
              'Log in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
