import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Image as ImageIcon, ToggleLeft, ToggleRight, BookOpen } from 'lucide-react';
import { storage } from '../utils/storage';
import type { Category, MenuItem, Variation } from '../types';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';


export const MenuManagement: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('all'); // all | available | unavailable

  // Modal form states
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemBasePrice, setItemBasePrice] = useState<number>(0);
  const [itemImage, setItemImage] = useState('');
  const [itemAvailable, setItemAvailable] = useState(true);
  
  // Variations form state
  const [enableVariations, setEnableVariations] = useState(false);
  const [variationsList, setVariationsList] = useState<Variation[]>([]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarPrice, setNewVarPrice] = useState<string>('');
  const [showInlineVarAdd, setShowInlineVarAdd] = useState(false);

  const [formError, setFormError] = useState('');

  // Delete Confirmation Modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  // Category management states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState<'add' | 'edit'>('add');
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catEnabled, setCatEnabled] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [showCategoryDeleteConfirm, setShowCategoryDeleteConfirm] = useState(false);

  const affectedItemsCount = useMemo(() => {
    if (filterCategory === 'all') return 0;
    return menuItems.filter((item) => item.categoryId === filterCategory).length;
  }, [menuItems, filterCategory]);

  useEffect(() => {
    setMenuItems(storage.getMenuItems());
    setCategories(storage.getCategories());
    const auth = storage.getAuth();
    if (auth && (auth.role === 'Administrator' || auth.role === 'Restaurant Owner')) {
      setIsAdmin(true);
    }

    const handleCatsUpdate = () => {
      setCategories(storage.getCategories());
    };
    const handleMenuUpdate = () => {
      setMenuItems(storage.getMenuItems());
    };

    window.addEventListener('categoriesUpdated', handleCatsUpdate);
    window.addEventListener('menuUpdated', handleMenuUpdate);

    return () => {
      window.removeEventListener('categoriesUpdated', handleCatsUpdate);
      window.removeEventListener('menuUpdated', handleMenuUpdate);
    };
  }, []);

  // Compute category map for badges
  const categoryMap = useMemo(() => {
    const map: { [key: string]: string } = {};
    categories.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  // Filtered listing
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory = filterCategory === 'all' || item.categoryId === filterCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAvailability =
        filterAvailability === 'all' ||
        (filterAvailability === 'available' && item.available) ||
        (filterAvailability === 'unavailable' && !item.available);
      return matchesCategory && matchesSearch && matchesAvailability;
    });
  }, [menuItems, filterCategory, searchQuery, filterAvailability]);

  // Image Upload helper
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setItemImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategory(categories[0]?.id || '');
    setItemDescription('');
    setItemBasePrice(0);
    setItemImage('');
    setItemAvailable(true);
    setEnableVariations(false);
    setVariationsList([]);
    setFormError('');
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategory(item.categoryId);
    setItemDescription(item.description || '');
    setItemBasePrice(item.basePrice);
    setItemImage(item.image || '');
    setItemAvailable(item.available);
    setEnableVariations(item.hasVariations);
    setVariationsList(item.variations || []);
    setFormError('');
    setShowAddEditModal(true);
  };

  const handleToggleAvailable = (item: MenuItem) => {
    const updated = menuItems.map((m) => {
      if (m.id === item.id) {
        return { ...m, available: !m.available };
      }
      return m;
    });
    storage.setMenuItems(updated);
    setMenuItems(updated);
  };

  // Add Variation Inline
  const handleAddVariationInline = () => {
    if (!newVarName.trim()) return;
    const priceVal = parseFloat(newVarPrice) || 0;
    if (priceVal <= 0) return;

    setVariationsList([...variationsList, { name: newVarName.trim(), price: priceVal }]);
    setNewVarName('');
    setNewVarPrice('');
    setShowInlineVarAdd(false);
  };

  const handleDeleteVariation = (idx: number) => {
    setVariationsList(variationsList.filter((_, i) => i !== idx));
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!itemName.trim()) {
      setFormError('Item name is required');
      return;
    }
    if (!itemCategory) {
      setFormError('Category is required');
      return;
    }

    if (enableVariations) {
      if (variationsList.length === 0) {
        setFormError('At least 1 variation is required when variations are enabled.');
        return;
      }
    } else {
      if (itemBasePrice <= 0) {
        setFormError('Base price must be greater than 0');
        return;
      }
    }

    const currentItems = [...menuItems];

    if (editingItem) {
      // Edit
      const updated = currentItems.map((m) => {
        if (m.id === editingItem.id) {
          // If Owner role, they can only edit price, toggle availability, description, image
          if (isAdmin) {
            return {
              ...m,
              name: itemName.trim(),
              categoryId: itemCategory,
              description: itemDescription.trim(),
              basePrice: enableVariations ? 0 : itemBasePrice,
              image: itemImage,
              available: itemAvailable,
              hasVariations: enableVariations,
              variations: enableVariations ? variationsList : []
            };
          } else {
            // Owner editing subset of fields
            return {
              ...m,
              description: itemDescription.trim(),
              basePrice: enableVariations ? 0 : itemBasePrice,
              image: itemImage,
              available: itemAvailable,
              variations: enableVariations ? variationsList : []
            };
          }
        }
        return m;
      });
      storage.setMenuItems(updated);
      setMenuItems(updated);
    } else {
      // Create (Admin only)
      if (!isAdmin) {
        setFormError('Only administrators can add new items');
        return;
      }

      const newItem: MenuItem = {
        id: storage.generateId(),
        name: itemName.trim(),
        categoryId: itemCategory,
        description: itemDescription.trim() || undefined,
        basePrice: enableVariations ? 0 : itemBasePrice,
        image: itemImage || undefined,
        available: itemAvailable,
        hasVariations: enableVariations,
        variations: enableVariations ? variationsList : []
      };

      const updated = [...currentItems, newItem];
      storage.setMenuItems(updated);
      setMenuItems(updated);
    }

    setShowAddEditModal(false);
    setEditingItem(null);
  };

  const handleOpenDelete = (item: MenuItem) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      const updated = menuItems.filter((m) => m.id !== itemToDelete.id);
      storage.setMenuItems(updated);
      setMenuItems(updated);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  const handleOpenAddCategory = () => {
    setCategoryModalMode('add');
    setCatName('');
    setCatDescription('');
    setCatEnabled(true);
    setCategoryError('');
    setShowCategoryModal(true);
  };

  const handleOpenEditCategory = () => {
    const selectedCat = categories.find((c) => c.id === filterCategory);
    if (!selectedCat) return;

    setCategoryModalMode('edit');
    setCatName(selectedCat.name);
    setCatDescription(selectedCat.description || '');
    setCatEnabled(selectedCat.enabled);
    setCategoryError('');
    setShowCategoryModal(true);
  };

  const handleOpenDeleteCategory = () => {
    setShowCategoryDeleteConfirm(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError('');

    if (!catName.trim()) {
      setCategoryError('Category name is required');
      return;
    }

    const currentCats = [...categories];

    // Uniqueness check (case-insensitive)
    const nameExists = currentCats.some(
      (c) =>
        c.name.toLowerCase() === catName.trim().toLowerCase() &&
        (categoryModalMode === 'add' || c.id !== filterCategory)
    );

    if (nameExists) {
      setCategoryError('Category name already exists');
      return;
    }

    if (categoryModalMode === 'edit') {
      const updated = currentCats.map((c) => {
        if (c.id === filterCategory) {
          return {
            ...c,
            name: catName.trim(),
            description: catDescription.trim(),
            enabled: catEnabled
          };
        }
        return c;
      });
      storage.setCategories(updated);
      setCategories(updated);
    } else {
      const maxSortOrder = currentCats.length > 0 ? Math.max(...currentCats.map((c) => c.sortOrder)) : -1;
      const newCat: Category = {
        id: storage.generateId(),
        name: catName.trim(),
        description: catDescription.trim(),
        enabled: catEnabled,
        createdAt: new Date().toISOString(),
        sortOrder: maxSortOrder + 1
      };
      const updated = [...currentCats, newCat];
      storage.setCategories(updated);
      setCategories(updated);
    }

    setShowCategoryModal(false);
  };

  const handleDeleteCategoryConfirm = () => {
    if (filterCategory === 'all') return;

    // Remove category
    const updatedCats = categories.filter((c) => c.id !== filterCategory);
    storage.setCategories(updatedCats);
    setCategories(updatedCats);

    // Reset categoryId on affected menu items
    const updatedItems = menuItems.map((item) => {
      if (item.categoryId === filterCategory) {
        return { ...item, categoryId: '' };
      }
      return item;
    });
    storage.setMenuItems(updatedItems);
    setMenuItems(updatedItems);

    setFilterCategory('all');
    setShowCategoryDeleteConfirm(false);
  };

  return (
    <div className="page-container custom-scrollbar transition-all duration-[220ms] ease-in-out select-none">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="page-title sentence-case">
            Menu Items
          </h1>
          <p className="page-subtitle mt-0.5 sentence-case">
            Configure dishes, variations and availability
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddCategory}
              className="btn-custom border border-primary text-primary hover:bg-primary/5 rounded-btn px-4 flex items-center gap-1.5 transition-colors duration-150 shadow-card"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
            <button
              onClick={handleOpenAdd}
              className="btn-custom bg-primary hover:bg-primary-dark text-white rounded-btn px-4 flex items-center gap-1.5 transition-colors duration-150 shadow-card"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        )}
      </div>

        {/* Filter bar */}
        <div className="bg-bg-card border border-border p-4 rounded-card shadow-card flex flex-col md:flex-row gap-3 items-center justify-between mb-6 shrink-0">
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            {/* Search */}
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-60"
            />
            {/* Category dropdown & Controls */}
            <div className="flex items-center gap-1.5 w-full md:w-auto">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full md:w-44"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {!c.enabled ? '(disabled)' : ''}
                  </option>
                ))}
              </select>
              {isAdmin && filterCategory !== 'all' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleOpenEditCategory}
                    className="p-2 text-text-muted hover:text-primary hover:bg-bg-page rounded-btn transition-all duration-150 border border-border bg-bg-card"
                    title="Edit Selected Category"
                    type="button"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleOpenDeleteCategory}
                    className="p-2 text-text-muted hover:text-danger-custom hover:bg-bg-page rounded-btn transition-all duration-150 border border-border bg-bg-card"
                    title="Delete Selected Category"
                    type="button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {/* Availability */}
            <select
              value={filterAvailability}
              onChange={(e) => setFilterAvailability(e.target.value)}
              className="w-full md:w-40"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        {/* Menu Items Table */}
        {filteredItems.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No menu items found"
            subtitle="Get started by creating categories and adding your first menu item."
            ctaText={isAdmin ? 'Add menu item' : undefined}
            onCtaClick={isAdmin ? handleOpenAdd : undefined}
          />
        ) : (
          <div className="bg-bg-card border border-border rounded-card shadow-card overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse custom-table">
                <thead>
                  <tr className="bg-bg-page/50 border-b border-border/80 text-text-muted">
                    <th className="w-20 p-4 font-medium">Image</th>
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Category</th>
                    <th className="p-4 font-medium">Price</th>
                    <th className="p-4 font-medium">Available</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-bg-page/20 transition-all duration-100">
                      {/* Image */}
                      <td className="p-4">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded-btn border border-border bg-[#F0EAE4]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-btn border border-border bg-[#F0EAE4] flex items-center justify-center text-text-hint">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                      {/* Name */}
                      <td className="p-4 font-medium text-text-primary sentence-case">
                        {item.name}
                        {item.description && (
                          <span className="block text-[11px] font-normal text-text-muted mt-0.5 line-clamp-1 sentence-case max-w-xs">
                            {item.description}
                          </span>
                        )}
                      </td>
                      {/* Category */}
                      <td className="p-4">
                        <span className="text-[11px] font-medium text-text-muted bg-bg-page px-2 py-0.5 border border-border rounded-badge sentence-case">
                          {categoryMap[item.categoryId] || 'Uncategorized'}
                          {categories.find((c) => c.id === item.categoryId)?.enabled === false && ' (disabled)'}
                        </span>
                      </td>
                      {/* Price */}
                      <td className="p-4 font-mono font-medium text-primary">
                        {item.hasVariations ? (
                          <span className="text-[12px] bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-badge">
                            Variations (₹{Math.min(...item.variations.map((v) => v.price))}+)
                          </span>
                        ) : (
                          `₹${item.basePrice}`
                        )}
                      </td>
                      {/* Availability toggle */}
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleAvailable(item)}
                          className="text-text-muted hover:text-primary transition-colors duration-150"
                        >
                          {item.available ? (
                            <ToggleRight className="w-8 h-8 text-primary" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-text-hint" />
                          )}
                        </button>
                      </td>
                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-bg-page rounded-btn transition-all duration-150"
                            title="Edit Item"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenDelete(item)}
                              className="p-1.5 text-text-muted hover:text-danger-custom hover:bg-bg-page rounded-btn transition-all duration-150"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* --- ADD/EDIT MENU ITEM DRAWER/MODAL (600px wide) --- */}
      <Modal
        isOpen={showAddEditModal}
        onClose={() => setShowAddEditModal(false)}
        title={editingItem ? 'Edit menu item' : 'Add menu item'}
        widthClass="max-w-[600px]"
      >
        <form onSubmit={handleSaveItem} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Item Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="itemName">Item name *</label>
              <input
                id="itemName"
                type="text"
                placeholder="e.g. Garlic Naan"
                value={itemName}
                disabled={!isAdmin && !!editingItem}
                onChange={(e) => setItemName(e.target.value)}
                className={formError && !itemName ? 'border-danger-custom' : ''}
                autoComplete="off"
              />
            </div>

            {/* Category dropdown */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="itemCat" className="input-label-custom">Category *</label>
              <select
                id="itemCat"
                value={itemCategory}
                disabled={!isAdmin && !!editingItem}
                onChange={(e) => setItemCategory(e.target.value)}
                className="w-full"
              >
                <option value="">Choose category...</option>
                {categories
                  .filter((c) => c.enabled !== false || c.id === itemCategory)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {!c.enabled ? '(disabled)' : ''}
                    </option>
                  ))}
                {itemCategory && !categories.some((c) => c.id === itemCategory) && (
                  <option value={itemCategory}>Uncategorized</option>
                )}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="itemDesc">Description</label>
            <textarea
              id="itemDesc"
              placeholder="Brief description of the item"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              className="h-16 py-2 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 items-start">
            {/* Image Selection */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-text-muted font-medium">Item image</span>
              <div className="flex items-center gap-3">
                {itemImage ? (
                  <img
                    src={itemImage}
                    alt="Preview"
                    className="w-14 h-14 object-cover rounded-btn border border-border bg-[#F0EAE4]"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-btn border border-border bg-[#F0EAE4] flex items-center justify-center text-text-hint">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <label className="h-[36px] border border-border hover:bg-bg-page text-text-primary px-3 rounded-btn text-[13px] font-medium flex items-center justify-center cursor-pointer transition-colors duration-150">
                  Choose image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Availability */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-text-muted font-medium">Availability</span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setItemAvailable(!itemAvailable)}
                  className="text-text-muted hover:text-primary transition-colors duration-150"
                >
                  {itemAvailable ? (
                    <ToggleRight className="w-8 h-8 text-primary" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-text-hint" />
                  )}
                </button>
                <span className="text-[13px] font-medium text-text-primary">
                  {itemAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-border/80 my-2 pt-4">
            {/* Enable Variations Toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-[13px] text-text-primary font-medium">Enable Variations</span>
                <span className="text-[11px] text-text-muted">Item sizes or portion options</span>
              </div>
              <button
                type="button"
                disabled={!isAdmin && !!editingItem}
                onClick={() => setEnableVariations(!enableVariations)}
                className="text-text-muted hover:text-primary disabled:opacity-50 transition-colors duration-150"
              >
                {enableVariations ? (
                  <ToggleRight className="w-8 h-8 text-primary" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-text-hint" />
                )}
              </button>
            </div>

            {/* Base Price (Only when variations OFF) */}
            {!enableVariations ? (
              <div className="flex flex-col gap-1.5 max-w-[240px] animate-[fadeIn_150ms_ease]">
                <label htmlFor="basePrice">Base Price (₹) *</label>
                <input
                  id="basePrice"
                  type="number"
                  placeholder="e.g. 160"
                  value={itemBasePrice || ''}
                  onChange={(e) => setItemBasePrice(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                />
              </div>
            ) : (
              // Variation editor (Only when variations ON)
              <div className="border border-border rounded-card p-4 bg-bg-page/30 flex flex-col gap-3 animate-[fadeIn_150ms_ease]">
                <span className="text-[13px] text-text-primary font-medium">Variations List *</span>
                
                {variationsList.length === 0 ? (
                  <div className="text-center py-4 text-text-hint text-[13px]">
                    No variations added. (e.g. Half - ₹120, Full - ₹200)
                  </div>
                ) : (
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead>
                      <tr className="border-b border-border/80 text-text-muted font-medium">
                        <th className="pb-1.5">Variation Name</th>
                        <th className="pb-1.5">Price</th>
                        <th className="pb-1.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variationsList.map((v, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-2 sentence-case">{v.name}</td>
                          <td className="py-2 font-mono font-medium">₹{v.price}</td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteVariation(i)}
                              className="text-text-hint hover:text-danger-custom p-1 transition-colors duration-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Inline Add Variation Row */}
                {showInlineVarAdd ? (
                  <div className="flex gap-2.5 items-end bg-bg-card p-3 border border-border/60 rounded-btn animate-[scaleUp_150ms_ease]">
                    <div className="flex-1 flex flex-col gap-1">
                      <label htmlFor="varName" className="text-[11px]">Variation Name</label>
                      <input
                        id="varName"
                        type="text"
                        placeholder="e.g. Half"
                        value={newVarName}
                        onChange={(e) => setNewVarName(e.target.value)}
                        className="h-8 text-[13px]"
                      />
                    </div>
                    <div className="w-28 flex flex-col gap-1">
                      <label htmlFor="varPrice" className="text-[11px]">Price (₹)</label>
                      <input
                        id="varPrice"
                        type="number"
                        placeholder="e.g. 120"
                        value={newVarPrice}
                        onChange={(e) => setNewVarPrice(e.target.value)}
                        className="h-8 text-[13px] font-mono"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleAddVariationInline}
                        className="h-8 px-3.5 bg-primary text-white rounded-btn text-[12px] font-medium"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowInlineVarAdd(false);
                          setNewVarName('');
                          setNewVarPrice('');
                        }}
                        className="h-8 px-3 border border-border text-text-muted rounded-btn text-[12px] font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowInlineVarAdd(true)}
                    className="h-[32px] border border-border hover:bg-bg-page rounded-btn text-[12px] font-medium text-text-primary self-start px-3.5 flex items-center gap-1.5 transition-colors duration-150"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Variation
                  </button>
                )}
              </div>
            )}
          </div>

          {formError && (
            <span className="text-[13px] text-danger-custom font-medium mt-1 sentence-case">
              {formError}
            </span>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-border/80">
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
              Save Menu Item
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
            Are you sure you want to delete the menu item "{itemToDelete?.name}"? This action cannot be undone and will delete the item permanently.
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

      {/* --- ADD/EDIT CATEGORY MODAL --- */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={categoryModalMode === 'add' ? 'Add Category' : 'Edit Category'}
      >
        <form onSubmit={handleSaveCategory} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="catNameInput" className="input-label-custom">Category name *</label>
            <input
              id="catNameInput"
              type="text"
              placeholder="e.g. Beverages, Main Course"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className={categoryError ? 'border-danger-custom w-full' : 'w-full'}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="catDescInput" className="input-label-custom">Description (optional)</label>
            <textarea
              id="catDescInput"
              placeholder="Describe this category..."
              value={catDescription}
              onChange={(e) => setCatDescription(e.target.value)}
              className="h-16 py-2 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              id="catStatusInput"
              type="checkbox"
              checked={catEnabled}
              onChange={(e) => setCatEnabled(e.target.checked)}
              className="w-4 h-4 accent-primary border-border rounded cursor-pointer"
            />
            <label htmlFor="catStatusInput" className="text-[14px] text-text-primary font-medium cursor-pointer select-none">
              Active Status (Enabled)
            </label>
          </div>

          {categoryError && (
            <span className="text-[13px] text-danger-custom font-medium sentence-case">
              {categoryError}
            </span>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCategoryModal(false)}
              className="flex-1 h-[38px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-semibold transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-[38px] bg-primary text-white rounded-btn hover:bg-primary-dark text-[14px] font-semibold transition-colors duration-150"
            >
              Save Category
            </button>
          </div>
        </form>
      </Modal>

      {/* --- DELETE CATEGORY CONFIRMATION DIALOG --- */}
      <Modal
        isOpen={showCategoryDeleteConfirm}
        onClose={() => setShowCategoryDeleteConfirm(false)}
        title="Confirm Category Deletion"
      >
        <div className="flex flex-col gap-4">
          <p className="text-[14px] text-text-muted leading-relaxed sentence-case">
            Are you sure you want to delete the category "{categories.find(c => c.id === filterCategory)?.name}"? This action cannot be undone.
          </p>

          {affectedItemsCount > 0 && (
            <p className="text-[13px] text-danger-custom font-semibold bg-danger-custom/5 p-3 rounded-btn border border-danger-custom/10">
              Warning: There are {affectedItemsCount} menu items using this category. Deleting it will set these items to 'Uncategorized'.
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCategoryDeleteConfirm(false)}
              className="flex-1 h-[38px] border border-border text-text-primary rounded-btn hover:bg-bg-page text-[14px] font-semibold transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteCategoryConfirm}
              className="flex-1 h-[38px] border border-danger-custom text-danger-custom rounded-btn hover:bg-danger-custom/5 text-[14px] font-semibold transition-colors duration-150"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
