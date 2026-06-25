import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package, ArrowUp, ArrowDown } from 'lucide-react';
import { storage } from '../utils/storage';
import type { InventoryItem } from '../types';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';



export const Inventory: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Add/Edit Item modal
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState<'kg' | 'g' | 'L' | 'ml' | 'pcs' | 'dozen' | 'box'>('pcs');
  const [itemQty, setItemQty] = useState<number>(0);
  const [itemLowStock, setItemLowStock] = useState<number>(5);
  
  const [formError, setFormError] = useState('');

  // Delete Confirm modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  useEffect(() => {
    setInventory(storage.getInventory());
    const auth = storage.getAuth();
    if (auth && (auth.role === 'Administrator' || auth.role === 'Restaurant Owner')) {
      setIsAdmin(true);
    }
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setItemName('');
    setItemUnit('pcs');
    setItemQty(0);
    setItemLowStock(5);
    setFormError('');
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemUnit(item.unit);
    setItemQty(item.quantity);
    setItemLowStock(item.lowStockLevel);
    setFormError('');
    setShowAddEditModal(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!itemName.trim()) {
      setFormError('Item name is required');
      return;
    }

    const currentInv = [...inventory];
    const nameExists = currentInv.some(
      (item) =>
        item.name.toLowerCase() === itemName.trim().toLowerCase() &&
        item.id !== editingItem?.id
    );

    if (nameExists) {
      setFormError('Inventory item name already exists');
      return;
    }

    if (editingItem) {
      // Edit
      const updated = currentInv.map((item) => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            name: itemName.trim(),
            unit: itemUnit,
            quantity: itemQty,
            lowStockLevel: itemLowStock
          };
        }
        return item;
      });
      storage.setInventory(updated);
      setInventory(updated);
    } else {
      // Add
      const newItem: InventoryItem = {
        id: storage.generateId(),
        name: itemName.trim(),
        unit: itemUnit,
        quantity: itemQty,
        lowStockLevel: itemLowStock
      };
      const updated = [...currentInv, newItem];
      storage.setInventory(updated);
      setInventory(updated);
    }

    setShowAddEditModal(false);
    setEditingItem(null);
  };

  const handleQuickQtyUpdate = (itemId: string, amount: number) => {
    const updated = inventory.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: Math.max(0, item.quantity + amount)
        };
      }
      return item;
    });
    storage.setInventory(updated);
    setInventory(updated);
  };

  const handleOpenDelete = (item: InventoryItem) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      const updated = inventory.filter((item) => item.id !== itemToDelete.id);
      storage.setInventory(updated);
      setInventory(updated);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  // Helper status calculator
  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return { label: 'Out of stock', class: 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]' };
    if (item.quantity <= item.lowStockLevel) return { label: 'Low stock', class: 'bg-[#FEF9C3] text-[#854D0E] border-[#FDE047]' };
    return { label: 'In stock', class: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]' };
  };

  return (
    <div className="page-container custom-scrollbar transition-all duration-[220ms] ease-in-out select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title sentence-case">
            Inventory
          </h1>
          <p className="page-subtitle mt-0.5 sentence-case">
            Monitor and track ingredient raw stock values
          </p>
        </div>
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="h-[36px] bg-primary hover:bg-primary-dark text-white rounded-btn px-4 text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150 shadow-card"
            >
              <Plus className="w-4 h-4" />
              Add item
            </button>
          )}
        </div>

        {/* Inventory List or Empty State */}
        {inventory.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory items found"
            subtitle="Add items to start tracking stock thresholds and volumes."
            ctaText={isAdmin ? 'Add inventory item' : undefined}
            onCtaClick={isAdmin ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="bg-bg-card border border-border rounded-card shadow-card overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse custom-table">
                <thead>
                  <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted">
                    <th className="p-4 font-medium">Item name</th>
                    <th className="p-4 font-medium">Unit</th>
                    <th className="p-4 font-medium text-center">Current quantity</th>
                    <th className="p-4 font-medium text-center font-mono">Alert level</th>
                    <th className="p-4 font-medium">Status</th>
                    {isAdmin && <th className="p-4 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {inventory.map((item) => {
                    const status = getStockStatus(item);

                    return (
                      <tr key={item.id} className="hover:bg-bg-page/20 transition-all duration-100">
                        {/* Name */}
                        <td className="p-4 font-medium text-text-primary sentence-case">
                          {item.name}
                        </td>
                        {/* Unit */}
                        <td className="p-4 font-medium text-text-muted select-text">
                          {item.unit}
                        </td>
                        {/* Quantity with quick adjustments */}
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            {isAdmin && (
                              <button
                                onClick={() => handleQuickQtyUpdate(item.id, -1)}
                                className="w-[28px] h-[28px] border border-border hover:bg-bg-page rounded flex items-center justify-center text-text-muted"
                                title="Subtract 1"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span className="text-[14px] font-bold font-mono min-w-[32px] text-center">
                              {item.quantity}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => handleQuickQtyUpdate(item.id, 1)}
                                className="w-[28px] h-[28px] border border-border hover:bg-bg-page rounded flex items-center justify-center text-text-muted"
                                title="Add 1"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                        {/* Low stock alert level */}
                        <td className="p-4 text-center font-mono text-text-muted">
                          {item.lowStockLevel}
                        </td>
                        {/* Status badge */}
                        <td className="p-4">
                          <span className={`text-[11px] px-2 py-0.5 border rounded-badge font-semibold tracking-wide ${status.class}`}>
                            {status.label}
                          </span>
                        </td>
                        {/* Actions */}
                        {isAdmin && (
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1.5 text-text-muted hover:text-primary hover:bg-bg-page rounded-btn transition-all duration-150"
                                title="Edit Item"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenDelete(item)}
                                className="p-1.5 text-text-muted hover:text-danger-custom hover:bg-bg-page rounded-btn transition-all duration-150"
                                title="Delete Item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* --- ADD/EDIT ITEM MODAL --- */}
      <Modal
        isOpen={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        title={editingItem ? 'Edit inventory item' : 'Add inventory item'}
      >
        <form onSubmit={handleSaveItem} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invName">Item name *</label>
            <input
              id="invName"
              type="text"
              placeholder="e.g. Milk, Rice, Chicken"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className={formError && !itemName ? 'border-danger-custom' : ''}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="invUnit">Unit *</label>
            <select
              id="invUnit"
              value={itemUnit}
              onChange={(e) => setItemUnit(e.target.value as any)}
            >
              <option value="kg">kg (Kilograms)</option>
              <option value="g">g (Grams)</option>
              <option value="L">L (Liters)</option>
              <option value="ml">ml (Milliliters)</option>
              <option value="pcs">pcs (Pieces)</option>
              <option value="dozen">dozen (Dozens)</option>
              <option value="box">box (Boxes)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invQty">Quantity</label>
              <input
                id="invQty"
                type="number"
                value={itemQty || ''}
                onChange={(e) => setItemQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="invLow">Low stock level</label>
              <input
                id="invLow"
                type="number"
                value={itemLowStock || ''}
                onChange={(e) => setItemLowStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="font-mono"
              />
            </div>
          </div>

          {formError && (
            <span className="text-[13px] text-danger-custom font-medium mt-1 sentence-case">
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
              Save Item
            </button>
          </div>
        </form>
      </Modal>

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirm deletion"
      >
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-text-muted leading-relaxed sentence-case">
            Are you sure you want to delete the inventory item "{itemToDelete?.name}"? Stock monitoring for this ingredient will stop.
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
