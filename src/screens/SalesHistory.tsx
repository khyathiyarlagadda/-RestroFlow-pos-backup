import React, { useState, useEffect, useMemo } from 'react';
import { Search, Eye, Printer, Calendar, Receipt } from 'lucide-react';
import { storage } from '../utils/storage';
import type { SaleInvoice, OrderType, PaymentMethod } from '../types';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';


export const SalesHistory: React.FC = () => {
  const [sales, setSales] = useState<SaleInvoice[]>([]);
  const [settings, setSettings] = useState(storage.getSettings());

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | OrderType>('All');
  const [filterPayment, setFilterPayment] = useState<'All' | PaymentMethod>('All');
  const [filterDate, setFilterDate] = useState('');

  // Invoice Modal details
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    setSales(storage.getSales());
    setSettings(storage.getSettings());
  }, []);

  // Filtered sales listing
  const filteredSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => {
        const aTime = a?.dateTime ? new Date(a.dateTime).getTime() : 0;
        const bTime = b?.dateTime ? new Date(b.dateTime).getTime() : 0;
        return bTime - aTime;
      })
      .filter((sale) => {
        const tokenStr = sale?.tokenNo || '';
        const custStr = sale?.customerName || '';
        const dateStr = sale?.dateTime || '';

        const matchesSearch =
          tokenStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
          custStr.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesType = filterType === 'All' || sale?.orderType === filterType;
        const matchesPayment = filterPayment === 'All' || sale?.paymentMethod === filterPayment;
        
        const matchesDate = filterDate
          ? dateStr.startsWith(filterDate)
          : true;

        return matchesSearch && matchesType && matchesPayment && matchesDate;
      });
  }, [sales, searchQuery, filterType, filterPayment, filterDate]);

  const handleOpenInvoice = (invoice: SaleInvoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handlePrintReceipt = (invoice: SaleInvoice) => {
    // Renders custom layout window and triggers browser print
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
    setTimeout(() => {
      console.log("PRINT ORDER", invoice);
      window.print();
    }, 500);
  };

  return (
    <div className="page-container custom-scrollbar transition-all duration-[220ms] ease-in-out select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title sentence-case">
            Sales History
          </h1>
          <p className="page-subtitle mt-0.5 sentence-case">
            Review and reprint completed order invoices
          </p>
        </div>
      </div>

        {/* Filter Toolbar */}
        <div className="bg-bg-card border border-border p-4 rounded-card shadow-card flex flex-wrap gap-3 items-center justify-between mb-6 shrink-0 text-[13px]">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-hint" />
              <input
                type="text"
                placeholder="Search invoice or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8.5 w-full"
              />
            </div>

            {/* Date filter */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <Calendar className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full sm:w-36 font-mono text-[13px]"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="text-primary hover:underline font-medium text-[12px] sentence-case"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            {/* Order type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full sm:w-36"
            >
              <option value="All">All Types</option>
              <option value="Dine In">Dine In</option>
              <option value="Takeaway">Takeaway</option>
              <option value="Delivery">Delivery</option>
            </select>

            {/* Payment method */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value as any)}
              className="w-full sm:w-36"
            >
              <option value="All">All Payments</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
          </div>
        </div>

        {/* Sales Table */}
        {filteredSales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales records found"
            subtitle="Completed POS billing transactions will appear here."
          />
        ) : (
          <div className="bg-bg-card border border-border rounded-card shadow-card overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse custom-table">
                <thead>
                  <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted">
                    <th className="p-4 font-medium">Token Number</th>
                    <th className="p-4 font-medium">Date & Time</th>
                    <th className="p-4 font-medium">Customer</th>
                    <th className="p-4 font-medium">Order Type</th>
                    <th className="p-4 font-medium">Items</th>
                    <th className="p-4 font-medium text-right">Total</th>
                    <th className="p-4 font-medium">Payment</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredSales.map((sale, index) => (
                    <tr key={sale?.tokenNo || index} className="hover:bg-bg-page/20 transition-all duration-100">
                      {/* Token No */}
                      <td className="p-4 font-bold font-mono text-primary select-text">
                        Token #{(sale?.tokenNo || '').split('-').pop() || '—'}
                      </td>
                      {/* Date & Time */}
                      <td className="p-4 select-text">
                        {sale?.dateTime ? `${new Date(sale.dateTime).toLocaleDateString()} ${new Date(sale.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                      </td>
                      {/* Customer */}
                      <td className="p-4 font-medium text-text-primary select-text sentence-case">
                        {sale?.customerName || 'Walk-in Customer'}
                      </td>
                      {/* Order Type */}
                      <td className="p-4 sentence-case">
                        {sale?.orderType || '—'} {sale?.tableNo ? `(Table ${sale.tableNo})` : ''}
                      </td>
                      {/* Items */}
                      <td className="p-4 text-text-muted truncate max-w-xs sentence-case">
                        {sale?.items
                          ? sale.items.map((item) => `${item?.name || 'Item'} x${item?.quantity || 0}`).join(', ')
                          : '—'}
                      </td>
                      {/* Total */}
                      <td className="p-4 text-right font-mono font-bold text-primary">
                        ₹{(sale?.grandTotal || 0).toLocaleString('en-IN')}
                      </td>
                      {/* Payment */}
                      <td className="p-4">
                        <span className="text-[11px] font-medium text-text-muted bg-bg-page px-2 py-0.5 border border-border rounded-badge sentence-case">
                          {sale?.paymentMethod || '—'}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenInvoice(sale)}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-bg-page rounded-btn transition-all duration-150"
                            title="View Invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintReceipt(sale)}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-bg-page rounded-btn transition-all duration-150"
                            title="Print Receipt"
                          >
                            <Printer className="w-4 h-4" />
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

      {/* --- INVOICE VIEW MODAL --- */}
      <Modal
        isOpen={showInvoiceModal}
        onClose={() => {
          setShowInvoiceModal(false);
          setSelectedInvoice(null);
        }}
        title={`Token Number Details: ${selectedInvoice ? (selectedInvoice.tokenNo || '').split('-').pop() || '—' : ''}`}
        widthClass="max-w-[420px]"
      >
        {selectedInvoice && (
          <div className="flex flex-col gap-6">
            
            {/* The printable Thermal Slip representation */}
            <div className="border border-border p-5 bg-white font-mono text-[12px] text-black shadow-card flex flex-col gap-4 rounded-btn overflow-y-auto max-h-[340px] custom-scrollbar select-text print-area">
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
                  <span>Token Number: {(selectedInvoice.tokenNo || '').split('-').pop() || '—'}</span>
                  <span>Date: {selectedInvoice.dateTime ? new Date(selectedInvoice.dateTime).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type: {selectedInvoice.orderType || '—'} {selectedInvoice.tableNo ? `(Table ${selectedInvoice.tableNo})` : ''}</span>
                  <span>Time: {selectedInvoice.dateTime ? new Date(selectedInvoice.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                </div>
                {selectedInvoice.customerName && selectedInvoice.customerName !== 'Walk-in Customer' && (
                  <div className="text-left mt-0.5">
                    <span>Customer: {selectedInvoice.customerName}</span>
                  </div>
                )}
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
                {(selectedInvoice.items || []).map((item, itemIdx) => (
                  <div key={item?.id || itemIdx} className="flex justify-between items-start leading-tight">
                    <span className="w-1/2 text-left truncate sentence-case">
                      {item?.name || 'Item'} {item?.variationName ? `(${item.variationName})` : ''}
                    </span>
                    <span className="w-12 text-center">{item?.quantity || 0}</span>
                    <span className="w-16 text-right font-mono">₹{item?.price || 0}</span>
                    <span className="w-16 text-right font-mono">₹{(item?.price || 0) * (item?.quantity || 0)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black/50" />

              {/* Totals */}
              <div className="flex flex-col gap-1 text-[11px] items-end font-mono">
                <div className="flex justify-between w-full max-w-[200px]">
                  <span>Subtotal:</span>
                  <span>₹{(selectedInvoice.subtotal || 0).toFixed(2)}</span>
                </div>
                {settings.gstEnabled && (
                  <>
                    <div className="flex justify-between w-full max-w-[200px]">
                      <span>CGST ({settings.cgst}%):</span>
                      <span>₹{(selectedInvoice.cgst || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between w-full max-w-[200px]">
                      <span>SGST ({settings.sgst}%):</span>
                      <span>₹{(selectedInvoice.sgst || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
                {(selectedInvoice.containerCharge || 0) > 0 && (
                  <div className="flex justify-between w-full max-w-[200px]">
                    <span>Pkg Charge:</span>
                    <span>₹{(selectedInvoice.containerCharge || 0).toFixed(2)}</span>
                  </div>
                )}
                {(selectedInvoice.discount || 0) > 0 && (
                  <div className="flex justify-between w-full max-w-[200px] text-danger-custom">
                    <span>Discount:</span>
                    <span>-₹{(selectedInvoice.discount || 0).toFixed(2)}</span>
                  </div>
                )}
                {(selectedInvoice.tips || 0) > 0 && (
                  <div className="flex justify-between w-full max-w-[200px]">
                    <span>Tips:</span>
                    <span>₹{(selectedInvoice.tips || 0).toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice.roundOff !== 0 && (
                  <div className="flex justify-between w-full max-w-[200px] italic text-text-muted">
                    <span>Round off:</span>
                    <span>₹{(selectedInvoice.roundOff || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-black/30 w-full max-w-[200px] my-0.5" />
                <div className="flex justify-between w-full max-w-[200px] text-[13px] font-bold">
                  <span>Grand Total:</span>
                  <span>₹{(selectedInvoice.grandTotal || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-black/50" />

              {/* Payment Info */}
              <div className="text-left text-[11px]">
                <div>Payment Method: {selectedInvoice.paymentMethod || '—'}</div>
                {selectedInvoice.paymentMethod === 'Cash' && selectedInvoice.paymentDetails?.amountTendered && (
                  <>
                    <div>Tendered: ₹{selectedInvoice.paymentDetails.amountTendered}</div>
                    <div>Change Returned: ₹{selectedInvoice.paymentDetails.change}</div>
                  </>
                )}
                {selectedInvoice.paymentMethod === 'UPI' && selectedInvoice.paymentDetails?.upiRef && (
                  <div>UPI Ref: {selectedInvoice.paymentDetails.upiRef}</div>
                )}
                {selectedInvoice.paymentMethod === 'Card' && selectedInvoice.paymentDetails?.cardLast4 && (
                  <div>Card Ending: **** {selectedInvoice.paymentDetails.cardLast4}</div>
                )}
              </div>

              <div className="border-t border-dashed border-black/50" />

              <div className="text-center text-[11px] leading-tight">
                {settings.footerMessage}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  console.log("PRINT ORDER", selectedInvoice);
                  window.print();
                }}
                className="flex-1 h-[36px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-medium transition-colors duration-150"
              >
                Print Receipt
              </button>
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setSelectedInvoice(null);
                }}
                className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
              >
                Close
              </button>
            </div>

          </div>
        )}
      </Modal>
    </div>
  );
};
