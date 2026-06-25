import React, { useState, useEffect, useMemo } from 'react';
import { Users, Phone, Mail, Clock, Eye, ArrowLeft, Search, Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { storage } from '../utils/storage';
import type { Customer, SaleInvoice } from '../types';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';



export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [settings, setSettings] = useState(storage.getSettings());

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selected customer for detail view
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Receipt modal details (to preview invoices from customer logs)
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Customer profile form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formError, setFormError] = useState('');

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setFormCustomerId('');
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormError('');
    setShowFormModal(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setIsEditing(true);
    setFormCustomerId(c.id);
    setFormName(c.name);
    setFormPhone(c.phone || '');
    setFormEmail(c.email || '');
    setFormAddress(c.address || '');
    setFormError('');
    setShowFormModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Customer name is required');
      return;
    }

    if (isEditing) {
      const updated = customers.map((c) => {
        if (c.id === formCustomerId) {
          return {
            ...c,
            name: formName.trim(),
            phone: formPhone.trim() || undefined,
            email: formEmail.trim() || undefined,
            address: formAddress.trim() || undefined
          };
        }
        return c;
      });
      storage.setCustomers(updated);
      setCustomers(updated);

      // Update selectedCustomer in UI detail view if currently open
      if (selectedCustomer && selectedCustomer.id === formCustomerId) {
        const updatedSelf = updated.find((c) => c.id === formCustomerId);
        if (updatedSelf) {
          setSelectedCustomer(updatedSelf);
        }
      }
    } else {
      const newCustomer: Customer = {
        id: storage.generateId(),
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
        totalOrders: 0,
        totalSpent: 0
      };
      const updated = [...customers, newCustomer];
      storage.setCustomers(updated);
      setCustomers(updated);
    }

    setShowFormModal(false);
  };

  const handleDeleteCustomer = (customerId: string) => {
    if (confirm("Are you sure you want to delete this customer? This will not affect their past billing invoices.")) {
      const updated = customers.filter((c) => c.id !== customerId);
      storage.setCustomers(updated);
      setCustomers(updated);
      if (selectedCustomer && selectedCustomer.id === customerId) {
        setSelectedCustomer(null);
      }
    }
  };

  useEffect(() => {
    setCustomers(storage.getCustomers());
    setSales(storage.getSales());
    setSettings(storage.getSettings());
  }, []);

  // Filtered customer listing
  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery)) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [customers, searchQuery]);

  // Customer Invoices list
  const customerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return [...sales]
      .filter((s) => s.customerId === selectedCustomer.id)
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [selectedCustomer, sales]);

  const handleOpenInvoice = (invoice: SaleInvoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  return (
    <div className="page-container custom-scrollbar transition-all duration-[220ms] ease-in-out select-none">
        
        {/* Customer Detail View Mode */}
        {selectedCustomer ? (
          <div className="animate-[fadeIn_150ms_ease]">
            {/* Back header */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 border border-border text-text-muted hover:text-text-primary rounded-btn hover:bg-bg-card transition-colors duration-150"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="page-title sentence-case">
                  Customer Profile
                </h1>
                <p className="page-subtitle mt-0.5 sentence-case">
                  Billing history for {selectedCustomer.name}
                </p>
              </div>
            </div>

            {/* Layout Grid: Details Left, Billing History Right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Profile card (Left column) */}
              <div className="bg-bg-card border border-border p-6 rounded-card shadow-card flex flex-col gap-5 h-fit">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[24px] font-bold mb-3 select-none">
                    {selectedCustomer.name.substring(0, 2).toUpperCase()}
                  </div>
                  <h3 className="text-[16px] font-medium text-text-primary sentence-case">
                    {selectedCustomer.name}
                  </h3>
                </div>

                <div className="border-b border-border/80 my-1" />

                 {/* Details list */}
                <div className="flex flex-col gap-3 text-[13px]">
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2 text-text-primary select-text">
                      <Phone className="w-4 h-4 text-text-muted shrink-0" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-2 text-text-primary select-text truncate">
                      <Mail className="w-4 h-4 text-text-muted shrink-0" />
                      <span>{selectedCustomer.email}</span>
                    </div>
                  )}
                  {selectedCustomer.address && (
                    <div className="flex items-center gap-2 text-text-primary select-text">
                      <MapPin className="w-4 h-4 text-text-muted shrink-0" />
                      <span>{selectedCustomer.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-text-muted">
                    <Clock className="w-4 h-4 text-text-hint shrink-0" />
                    <span>
                      Last visit:{' '}
                      {selectedCustomer.lastVisit
                        ? new Date(selectedCustomer.lastVisit).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                </div>

                <div className="border-b border-border/80 my-1" />

                {/* Stats summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bg-page/40 border border-border p-3 rounded-btn text-center">
                    <span className="text-[11px] text-text-muted block sentence-case">Total Orders</span>
                    <span className="text-[16px] font-bold font-mono text-text-primary block mt-0.5">
                      {selectedCustomer.totalOrders}
                    </span>
                  </div>
                  <div className="bg-bg-page/40 border border-border p-3 rounded-btn text-center">
                    <span className="text-[11px] text-text-muted block sentence-case">Total Spent</span>
                    <span className="text-[16px] font-bold font-mono text-primary block mt-0.5">
                      ₹{selectedCustomer.totalSpent.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="border-b border-border/80 my-1" />

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenEditModal(selectedCustomer)}
                    className="flex-1 h-[34px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[13px] font-semibold transition-colors duration-150 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                    className="flex-1 h-[34px] border border-danger-custom/25 text-danger-custom rounded-btn hover:bg-danger/5 text-[13px] font-semibold transition-colors duration-150 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>

              {/* Order History (Right column, 2/3 width) */}
              <div className="lg:col-span-2 bg-bg-card border border-border rounded-card p-6 shadow-card flex flex-col min-h-[300px]">
                <h3 className="text-[15px] font-medium text-text-primary mb-4 sentence-case">
                  Billing History
                </h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {customerInvoices.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-text-hint text-[14px] italic sentence-case">
                      No orders recorded for this customer yet.
                    </div>
                  ) : (
                    <table className="w-full text-left text-[13px] border-collapse">
                      <thead>
                        <tr className="text-text-muted border-b border-border/80 pb-2">
                          <th className="font-medium pb-2">Token Number</th>
                          <th className="font-medium pb-2">Date & Time</th>
                          <th className="font-medium pb-2">Order Type</th>
                          <th className="font-medium pb-2 text-right">Total</th>
                          <th className="font-medium pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {customerInvoices.map((inv) => (
                          <tr key={inv.tokenNo} className="hover:bg-bg-page/50">
                            <td className="py-2.5 font-bold font-mono text-primary">Token #{inv.tokenNo.split('-').pop()}</td>
                            <td className="py-2.5">
                              {new Date(inv.dateTime).toLocaleDateString()} {new Date(inv.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2.5 sentence-case">{inv.orderType}</td>
                            <td className="py-2.5 text-right font-mono font-medium">₹{inv.grandTotal}</td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => handleOpenInvoice(inv)}
                                className="p-1.5 text-text-muted hover:text-primary hover:bg-bg-page rounded-btn transition-colors duration-150"
                                title="View Receipt"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          </div>
        ) : (
          // ================= CUSTOMERS LIST TABLE VIEW =================
          <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h1 className="page-title sentence-case">
                  Customers
                </h1>
                <p className="page-subtitle mt-0.5 sentence-case">
                  View billing summaries and history logs
                </p>
              </div>
              <button
                onClick={handleOpenAddModal}
                className="btn-custom bg-primary hover:bg-primary-dark text-white rounded-btn transition-colors duration-150 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Customer
              </button>
            </div>

            {/* Filter toolbar */}
            <div className="bg-bg-card border border-border p-4 rounded-card shadow-card flex gap-3 items-center justify-between mb-6 shrink-0">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-hint" />
                <input
                  type="text"
                  placeholder="Search by name, phone or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8.5 w-full text-[13px]"
                />
              </div>
            </div>

            {/* Customers table */}
            {filteredCustomers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No customers found"
                subtitle="Customer profiles are automatically created when details are entered during POS billing checkout."
              />
            ) : (
              <div className="bg-bg-card border border-border rounded-card shadow-card overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse custom-table">
                    <thead>
                      <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted">
                        <th className="p-4 font-medium">Customer name</th>
                        <th className="p-4 font-medium">Phone number</th>
                        <th className="p-4 font-medium">Email address</th>
                        <th className="p-4 font-medium">Address</th>
                        <th className="p-4 font-medium text-center">Orders</th>
                        <th className="p-4 font-medium text-right font-mono">Total spent</th>
                        <th className="p-4 font-medium text-right">Last visit</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredCustomers.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => setSelectedCustomer(c)}
                          className="hover:bg-bg-page/20 transition-all duration-100 cursor-pointer"
                        >
                          <td className="p-4 font-medium text-text-primary sentence-case">{c.name}</td>
                          <td className="p-4 text-text-muted select-text">{c.phone || '—'}</td>
                          <td className="p-4 text-text-muted select-text truncate max-w-xs">{c.email || '—'}</td>
                          <td className="p-4 text-text-muted select-text truncate max-w-xs">{c.address || '—'}</td>
                          <td className="p-4 text-center font-mono font-medium">{c.totalOrders}</td>
                          <td className="p-4 text-right font-mono font-medium text-primary">
                            ₹{c.totalSpent.toLocaleString('en-IN')}
                          </td>
                          <td className="p-4 text-right text-text-muted">
                            {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditModal(c)}
                                className="p-1.5 text-text-muted hover:text-primary hover:bg-bg-page rounded-btn transition-all duration-150 cursor-pointer"
                                title="Edit Profile"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCustomer(c.id)}
                                className="p-1.5 text-text-muted hover:text-danger hover:bg-bg-page rounded-btn transition-all duration-150 cursor-pointer"
                                title="Delete Profile"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      {/* --- INVOICE VIEW MODAL --- */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setSelectedInvoice(null);
        }}
        title={`Token Number: ${selectedInvoice ? selectedInvoice.tokenNo.split('-').pop() : ''}`}
        widthClass="max-w-[420px]"
      >
        {selectedInvoice && (
          <div className="flex flex-col gap-6">
            
            {/* The Thermal slip representation */}
            <div className="border border-border p-5 bg-white font-mono text-[12px] text-black shadow-card flex flex-col gap-4 rounded-btn overflow-y-auto max-h-[300px] custom-scrollbar select-text print-area">
              {/* Header */}
              <div className="text-center flex flex-col gap-1">
                <span className="text-[15px] font-bold">{settings.restaurantName}</span>
                {settings.address && <span className="text-[11px] leading-tight">{settings.address}</span>}
                {settings.phone && <span className="text-[11px]">Phone: {settings.phone}</span>}
                {settings.gstEnabled && settings.gstin && <span className="text-[11px]">GSTIN: {settings.gstin}</span>}
              </div>

              <div className="border-t border-dashed border-black/50" />

              {/* Meta */}
              <div className="flex flex-col gap-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>Token Number: {selectedInvoice.tokenNo.split('-').pop()}</span>
                  <span>Date: {new Date(selectedInvoice.dateTime).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type: {selectedInvoice.orderType} {selectedInvoice.tableNo ? `(Table ${selectedInvoice.tableNo})` : ''}</span>
                  <span>Time: {new Date(selectedInvoice.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-black/50" />

              {/* Items Table */}
              <div className="flex flex-col gap-1 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span className="w-1/2 text-left">Item</span>
                  <span className="w-12 text-center">Qty</span>
                  <span className="w-16 text-right">Price</span>
                  <span className="w-16 text-right">Total</span>
                </div>
                <div className="border-t border-dashed border-black/30" />
                {selectedInvoice.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start leading-tight">
                    <span className="w-1/2 text-left truncate sentence-case">
                      {item.name} {item.variationName ? `(${item.variationName})` : ''}
                    </span>
                    <span className="w-12 text-center">{item.quantity}</span>
                    <span className="w-16 text-right font-mono">₹{item.price}</span>
                    <span className="w-16 text-right font-mono">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black/50" />

              {/* Totals */}
              <div className="flex flex-col gap-1 text-[11px] items-end font-mono">
                <div className="flex justify-between w-full max-w-[200px]">
                  <span>Subtotal:</span>
                  <span>₹{selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                {settings.gstEnabled && (
                  <>
                    <div className="flex justify-between w-full max-w-[200px]">
                      <span>CGST ({settings.cgst}%):</span>
                      <span>₹{selectedInvoice.cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between w-full max-w-[200px]">
                      <span>SGST ({settings.sgst}%):</span>
                      <span>₹{selectedInvoice.sgst.toFixed(2)}</span>
                    </div>
                  </>
                )}
                {selectedInvoice.containerCharge > 0 && (
                  <div className="flex justify-between w-full max-w-[200px]">
                    <span>Pkg Charge:</span>
                    <span>₹{selectedInvoice.containerCharge.toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between w-full max-w-[200px] text-danger-custom">
                    <span>Discount:</span>
                    <span>-₹{selectedInvoice.discount.toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice.tips > 0 && (
                  <div className="flex justify-between w-full max-w-[200px]">
                    <span>Tips:</span>
                    <span>₹{selectedInvoice.tips.toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice.roundOff !== 0 && (
                  <div className="flex justify-between w-full max-w-[200px] italic text-text-muted">
                    <span>Round off:</span>
                    <span>₹{selectedInvoice.roundOff.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-black/30 w-full max-w-[200px] my-0.5" />
                <div className="flex justify-between w-full max-w-[200px] text-[13px] font-bold">
                  <span>Grand Total:</span>
                  <span>₹{selectedInvoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-black/50" />

              {/* Payment Details */}
              <div className="text-left text-[11px]">
                <div>Payment Method: {selectedInvoice.paymentMethod}</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="w-full h-[36px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-medium transition-colors duration-150"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- ADD / EDIT CUSTOMER FORM MODAL --- */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={isEditing ? 'Edit Customer Profile' : 'Add New Customer'}
        widthClass="max-w-[420px]"
      >
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="formName" className="input-label-custom">Customer Name</label>
            <input
              id="formName"
              type="text"
              placeholder="e.g. Rachel Green"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className={formError && !formName ? 'border-danger-custom' : ''}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="formPhone" className="input-label-custom">Phone Number</label>
            <input
              id="formPhone"
              type="text"
              placeholder="e.g. 9876543210"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="formEmail" className="input-label-custom">Email Address (optional)</label>
            <input
              id="formEmail"
              type="email"
              placeholder="e.g. rachel@centralperk.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="formAddress" className="input-label-custom">Address (optional)</label>
            <input
              id="formAddress"
              type="text"
              placeholder="e.g. Apartment 20, 90 Bedford St"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
            />
          </div>

          {formError && (
            <span className="text-[13px] text-danger-custom font-medium sentence-case">
              {formError}
            </span>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-[36px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-medium transition-colors duration-150 cursor-pointer"
            >
              Save Profile
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
