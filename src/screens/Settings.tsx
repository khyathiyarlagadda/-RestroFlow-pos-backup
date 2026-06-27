import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { storage } from '../utils/storage';
import type { SystemSettings } from '../types';


export const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(storage.getSettings());
  const [isAdmin, setIsAdmin] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSettings(storage.getSettings());
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    setSettings(storage.getSettings());
    const auth = storage.getAuth();
    if (auth && (auth.role === 'Administrator' || auth.role === 'Restaurant Owner')) {
      setIsAdmin(true);
    }

    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  const handleToggleGST = () => {
    setSettings((prev) => ({
      ...prev,
      gstEnabled: !prev.gstEnabled
    }));
  };

  const handleToggleShowField = (field: keyof SystemSettings['showFields']) => {
    setSettings((prev) => ({
      ...prev,
      showFields: {
        ...prev.showFields,
        [field]: !prev.showFields[field]
      }
    }));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaveSuccess(false);

    if (!settings.restaurantName.trim()) {
      setError('Restaurant name is required');
      return;
    }

    if (settings.gstEnabled) {
      if (settings.cgst < 0 || settings.cgst > 14) {
        setError('CGST must be between 0% and 14%');
        return;
      }
      if (settings.sgst < 0 || settings.sgst > 14) {
        setError('SGST must be between 0% and 14%');
        return;
      }
    }

    storage.setSettings(settings);
    setSaveSuccess(true);

    setTimeout(() => {
      setSaveSuccess(false);
    }, 2500);
  };

  if (!isAdmin) {
    return (
      <div className="flex h-screen overflow-hidden bg-bg-page font-sans text-text-primary transition-all duration-[220ms] ease-in-out">
        <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-text-muted">
          <AlertTriangle className="w-12 h-12 text-warning mb-2" />
          <h2 className="text-[16px] font-medium sentence-case">Access Denied</h2>
          <p className="text-[14px] max-w-sm mt-1 sentence-case">
            Only restaurant administrators can modify system tax ratios, users or restaurant settings.
          </p>
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
            Settings
          </h1>
          <p className="page-subtitle mt-0.5 sentence-case">
            Configure GST rates, print options and invoice formatting
          </p>
        </div>
      </div>

        {/* Form */}
        <form onSubmit={handleSaveSettings} className="flex flex-col gap-6 max-w-3xl">
          
          {/* GST Configuration (Admin only) */}
          <div className="bg-bg-card border border-border p-6 rounded-card shadow-card flex flex-col gap-4">
            <h3 className="text-[15px] font-medium text-text-primary border-b border-border/60 pb-2.5 sentence-case">
              GST Configuration
            </h3>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[13px] text-text-primary font-medium">Enable Goods & Services Tax (GST)</span>
                <span className="text-[11px] text-text-muted">Apply tax rate to all sales invoices automatically</span>
              </div>
              <button
                type="button"
                onClick={handleToggleGST}
                className="text-text-muted hover:text-primary transition-colors duration-150"
              >
                <div
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ${
                    settings.gstEnabled ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-card transition-transform duration-200 ${
                      settings.gstEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>

            {settings.gstEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-[fadeIn_150ms_ease] mt-1">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cgst">CGST (%)</label>
                  <input
                    id="cgst"
                    type="number"
                    min={0}
                    max={14}
                    step={0.1}
                    value={settings.cgst || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        cgst: parseFloat(e.target.value) || 0
                      }))
                    }
                    className="font-mono text-[14px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sgst">SGST (%)</label>
                  <input
                    id="sgst"
                    type="number"
                    min={0}
                    max={14}
                    step={0.1}
                    value={settings.sgst || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        sgst: parseFloat(e.target.value) || 0
                      }))
                    }
                    className="font-mono text-[14px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="gstin">GSTIN (Registration No.)</label>
                  <input
                    id="gstin"
                    type="text"
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    value={settings.gstin || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        gstin: e.target.value.trim()
                      }))
                    }
                    className="font-mono text-[14px] uppercase"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Container Charge Configuration */}
          <div className="bg-bg-card border border-border p-6 rounded-card shadow-card flex flex-col gap-4">
            <h3 className="text-[15px] font-medium text-text-primary border-b border-border/60 pb-2.5 sentence-case">
              Container Charge Configuration
            </h3>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[13px] text-text-primary font-medium">Enable Container / Packing Charge</span>
                <span className="text-[11px] text-text-muted">Apply a default container charge to Takeaway and Delivery orders</span>
              </div>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    containerChargeEnabled: !prev.containerChargeEnabled
                  }))
                }
                className="text-text-muted hover:text-primary disabled:opacity-50 transition-colors duration-150"
              >
                <div
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ${
                    settings.containerChargeEnabled ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <div
                    className={`bg-white w-5 h-5 rounded-full shadow-card transition-transform duration-200 ${
                      settings.containerChargeEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
            </div>

            {settings.containerChargeEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-[fadeIn_150ms_ease] mt-1">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="defaultContainerCharge">Default Container Charge (₹)</label>
                  <input
                    id="defaultContainerCharge"
                    type="number"
                    min={0}
                    step={1}
                    disabled={!isAdmin}
                    value={settings.defaultContainerCharge || ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        defaultContainerCharge: Math.max(0, parseInt(e.target.value) || 0)
                      }))
                    }
                    className="font-mono text-[14px]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Restaurant details */}
          <div className="bg-bg-card border border-border p-6 rounded-card shadow-card flex flex-col gap-4">
            <h3 className="text-[15px] font-medium text-text-primary border-b border-border/60 pb-2.5 sentence-case">
              Restaurant Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="restName">Restaurant name *</label>
                <input
                  id="restName"
                  type="text"
                  value={settings.restaurantName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      restaurantName: e.target.value
                    }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="restPhone">Phone number</label>
                <input
                  id="restPhone"
                  type="text"
                  value={settings.phone}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      phone: e.target.value
                    }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="restEmail">Email address</label>
                <input
                  id="restEmail"
                  type="email"
                  value={settings.email}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      email: e.target.value
                    }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="restCurr">Currency symbol</label>
                <input
                  id="restCurr"
                  type="text"
                  value={settings.currency}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      currency: e.target.value
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="restAddr">Restaurant address</label>
              <textarea
                id="restAddr"
                value={settings.address}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    address: e.target.value
                  }))
                }
                className="h-20 py-2 resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="restFooter">Receipt footer message</label>
              <input
                id="restFooter"
                type="text"
                value={settings.footerMessage}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    footerMessage: e.target.value
                  }))
                }
              />
            </div>
          </div>

          {/* Receipt Print settings */}
          <div className="bg-bg-card border border-border p-6 rounded-card shadow-card flex flex-col gap-4">
            <h3 className="text-[15px] font-medium text-text-primary border-b border-border/60 pb-2.5 sentence-case">
              Receipt Print Configurations
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="printType">Default print layout</label>
                <select
                  id="printType"
                  value={settings.printType}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      printType: e.target.value as any
                    }))
                  }
                >
                  <option value="Thermal">Thermal (80mm Width)</option>
                  <option value="A4">A4 Invoice Paper</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="autoPrint">Auto-print on checkout</label>
                <select
                  id="autoPrint"
                  value={settings.autoPrint ? 'Yes' : 'No'}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      autoPrint: e.target.value === 'Yes'
                    }))
                  }
                >
                  <option value="Yes">Yes, trigger automatically</option>
                  <option value="No">No, show checkout prompt</option>
                </select>
              </div>
            </div>

            {/* Toggle show/hide fields */}
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[13px] text-text-muted font-medium mb-1 sentence-case">Receipt fields options:</span>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.showFields.gstinOnReceipt}
                    onChange={() => handleToggleShowField('gstinOnReceipt')}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span>Show GSTIN details</span>
                </label>
                <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.showFields.phoneOnReceipt}
                    onChange={() => handleToggleShowField('phoneOnReceipt')}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span>Show phone number</span>
                </label>
                <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.showFields.emailOnReceipt}
                    onChange={() => handleToggleShowField('emailOnReceipt')}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span>Show email address</span>
                </label>
                <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.showFields.footerOnReceipt}
                    onChange={() => handleToggleShowField('footerOnReceipt')}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span>Show thank you footer</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action triggers */}
          <div className="flex items-center gap-4">
            {error && (
              <span className="text-[13px] text-danger-custom font-medium sentence-case">
                {error}
              </span>
            )}
            {saveSuccess && (
              <span className="text-[13px] text-success font-medium sentence-case">
                Settings saved successfully!
              </span>
            )}
            <button
              type="submit"
              className="h-[40px] bg-primary hover:bg-primary-dark text-white rounded-btn px-6 text-[14px] font-medium flex items-center gap-2 ml-auto transition-colors duration-150 shadow-card"
            >
              <Save className="w-4 h-4" />
              Save Configurations
            </button>
          </div>

        </form>
    </div>
  );
};
