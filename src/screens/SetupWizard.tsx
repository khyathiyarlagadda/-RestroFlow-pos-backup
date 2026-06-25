import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, CheckCircle2, ChevronRight, Store, UserPlus } from 'lucide-react';
import { storage, generateId } from '../utils/storage';
import type { User, SystemSettings } from '../types';


interface SetupWizardProps {
  onSetupComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onSetupComplete }) => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Step 1: Admin account
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step1Error, setStep1Error] = useState('');

  // Step 2: Restaurant Details
  const [restaurantName, setRestaurantName] = useState('RestroFlow POS');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [step2Error, setStep2Error] = useState('');

  const handleStep1Submit = (e: React.FormEvent) => {
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
    if (!password) {
      setStep1Error('Password is required');
      return;
    }
    if (password.length < 4) {
      setStep1Error('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setStep1Error('Passwords do not match');
      return;
    }

    // Username unique check
    const users = storage.getUsers();
    if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
      setStep1Error('Username already exists');
      return;
    }

    setStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep2Error('');

    if (!restaurantName.trim()) {
      setStep2Error('Restaurant name is required');
      return;
    }

    setStep(3);
  };

  const handleSkipStep2 = () => {
    setStep(3);
  };

  const handleCompleteSetup = () => {
    // 1. Save Admin User
    const adminUser: User = {
      id: generateId(),
      username: username.trim(),
      fullName: fullName.trim(),
      role: 'Administrator',
      createdDate: new Date().toISOString(),
      status: 'active'
    };

    // Store admin password in users metadata inside storage. We can expand storage to save password safely or in cleartext (local-only, no backend).
    // In our case, we can just save it inside user object (or user structure, but since it's local only, we can add a 'password' field locally to the storage record for authorization checks)
    const usersToSave = [{ ...adminUser, password }];
    storage.setUsers(usersToSave);

    // 2. Save Restaurant Settings
    const defaultSettings: SystemSettings = {
      cgst: 0,
      sgst: 0,
      gstEnabled: false,
      restaurantName: restaurantName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      currency: '₹',
      footerMessage: 'Thank you for dining with us!',
      printType: 'Thermal',
      autoPrint: true,
      containerChargeEnabled: false,
      defaultContainerCharge: 0,
      showFields: {
        gstinOnReceipt: false,
        phoneOnReceipt: !!phone.trim(),
        emailOnReceipt: !!email.trim(),
        footerOnReceipt: true
      }
    };
    storage.setSettings(defaultSettings);

    // Notify app shell that setup is complete
    onSetupComplete();

    // Redirect to login
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-6 select-none font-sans">
      <div className="bg-bg-card w-full max-w-[480px] rounded-[16px] shadow-popup border border-border p-10 flex flex-col gap-6">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="p-2.5 bg-primary/10 rounded-full text-primary shrink-0">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h2 className="text-[24px] font-bold tracking-[-0.5px] select-none">
            <span className="text-[#7B1E1E]">Restro</span>
            <span className="text-[#A52A2A]">Flow</span>
          </h2>
          <span className="text-[13px] font-medium text-[#9E9590] tracking-[0.5px] uppercase">Setup wizard</span>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between px-4">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold border-2 transition-colors duration-200 ${
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
                  className={`flex-1 h-[2px] mx-2 transition-colors duration-200 ${
                    step > s ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="border-b border-border my-1" />

        {/* Step Content */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="flex flex-col gap-5">
            <div className="flex items-center gap-2 text-primary">
              <UserPlus className="w-5 h-5" />
              <h3 className="section-heading">Create administrator account</h3>
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
              <label htmlFor="password" className="input-label-custom">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Minimum 4 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={step1Error && (!password || password.length < 4) ? 'border-danger-custom' : ''}
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
                className={step1Error && password !== confirmPassword ? 'border-danger-custom' : ''}
              />
            </div>

            {step1Error && (
              <span className="text-[13px] text-danger-custom font-semibold mt-1 sentence-case">
                {step1Error}
              </span>
            )}

            <button
              type="submit"
              className="w-full h-[42px] bg-primary text-white rounded-btn hover:bg-primary-dark font-semibold text-[14px] tracking-[0.2px] flex items-center justify-center gap-1.5 mt-2 transition-colors duration-150"
            >
              Continue to restaurant details
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="flex flex-col gap-5">
            <div className="flex items-center gap-2 text-primary">
              <Store className="w-5 h-5" />
              <h3 className="section-heading">Restaurant details</h3>
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
                className="h-20 py-2 resize-none"
              />
            </div>

            {step2Error && (
              <span className="text-[13px] text-danger-custom font-semibold mt-1 sentence-case">
                {step2Error}
              </span>
            )}

            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={handleSkipStep2}
                className="flex-1 h-[42px] border border-border text-text-primary rounded-btn hover:bg-bg-page font-semibold text-[14px] transition-colors duration-150"
              >
                Skip this step
              </button>
              <button
                type="submit"
                className="flex-1 h-[42px] bg-primary text-white rounded-btn hover:bg-primary-dark font-semibold text-[14px] flex items-center justify-center gap-1.5 transition-colors duration-150"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center text-center gap-5 animate-[scaleUp_250ms_ease]">
            <div className="p-4 bg-success/10 rounded-full text-success">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="empty-title-custom">System is ready!</h3>
              <p className="empty-subtitle-custom leading-relaxed">
                Administrator account and restaurant configuration have been set up successfully. You can now log in to the billing console.
              </p>
            </div>

            <div className="border-t border-border w-full pt-4 mt-2">
              <button
                onClick={handleCompleteSetup}
                className="w-full h-[42px] bg-primary text-white rounded-btn hover:bg-primary-dark font-semibold text-[14px] transition-colors duration-150"
              >
                Go to login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
