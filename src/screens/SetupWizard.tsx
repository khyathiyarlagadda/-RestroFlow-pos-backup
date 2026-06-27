import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, CheckCircle2, ChevronRight, Store, UserPlus, Loader2 } from 'lucide-react';
import { storage } from '../utils/storage';
import { supabase } from '../utils/supabaseClient';


interface SetupWizardProps {
  onSetupComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onSetupComplete }) => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Redirect to login if a restaurant already exists in database
  useEffect(() => {
    let active = true;
    const checkExisting = async () => {
      try {
        const exists = await storage.hasAnyRestaurant();
        if (exists && active) {
          console.warn("[RestroFlow] Restaurant already exists. Skipping SetupWizard.");
          await onSetupComplete();
          navigate('/login');
        }
      } catch (e) {
        console.error("Error during SetupWizard mount check:", e);
      }
    };
    checkExisting();
    return () => {
      active = false;
    };
  }, [onSetupComplete, navigate]);

  // Step 1: Admin account
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step1Error, setStep1Error] = useState('');

  // Step 2: Restaurant Details
  const [restaurantName, setRestaurantName] = useState('RestroFlow POS');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [step2Error, setStep2Error] = useState('');

  const [isCompleting, setIsCompleting] = useState(false);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error('');

    if (!username.trim()) {
      setStep1Error('Username is required');
      return;
    }
    if (username.trim().length < 3) {
      setStep1Error('Username must be at least 3 characters');
      return;
    }
    if (!fullName.trim()) {
      setStep1Error('Full name is required');
      return;
    }
    if (!adminEmail.trim()) {
      setStep1Error('Email is required');
      return;
    }
    if (!adminEmail.trim().includes('@')) {
      setStep1Error('Invalid email format');
      return;
    }
    if (!password) {
      setStep1Error('Password is required');
      return;
    }
    if (password.length < 6) {
      setStep1Error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setStep1Error('Passwords do not match');
      return;
    }

    try {
      const { data } = await supabase.from('profiles').select('id').eq('username', username.trim()).limit(1);
      if (data && data.length > 0) {
        setStep1Error('Username already exists');
        return;
      }
    } catch (err) {
      console.error("Failed to check username uniqueness:", err);
    }

    setStep(2);
  };

  const runDatabaseSetup = async (nameToUse: string): Promise<boolean> => {
    setIsCompleting(true);
    setStep2Error('');
    try {
      // 0. Double check if a restaurant already exists to prevent duplicate creations
      const exists = await storage.hasAnyRestaurant();
      if (exists) {
        throw new Error('A restaurant configuration already exists in the database. Please reload the app or go to the login page.');
      }

      // 1. Create Restaurant
      const restaurantId = await storage.createRestaurant(nameToUse.trim(), logoUrl.trim() || undefined);

      // 2. Sign up Admin Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'Administrator',
            username: username.trim()
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User registration failed');

      // 3. Save profile details
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username: username.trim(),
        full_name: fullName.trim(),
        email: adminEmail.trim(),
        role: 'Administrator',
        status: 'active',
        restaurant_id: restaurantId
      });
      if (profileError) throw profileError;

      // 4. Save settings
      const { error: settingsError } = await supabase.from('system_settings').insert({
        restaurant_id: restaurantId,
        cgst: 0,
        sgst: 0,
        gst_enabled: !!gstin.trim(),
        gstin: gstin.trim() || null,
        restaurant_name: nameToUse.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        currency: '₹',
        footer_message: 'Thank you for dining with us!',
        print_type: 'Thermal',
        auto_print: true,
        container_charge_enabled: false,
        default_container_charge: 0,
        show_fields: {
          gstinOnReceipt: !!gstin.trim(),
          phoneOnReceipt: !!phone.trim(),
          emailOnReceipt: !!email.trim(),
          footerOnReceipt: true
        }
      });
      if (settingsError) throw settingsError;

      return true;
    } catch (err: any) {
      console.error(err);
      setStep2Error(err.message || 'An error occurred during database setup');
      return false;
    } finally {
      setIsCompleting(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep2Error('');

    if (!restaurantName.trim()) {
      setStep2Error('Restaurant name is required');
      return;
    }

    const success = await runDatabaseSetup(restaurantName);
    if (success) {
      setStep(3);
    }
  };

  const handleSkipStep2 = async () => {
    const defaultName = `${fullName.trim()}'s Restaurant`;
    const success = await runDatabaseSetup(defaultName);
    if (success) {
      setStep(3);
    }
  };

  const handleCompleteSetup = async () => {
    try {
      await onSetupComplete();
      navigate('/login');
    } catch (err: any) {
      console.error(err);
    }
  };


  return (
    <div className="min-h-screen h-screen max-h-screen bg-bg-page flex items-center justify-center p-4 sm:p-6 select-none font-sans overflow-hidden">
      <div className="bg-bg-card w-full max-w-[480px] max-h-[min(650px,95vh)] rounded-[16px] shadow-popup border border-border p-6 sm:p-10 flex flex-col gap-4 sm:gap-6 overflow-hidden">
        {/* Header Block (Logo & Progress) - Fixed/Non-Scrollable */}
        <div className="flex flex-col gap-4 sm:gap-6 shrink-0">
          {/* Logo and Brand */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
              <UtensilsCrossed className="w-7 h-7" />
            </div>
            <h2 className="text-[22px] sm:text-[24px] font-bold tracking-[-0.5px] select-none">
              <span className="text-[#7B1E1E]">Restro</span>
              <span className="text-[#A52A2A]">Flow</span>
            </h2>
            <span className="text-[12px] sm:text-[13px] font-medium text-[#9E9590] tracking-[0.5px] uppercase">Setup wizard</span>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center justify-between px-2 sm:px-4">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[12px] sm:text-[13px] font-semibold border-2 transition-colors duration-200 shrink-0 ${
                    step === s
                      ? 'border-primary bg-primary text-white'
                      : step > s
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-transparent text-text-hint'
                  }`}
                >
                  {step > s ? '✓' : s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-[2px] mx-1 sm:mx-2 transition-colors duration-200 ${
                      step > s ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="border-b border-border my-0" />
        </div>

        {/* Step Content Area */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="flex-1 flex flex-col overflow-hidden">
            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar flex flex-col gap-4 py-1">
              <div className="flex items-center gap-2 text-primary">
                <UserPlus className="w-5 h-5 shrink-0" />
                <h3 className="section-heading text-[16px] sm:text-[18px]">Create administrator account</h3>
              </div>

              <div className="flex flex-col">
                <label htmlFor="username" className="input-label-custom">Username</label>
                <input
                  id="username"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={step1Error && !username ? 'border-danger-custom' : ''}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="fullName" className="input-label-custom">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={step1Error && !fullName ? 'border-danger-custom' : ''}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="adminEmail" className="input-label-custom">Email address</label>
                <input
                  id="adminEmail"
                  type="email"
                  placeholder="e.g. admin@restroflow.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className={step1Error && (!adminEmail || !adminEmail.includes('@')) ? 'border-danger-custom' : ''}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="password" className="input-label-custom">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={step1Error && (!password || password.length < 6) ? 'border-danger-custom' : ''}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="confirmPassword" className="input-label-custom">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={step1Error && (password !== confirmPassword || password.length < 6) ? 'border-danger-custom' : ''}
                />
              </div>

              {step1Error && (
                <span className="text-[13px] text-danger-custom font-semibold mt-1 sentence-case">
                  {step1Error}
                </span>
              )}
            </div>

            {/* Sticky/Fixed Footer */}
            <div className="border-t border-border pt-4 mt-4 flex flex-col shrink-0">
              <button
                type="submit"
                className="w-full h-[40px] sm:h-[42px] bg-primary text-white rounded-btn hover:bg-primary-dark font-semibold text-[14px] tracking-[0.2px] flex items-center justify-center gap-1.5 transition-colors duration-150"
              >
                Continue to restaurant details
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="flex-1 flex flex-col overflow-hidden">
            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar flex flex-col gap-4 py-1">
              <div className="flex items-center gap-2 text-primary">
                <Store className="w-5 h-5 shrink-0" />
                <h3 className="section-heading text-[16px] sm:text-[18px]">Restaurant details</h3>
              </div>

              <div className="flex flex-col">
                <label htmlFor="restaurantName" className="input-label-custom">Restaurant name</label>
                <input
                  id="restaurantName"
                  type="text"
                  placeholder="e.g. Spice Garden"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className={step2Error && !restaurantName ? 'border-danger-custom' : ''}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="phone" className="input-label-custom">Phone number</label>
                <input
                  id="phone"
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="email" className="input-label-custom">Email address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="e.g. info@spicegarden.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="address" className="input-label-custom">Address</label>
                <textarea
                  id="address"
                  placeholder="Full restaurant address for receipts"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-16 sm:h-20 py-2 resize-none"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="gstin" className="input-label-custom">GSTIN (optional)</label>
                <input
                  id="gstin"
                  type="text"
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="logoUrl" className="input-label-custom">Logo URL (optional)</label>
                <input
                  id="logoUrl"
                  type="text"
                  placeholder="e.g. https://domain.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>

              {step2Error && (
                <span className="text-[13px] text-danger-custom font-semibold mt-1 sentence-case">
                  {step2Error}
                </span>
              )}
            </div>

            {/* Sticky/Fixed Footer */}
            <div className="border-t border-border pt-4 mt-4 flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleSkipStep2}
                disabled={isCompleting}
                className="flex-1 h-[40px] sm:h-[42px] border border-border text-text-primary rounded-btn hover:bg-bg-page font-semibold text-[13px] sm:text-[14px] transition-colors duration-150 disabled:opacity-50"
              >
                Skip this step
              </button>
              <button
                type="submit"
                disabled={isCompleting}
                className="flex-1 h-[40px] sm:h-[42px] bg-primary text-white rounded-btn hover:bg-primary-dark font-semibold text-[13px] sm:text-[14px] flex items-center justify-center gap-1.5 transition-colors duration-150 disabled:opacity-50"
              >
                {isCompleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isCompleting ? 'Saving...' : 'Next'}
                {!isCompleting && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="flex-1 flex flex-col overflow-hidden justify-between animate-[scaleUp_250ms_ease]">
            {/* Scrollable Info Body */}
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar flex flex-col items-center text-center gap-5 py-1">
              <div className="p-4 bg-success/10 rounded-full text-success shrink-0">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="empty-title-custom">System is ready!</h3>
                <p className="empty-subtitle-custom leading-relaxed">
                  Administrator account and restaurant configuration have been set up successfully. You can now log in to the billing console.
                </p>
              </div>
            </div>

            {/* Sticky/Fixed Footer */}
            <div className="border-t border-border pt-4 mt-4 shrink-0">
              <button
                onClick={handleCompleteSetup}
                disabled={isCompleting}
                className="w-full h-[40px] sm:h-[42px] bg-primary text-white rounded-btn hover:bg-primary-dark font-semibold text-[14px] flex items-center justify-center gap-1.5 transition-colors duration-150 disabled:opacity-50"
              >
                {isCompleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isCompleting ? 'Completing Setup...' : 'Go to login'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
