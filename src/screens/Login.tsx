import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Eye, EyeOff, Loader2 } from 'lucide-react';
import { storage } from '../utils/storage';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Administrator' | 'Restaurant Owner'>('Administrator');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Field errors
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
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

    // Simulate small latency for premium UI spinner feel
    setTimeout(() => {
      const users = storage.getUsers();
      // Find matching user (and cast as User & { password?: string } to check local password)
      const user = users.find(
        (u: any) =>
          u.username.toLowerCase() === username.trim().toLowerCase() &&
          u.role === role &&
          u.password === password
      );

      if (!user) {
        setIsLoading(false);
        setError('Invalid username or password for selected role');
        setUsernameError(true);
        setPasswordError(true);
        return;
      }

      if (user.status === 'inactive') {
        setIsLoading(false);
        setError('This account has been deactivated');
        return;
      }

      // Create Session
      storage.setAuth({
        userId: user.id,
        username: user.username,
        role: user.role,
        loginTime: new Date().toISOString()
      });

      setIsLoading(false);
      onLoginSuccess();

      // Redirect depending on role
      if (user.role === 'Restaurant Owner') {
        navigate('/pos');
      } else {
        navigate('/dashboard');
      }
    }, 800);
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
            <label htmlFor="username" className="input-label-custom">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
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
              <option value="Restaurant Owner">Restaurant Owner</option>
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
