import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { storage } from '../utils/storage';
import type { Table } from '../types';
import { Modal } from '../components/Modal';



export const Tables: React.FC = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [heldCarts, setHeldCarts] = useState<any>({});

  // Table add/edit modal
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formError, setFormError] = useState('');

  // Table cart summary modal
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [selectedTableForSummary, setSelectedTableForSummary] = useState<Table | null>(null);

  // Table delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);

  useEffect(() => {
    const handleTablesUpdate = () => {
      setTables(storage.getTables());
    };
    window.addEventListener('tablesUpdated', handleTablesUpdate);

    setTables(storage.getTables());
    setHeldCarts(storage.getActiveCart());
    const auth = storage.getAuth();
    if (auth && (auth.role === 'Administrator' || auth.role === 'Restaurant Owner')) {
      setIsAdmin(true);
    }

    return () => {
      window.removeEventListener('tablesUpdated', handleTablesUpdate);
    };
  }, []);

  const handleOpenAdd = () => {
    setEditingTable(null);
    setTableNumber('');
    setFormError('');
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, table: Table) => {
    e.stopPropagation(); // prevent opening cart summary
    setEditingTable(table);
    setTableNumber(table.number);
    setFormError('');
    setShowAddEditModal(true);
  };

  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!tableNumber.trim()) {
      setFormError('Table number/name is required');
      return;
    }

    const currentTables = [...tables];

    // Unique table number check
    const numberExists = currentTables.some(
      (t) =>
        t.number.toLowerCase() === tableNumber.trim().toLowerCase() &&
        t.id !== editingTable?.id
    );

    if (numberExists) {
      setFormError('Table number already exists');
      return;
    }

    if (editingTable) {
      // Edit
      const updated = currentTables.map((t) => {
        if (t.id === editingTable.id) {
          return { ...t, number: tableNumber.trim() };
        }
        return t;
      });
      storage.setTables(updated);
      setTables(updated);
    } else {
      // Add
      const newTable: Table = {
        id: storage.generateId(),
        number: tableNumber.trim(),
        status: 'Available'
      };
      const updated = [...currentTables, newTable];
      storage.setTables(updated);
      setTables(updated);
    }

    setShowAddEditModal(false);
    setEditingTable(null);
    setTableNumber('');
  };

  const handleOpenDelete = (e: React.MouseEvent, table: Table) => {
    e.stopPropagation();
    setTableToDelete(table);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (tableToDelete) {
      const updated = tables.filter((t) => t.id !== tableToDelete.id);
      storage.setTables(updated);
      setTables(updated);

      // Clean up held cart if any
      const currentCarts = { ...heldCarts };
      delete currentCarts[tableToDelete.id];
      storage.setActiveCart(currentCarts);
      setHeldCarts(currentCarts);

      setShowDeleteConfirm(false);
      setTableToDelete(null);
    }
  };

  const handleTableClick = (table: Table) => {
    if (table.status === 'Available') {
      // Go to POS directly with table preselected
      // Since it's available, let's go to POS and set state there
      navigate('/pos');
    } else {
      // Show summary popup for Occupied/Billing Pending
      setSelectedTableForSummary(table);
      setShowSummaryModal(true);
    }
  };

  const handleResumeBilling = () => {
    if (selectedTableForSummary) {
      // Resume table order: navigate to POS. The POS component will read this table's cart automatically.
      navigate('/pos');
      setShowSummaryModal(false);
    }
  };

  const handleReleaseTable = () => {
    if (selectedTableForSummary) {
      const updatedTables = tables.map((t) => {
        if (t.id === selectedTableForSummary.id) {
          return { ...t, status: 'Available' as const };
        }
        return t;
      });
      storage.setTables(updatedTables);
      setTables(updatedTables);

      // Delete active cart
      const currentCarts = { ...heldCarts };
      delete currentCarts[selectedTableForSummary.id];
      storage.setActiveCart(currentCarts);
      setHeldCarts(currentCarts);

      setShowSummaryModal(false);
      setSelectedTableForSummary(null);
    }
  };

  const selectedTableCart = useMemo(() => {
    if (!selectedTableForSummary) return null;
    return heldCarts[selectedTableForSummary.id] || null;
  }, [selectedTableForSummary, heldCarts]);

  return (
    <div className="page-container custom-scrollbar transition-all duration-[220ms] ease-in-out select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title sentence-case">
            Tables
          </h1>
          <p className="page-subtitle mt-0.5 sentence-case">
            Monitor and manage restaurant dining table states
          </p>
        </div>
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="h-[36px] bg-primary hover:bg-primary-dark text-white rounded-btn px-4 text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 shadow-card"
            >
              <Plus className="w-4 h-4" />
              Add table
            </button>
          )}
        </div>

        {/* Visual Tables Layout */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {tables.map((table) => {
            let statusClass = '';
            let badgeBg = '';

            switch (table.status) {
              case 'Available':
                statusClass = 'border-[#86EFAC] hover:shadow-card hover:border-success';
                badgeBg = 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]';
                break;
              case 'Occupied':
                statusClass = 'border-[#FDE047] hover:shadow-card hover:border-warning';
                badgeBg = 'bg-[#FEF9C3] text-[#854D0E] border-[#FDE047]';
                break;
              case 'Billing Pending':
                statusClass = 'border-[#FCA5A5] hover:shadow-card hover:border-danger';
                badgeBg = 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]';
                break;
            }

            return (
              <div
                key={table.id}
                onClick={() => handleTableClick(table)}
                className={`w-[160px] h-[120px] bg-bg-card border-[2px] rounded-card p-3 flex flex-col justify-between items-center cursor-pointer transition-all duration-150 relative group ${statusClass}`}
              >
                {/* Admin controls hidden on card, visible on hover */}
                {isAdmin && (
                  <div className="absolute top-1.5 right-1.5 hidden group-hover:flex gap-1 bg-bg-card rounded shadow p-0.5 border border-border">
                    <button
                      onClick={(e) => handleOpenEdit(e, table)}
                      className="p-1 text-text-muted hover:text-primary rounded hover:bg-bg-page"
                      title="Rename Table"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleOpenDelete(e, table)}
                      className="p-1 text-text-muted hover:text-danger-custom rounded hover:bg-bg-page"
                      title="Remove Table"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-col items-center mt-2">
                  <span className="text-[12px] text-text-muted font-medium font-sans">Table</span>
                  <span className="text-[24px] font-medium text-text-primary leading-tight font-mono">
                    {table.number}
                  </span>
                </div>

                <span className={`text-[10px] px-2 py-0.5 border rounded-badge font-semibold tracking-wide ${badgeBg}`}>
                  {table.status}
                </span>
              </div>
            );
        })}
      </div>

      {/* --- ADD/EDIT TABLE MODAL --- */}
      <Modal
        isOpen={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        title={editingTable ? 'Rename table' : 'Add table'}
      >
        <form onSubmit={handleSaveTable} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tblNum">Table number or name</label>
            <input
              id="tblNum"
              type="text"
              placeholder="e.g. 6, Balcony-1"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className={formError ? 'border-danger-custom' : ''}
              autoComplete="off"
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
              onClick={() => setShowAddEditModal(false)}
              className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-[36px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-medium transition-colors duration-150"
            >
              Save Table
            </button>
          </div>
        </form>
      </Modal>

      {/* --- TABLE ORDER SUMMARY MODAL --- */}
      <Modal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title={`Table ${selectedTableForSummary?.number} Order Summary`}
        widthClass="max-w-[420px]"
      >
        {selectedTableForSummary && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center text-[13px] text-text-muted">
              <span>Status: {selectedTableForSummary.status}</span>
              {selectedTableCart && (
                <span>
                  Customer:{' '}
                  {selectedTableCart.customerId === 'walk-in'
                    ? 'Walk-in'
                    : storage.getCustomers().find((c) => c.id === selectedTableCart.customerId)?.name || 'Walk-in'}
                </span>
              )}
            </div>

            {selectedTableCart && selectedTableCart.items?.length > 0 ? (
              <>
                <div className="border border-border rounded-card divide-y divide-border overflow-hidden bg-bg-page/40 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {selectedTableCart.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between p-3 text-[13px] text-text-primary bg-bg-card">
                      <div className="min-w-0">
                        <span className="block font-medium truncate sentence-case">
                          {item.name} {item.variationName ? `(${item.variationName})` : ''}
                        </span>
                        <span className="text-[11px] text-text-muted font-mono">
                          ₹{item.price} x {item.quantity}
                        </span>
                      </div>
                      <span className="font-mono font-medium text-primary shrink-0">
                        ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center bg-primary/5 border border-primary/10 p-3 rounded-btn text-primary">
                  <span className="text-[13px] font-medium sentence-case">Estimated Subtotal</span>
                  <span className="text-[16px] font-bold font-mono">
                    ₹{selectedTableCart.items
                      .reduce((sum: number, item: any) => sum + item.price * item.quantity, 0)
                      .toLocaleString('en-IN')}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-text-hint text-[14px] sentence-case">
                No active items found on this table.
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-border mt-1">
              <button
                type="button"
                onClick={handleResumeBilling}
                className="w-full h-[38px] bg-primary text-white hover:bg-primary-dark rounded-btn text-[14px] font-medium transition-colors duration-150"
              >
                Resume Billing
              </button>
              <button
                type="button"
                onClick={handleReleaseTable}
                className="w-full h-[38px] border border-danger-custom text-danger-custom hover:bg-danger-custom/5 rounded-btn text-[14px] font-medium transition-colors duration-150"
              >
                Release Table (Clear order)
              </button>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="w-full text-center text-[13px] text-text-muted hover:underline py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirm deletion"
      >
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-text-muted leading-relaxed sentence-case">
            Are you sure you want to delete table "{tableToDelete?.number}"? Any active order associated with this table will be deleted.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 h-[36px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-medium transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="flex-1 h-[36px] border border-danger-custom text-danger-custom rounded-btn hover:bg-danger-custom/5 text-[14px] font-medium transition-colors duration-150"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
