/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, FormEvent, useMemo, useEffect } from 'react';
import { AreaChart, Area } from 'recharts';
import { Item, Warehouse, InventoryTransaction, PurchaseOrder, Supplier } from '../types';
import {   Search, 
  Plus, 
  SlidersHorizontal, 
  Layers, 
  AlertTriangle, 
  Building, 
  X, 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown, 
  Edit3, 
  Trash2,
  Package, 
  CheckCircle2, 
  Tag, 
  Hash, 
  DollarSign, 
  Wrench, 
  Clock, 
  Info,
  Bell,
  BellRing
} from 'lucide-react';

interface InventoryItemsProps {
  items: Item[];
  warehouses: Warehouse[];
  transactions: InventoryTransaction[];
  purchaseOrders: PurchaseOrder[];
  currentUser?: any;
  onAddItem: (item: Omit<Item, 'id'>) => void;
  onEditItem: (item: Item) => void;
  onAdjustStock: (itemId: string, warehouseId: string, adjustmentType: 'add' | 'remove' | 'set', qty: number, reason: string) => void;
  onDeleteItem?: (itemId: string) => void;
  suppliers?: Supplier[];
}

export default function InventoryItems({ 
  items = [], 
  warehouses = [], 
  transactions = [], 
  purchaseOrders = [], 
  currentUser,
  onAddItem,
  onEditItem,
  onAdjustStock,
  onDeleteItem,
  suppliers = []
}: InventoryItemsProps) {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStockState, setSelectedStockState] = useState('All'); // 'All', 'Low Stock', 'Out of Stock', 'In Stock'
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('All');
  
  // Selected detail focus
  const [focusedItem, setFocusedItem] = useState<Item | null>(null);
  const [customReorderPoint, setCustomReorderPoint] = useState<number | null>(null);
  const [alertConfigItem, setAlertConfigItem] = useState<Item | null>(null);
  const [alertThresholdVal, setAlertThresholdVal] = useState<number>(0);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [skuError, setSkuError] = useState('');

  const canSeePricing = currentUser?.permissions?.canSeePricing ?? true;
  const canEditItems = currentUser?.role === 'Admin' || (currentUser?.permissions?.canEditItems ?? false);
  const canAdjustStock = currentUser?.role === 'Admin' || (currentUser?.permissions?.canAdjustStock ?? false);
  
  // Modals status
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  // State for in-table catalog deletion confirmation
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Form State: Add & Edit Item
  const [itemForm, setItemForm] = useState<{
    sku: string;
    name: string;
    description: string;
    unit: string;
    purchasePrice: number | string;
    sellingPrice: number | string;
    reorderPoint: number;
    category: string;
    brand: string;
    applicableUnits: string;
    alternatePartNumbers: string;
    status: 'Active' | 'Inactive';
    imageUrl: string;
    supplierId: string;
  }>({
    sku: '',
    name: '',
    description: '',
    unit: 'Pcs',
    purchasePrice: '',
    sellingPrice: '',
    reorderPoint: 5,
    category: 'Engine & Powertrain',
    brand: 'Generic',
    applicableUnits: '',
    alternatePartNumbers: '',
    status: 'Active',
    imageUrl: '',
    supplierId: ''
  });

  // Reset custom reorder point when selected focusedItem changes
  useEffect(() => {
    setCustomReorderPoint(null);
  }, [focusedItem]);

  // Form State: Adjust Stock
  const [adjustForm, setAdjustForm] = useState({
    warehouseId: warehouses[0]?.id || '',
    type: 'add' as 'add' | 'remove' | 'set',
    quantity: 10,
    reason: 'Focal cycle count validation'
  });

  // Calculate incoming stock from outstanding / Active POs
  const getItemIncomingQty = (itemId: string, whId: string = 'All') => {
    let incoming = 0;
    purchaseOrders.forEach(po => {
      // Typically 'Issued' means ordered but not fully received yet
      if (po.status === 'Issued' || po.status === 'Draft') {
        if (whId === 'All' || po.warehouseId === whId) {
          po.items.forEach((line) => {
            if (line.itemId === itemId) {
              const qtyOrdered = line.quantity;
              const qtyReceived = line.receivedQuantity || 0;
              const remaining = qtyOrdered - qtyReceived;
              if (remaining > 0) {
                incoming += remaining;
              }
            }
          });
        }
      }
    });
    return incoming;
  };

  // Helper for computing stock count for a single item (All warehouses or matching warehouse)
  const getItemTotalQty = (item: Item, whId: string = 'All') => {
    if (whId === 'All') {
      return Object.values(item.stockByWarehouse || {}).reduce((sum, qty) => sum + qty, 0);
    }
    return item.stockByWarehouse?.[whId] || 0;
  };

  // Helper to construct the last 30 days of stock levels
  const getStockTrend30Days = (item: Item, selectedWhId: string) => {
    const currentStock = getItemTotalQty(item, selectedWhId);
    
    const result: { day: string; stock: number }[] = [];
    const today = new Date();
    
    // Filter transactions related to this item (and optionally, the selected warehouse)
    const itemTransactions = (transactions || []).filter(tx => 
      tx.itemId === item.id && 
      (selectedWhId === 'All' || tx.warehouseId === selectedWhId)
    );

    // Sort them decending by date
    const sortedTx = [...itemTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let tempStock = currentStock;
    
    // Build details from today working backward
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      result.unshift({
        day: dateStr,
        stock: tempStock
      });

      // Find any transactions that happened on this exact day and subtract them (going backward in time)
      const dayTxs = sortedTx.filter(tx => tx.date && tx.date.startsWith(dateStr));
      dayTxs.forEach(tx => {
        tempStock -= tx.quantity;
      });
      if (tempStock < 0) tempStock = 0;
    }
    
    return result;
  };

  // Categories list aggregation dynamically
  const categories = useMemo(() => {
    const list = items.map(it => it.category).filter(Boolean);
    return ['All', ...Array.from(new Set(list))];
  }, [items]);

  // Derived filtered item list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.alternatePartNumbers && item.alternatePartNumbers.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.applicableUnits && item.applicableUnits.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
      
      const totalStock = getItemTotalQty(item, selectedWarehouseId);
      
      let matchStockState = true;
      if (selectedStockState === 'Low Stock') {
        matchStockState = totalStock <= item.reorderPoint && totalStock > 0;
      } else if (selectedStockState === 'Out of Stock') {
        matchStockState = totalStock === 0;
      } else if (selectedStockState === 'In Stock') {
        matchStockState = totalStock > item.reorderPoint;
      }

      return matchSearch && matchCategory && matchStockState;
    });
  }, [items, searchTerm, selectedCategory, selectedStockState, selectedWarehouseId]);

  // Handle Create Request
  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.sku) return;

    // SKU duplicate code validation check
    const skuExists = items.some(item => item.sku.trim().toLowerCase() === itemForm.sku.trim().toLowerCase());
    if (skuExists) {
      setSkuError("The SKU code provided already exists in the items array.");
      return;
    }
    setSkuError('');

    // Build fresh item structure
    // Since onAddItem takes Omit<Item, 'id'>, we pass values directly
    const defaultStock: Record<string, number> = {};
    warehouses.forEach(wh => {
      defaultStock[wh.id] = 0;
    });

    onAddItem({
      sku: itemForm.sku,
      name: itemForm.name,
      description: itemForm.description,
      unit: itemForm.unit,
      purchasePrice: itemForm.purchasePrice === '' ? 0 : Number(itemForm.purchasePrice),
      sellingPrice: itemForm.sellingPrice === '' ? 0 : Number(itemForm.sellingPrice),
      reorderPoint: Number(itemForm.reorderPoint),
      category: itemForm.category,
      brand: itemForm.brand || 'Generic',
      applicableUnits: itemForm.applicableUnits || undefined,
      alternatePartNumbers: itemForm.alternatePartNumbers || undefined,
      status: itemForm.status,
      imageUrl: itemForm.imageUrl || undefined,
      stockByWarehouse: defaultStock,
      supplierId: itemForm.supplierId || undefined
    });

    // Reset Form
    setItemForm({
      sku: '',
      name: '',
      description: '',
      unit: 'Pcs',
      purchasePrice: '',
      sellingPrice: '',
      reorderPoint: 5,
      category: 'Engine & Powertrain',
      brand: 'Generic',
      applicableUnits: '',
      alternatePartNumbers: '',
      status: 'Active',
      imageUrl: '',
      supplierId: ''
    });
    setIsAddOpen(false);
  };

  // Open Edit Dialog prefilled
  const openEditDialog = (item: Item) => {
    setFocusedItem(item);
    setItemForm({
      sku: item.sku,
      name: item.name,
      description: item.description,
      unit: item.unit,
      purchasePrice: item.purchasePrice === 0 ? '' : item.purchasePrice,
      sellingPrice: item.sellingPrice === 0 ? '' : item.sellingPrice,
      reorderPoint: item.reorderPoint,
      category: item.category,
      brand: item.brand || 'Generic',
      applicableUnits: item.applicableUnits || '',
      alternatePartNumbers: item.alternatePartNumbers || '',
      status: item.status,
      imageUrl: item.imageUrl || '',
      supplierId: item.supplierId || ''
    });
    setIsEditOpen(true);
  };

  // Handle Save Edit
  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!focusedItem || !itemForm.name) return;

    onEditItem({
      ...focusedItem,
      sku: itemForm.sku,
      name: itemForm.name,
      description: itemForm.description,
      unit: itemForm.unit,
      purchasePrice: itemForm.purchasePrice === '' ? 0 : Number(itemForm.purchasePrice),
      sellingPrice: itemForm.sellingPrice === '' ? 0 : Number(itemForm.sellingPrice),
      reorderPoint: Number(itemForm.reorderPoint),
      category: itemForm.category,
      brand: itemForm.brand || 'Generic',
      applicableUnits: itemForm.applicableUnits || undefined,
      alternatePartNumbers: itemForm.alternatePartNumbers || undefined,
      status: itemForm.status,
      imageUrl: itemForm.imageUrl || undefined,
      supplierId: itemForm.supplierId || undefined
    });

    setIsEditOpen(false);
    setFocusedItem(null);
  };

  // Open Adjust dialog
  const openAdjustDialog = (item: Item) => {
    setFocusedItem(item);
    setAdjustForm({
      warehouseId: warehouses[0]?.id || '',
      type: 'add',
      quantity: 5,
      reason: 'Manual Inventory Reconciliation'
    });
    setIsAdjustOpen(true);
  };

  // Handle execute adjustment
  const handleExecuteAdjustment = (e: FormEvent) => {
    e.preventDefault();
    if (!focusedItem) return;

    onAdjustStock(
      focusedItem.id,
      adjustForm.warehouseId,
      adjustForm.type,
      Number(adjustForm.quantity),
      adjustForm.reason
    );

    setIsAdjustOpen(false);
    setFocusedItem(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      
      {/* HEADER CONTROLS SHEET */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Spare Parts and Equipment Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">Define master records, adjust stock balances, and track SKU reorder levels</p>
        </div>
        {canEditItems && (
          <button
            onClick={() => {
              // Pre-fill / reset form parameters
              setItemForm({
                sku: 'SKU-' + Math.floor(Math.random() * 90000 + 10000),
                name: '',
                description: '',
                unit: 'Pcs',
                purchasePrice: 100,
                sellingPrice: 180,
                reorderPoint: 5,
                category: 'Engine & Powertrain',
                brand: 'Sumitomo',
                applicableUnits: '',
                alternatePartNumbers: '',
                status: 'Active',
                imageUrl: ''
              });
              setSkuError('');
              setIsAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 font-semibold text-white text-xs rounded-lg shadow-sm transition-all select-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Brand SKU</span>
          </button>
        )}
      </div>

      {/* FILTER & OPTION CONTROLS GRID */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          
          {/* SEARCH BAR COMPACT */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by SKU, Name, Serials..."
              className="w-full pl-9 pr-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* CATEGORIES DROPDOWN */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 shrink-0 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat} Section</option>
              ))}
            </select>
          </div>

          {/* STOCK OUTLOOK SELECTOR */}
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 shrink-0 text-slate-400" />
            <select
              value={selectedStockState}
              onChange={(e) => setSelectedStockState(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Stocks</option>
              <option value="Low Stock">⚠️ Low Thresholds</option>
              <option value="Out of Stock">🚫 Out of Stock (Zero)</option>
              <option value="In Stock">✅ Healthy levels (In Stock)</option>
            </select>
          </div>

          {/* SINGLE WAREHOUSE SCOPE SELECTOR */}
          <div className="flex items-center gap-1.5">
            <Building className="w-4 h-4 shrink-0 text-slate-400" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">Global (All Warehouses)</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>📍 {wh.name}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* ITEMS INVENTORY RECORD TABLE SHEET */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table id="inventory-catalog-table" className="w-full text-left border-collapse table-auto text-xs">
            <thead>
              <tr className="bg-slate-55 border-b border-slate-200 font-semibold text-slate-500 text-[10px] uppercase tracking-wider font-mono">
                <th className="px-4 py-3.5">SKU Product details</th>
                <th className="px-4 py-3.5">Category & Brand</th>
                <th className="px-4 py-3.5 text-right">Base Purchase Price</th>
                <th className="px-4 py-3.5 text-right">Selling Price</th>
                <th className="px-4 py-3.5 text-center">Available Stock</th>
                <th className="px-4 py-3.5 text-center">30D Stock Trend</th>
                <th className="px-4 py-3.5 text-center">Pending Received</th>
                <th className="px-4 py-3.5">Stock Indicator Warnings</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
                    <span className="font-semibold block text-slate-500">No Catalog items matched current criteria.</span>
                    <span className="text-[11px] block text-slate-400 mt-0.5">Please expand search parameter scopes or clear filter selections</span>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const totalStock = getItemTotalQty(item, selectedWarehouseId);
                  const isLow = totalStock <= item.reorderPoint && totalStock > 0;
                  const isOut = totalStock === 0;
                  const pendingQty = getItemIncomingQty(item.id, selectedWarehouseId);

                  const itemSupplier = suppliers.find(s => s.id === item.supplierId);
                  const costInBase = item.purchasePrice * (itemSupplier?.exchangeRate || 1);
                  const marginPercent = costInBase > 0 
                    ? Math.round(((item.sellingPrice - costInBase) / costInBase) * 100) 
                    : 0;

                  const isBelowThreshold = totalStock <= item.reorderPoint;

                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => setFocusedItem(item)}
                      className={`transition-all duration-150 ease-in-out cursor-pointer transform hover:scale-[1.006] hover:shadow-xs origin-center ${
                        focusedItem?.id === item.id 
                          ? 'bg-indigo-55/70 hover:bg-indigo-50/70 border-l-2 border-l-indigo-600' 
                          : isBelowThreshold
                            ? 'bg-amber-50/70 hover:bg-amber-100/50 border-l-2 border-l-amber-500'
                            : 'hover:bg-slate-50/75'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <span className="font-mono bg-slate-150 px-2.5 py-0.5 rounded text-[10px] uppercase border border-slate-200 tracking-wider">
                            {item.sku}
                          </span>
                          <span className="text-slate-800 line-clamp-1">{item.name}</span>
                        </div>
                        {item.description && (
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic font-light pl-1">
                            “{item.description}”
                          </p>
                        )}
                        {(item.applicableUnits || item.alternatePartNumbers) && (
                          <div className="flex gap-1.5 mt-1 text-[9px] text-slate-450 items-center pl-1 font-mono">
                            {item.applicableUnits && <span className="bg-slate-100 px-1 py-0.2 rounded">⚙️ {item.applicableUnits}</span>}
                            {item.alternatePartNumbers && <span className="bg-slate-100 px-1 py-0.2 rounded">🏷️ {item.alternatePartNumbers}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded text-[10px] uppercase">
                          {item.category}
                        </span>
                        <span className="text-slate-500 font-medium block mt-1 pl-1 text-[11px] font-mono">
                          🏭 {item.brand || 'Generic'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono" onClick={(e) => e.stopPropagation()}>
                        {canSeePricing ? (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-800">
                              {itemSupplier ? (itemSupplier.currency === 'PHP' ? '₱' : itemSupplier.currency === 'JPY' ? '¥' : itemSupplier.currency === 'USD' ? '$' : itemSupplier.currency === 'EUR' ? '€' : '') : '₱'}
                              {item.purchasePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {itemSupplier && itemSupplier.currency !== 'PHP' && (
                              <span className="text-[9.5px] text-gray-400 font-medium font-sans">
                                ≈ ₱{costInBase.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px] font-normal">🔒 Restricted</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canSeePricing ? (
                          <>
                            <span className="font-mono font-bold text-slate-900 block">₱{item.sellingPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            {marginPercent > 0 && (
                              <span className="text-[9px] text-emerald-600 font-semibold block mt-px font-mono">
                                +{marginPercent}% profit margin
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400 italic text-[11px] font-normal">🔒 Restricted</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono text-xs font-extrabold px-3 py-1 rounded-full ${
                          isOut ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                          isLow ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          {totalStock.toLocaleString()} <span className="text-[10px] font-normal font-sans ml-1">{item.unit}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-block h-8 w-24 bg-slate-50/50 border border-slate-100 rounded-md p-1">
                          <AreaChart width={90} height={22} data={getStockTrend30Days(item, selectedWarehouseId)}>
                            <defs>
                              <linearGradient id={`sparkline-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={isBelowThreshold ? '#f59e0b' : '#10b981'} stopOpacity={0.2}/>
                                <stop offset="95%" stopColor={isBelowThreshold ? '#f59e0b' : '#10b981'} stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="stock"
                              stroke={isBelowThreshold ? '#f59e0b' : '#10b981'}
                              strokeWidth={1.5}
                              fillOpacity={1}
                              fill={`url(#sparkline-${item.id})`}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pendingQty > 0 ? (
                          <span className="font-mono bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 text-[10px]">
                            <Clock className="w-3 h-3 text-blue-500" />
                            +{pendingQty}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-light font-mono">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200/50 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" /> Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-55/30 text-amber-800 border border-amber-205 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" /> Healthy
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-1.5 font-semibold">
                          {canEditItems && (
                            <button
                              onClick={() => {
                                setAlertConfigItem(item);
                                setAlertThresholdVal(item.reorderPoint);
                              }}
                              title="Configure Stock Alert (Reorder point override)"
                              className="p-1 px-2 bg-slate-100 hover:bg-amber-50 hover:border-amber-200 border border-transparent text-slate-600 hover:text-amber-700 rounded transition-all text-[10px] select-none cursor-pointer inline-flex items-center gap-1 font-semibold"
                            >
                              <Bell className="w-3.5 h-3.5" /> Alert
                            </button>
                          )}
                          {canAdjustStock && (
                            <button
                              onClick={() => openAdjustDialog(item)}
                              title="Direct manual stock adjustment"
                              className="p-1 px-2 bg-slate-100 hover:bg-slate-205 text-slate-600 hover:text-indigo-600 rounded transition-colors text-[10px] select-none cursor-pointer inline-flex items-center gap-1 font-semibold"
                            >
                              <ArrowLeftRight className="w-3 h-3" /> Adjust
                            </button>
                          )}
                          {canEditItems && (
                            <button
                              onClick={() => openEditDialog(item)}
                              title="Edit catalog properties"
                              className="p-1 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded transition-all cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          
                          {currentUser?.role === 'Admin' && (deletingItemId === item.id ? (
                            <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 p-0.5 rounded transition-all animate-bounce">
                              <span className="text-[9px] text-rose-700 px-1 font-bold">Delete?</span>
                              <button
                                onClick={() => {
                                  if (onDeleteItem) onDeleteItem(item.id);
                                  setDeletingItemId(null);
                                }}
                                className="p-0.5 px-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold cursor-pointer transition-colors"
                              >
                                  Yes
                              </button>
                              <button
                                onClick={() => setDeletingItemId(null)}
                                className="p-0.5 px-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[9px] font-bold cursor-pointer transition-colors"
                              >
                                  No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingItemId(item.id)}
                              title="Delete catalog item"
                              className="p-1 text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 border border-transparent hover:border-rose-150 rounded transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ))}
                      </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPANDED RECORD TRANSACTION LOG AUDITS / ITEM DETAILS MODAL */}
      {focusedItem && !alertConfigItem && !isEditOpen && !isAdjustOpen && (
        <div id="modal-container-details" className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full animate-in zoom-in-95 duration-150 p-6 space-y-4 text-white shadow-2xl relative">
            
            {/* Local success feedback toast */}
            {saveFeedback && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 animate-bounce z-55">
                <CheckCircle2 className="w-4 h-4" />
                <span>{saveFeedback}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    [{focusedItem.sku}] Item Details Analysis & Audits
                  </h3>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    Physical stock records for: <b>{focusedItem.name}</b> • Category: <i>{focusedItem.category}</i>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFocusedItem(null)}
                className="p-1.5 cursor-pointer bg-slate-800 hover:bg-slate-700 rounded text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Allocation details per location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {warehouses.map(wh => {
                const stock = focusedItem.stockByWarehouse?.[wh.id] || 0;
                const pending = getItemIncomingQty(focusedItem.id, wh.id);
                return (
                  <div key={wh.id} className="p-3.5 rounded-lg bg-slate-950 border border-slate-850 flex flex-col justify-between space-y-1.5">
                    <span className="text-[10.5px] font-semibold text-slate-400 font-mono block truncate">📍 {wh.name}</span>
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-xl font-extrabold font-mono text-white">{stock} <span className="text-xs font-normal text-slate-500">{focusedItem.unit}</span></span>
                      {pending > 0 && <span className="text-[9.5px] font-mono text-indigo-400 font-bold bg-indigo-950/20 px-1.5 py-0.5 rounded">+{pending} Incoming</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dynamic reorder point alert threshold overriding */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider font-mono block">Dynamic Stock Alert Config</span>
                  <p className="text-[10px] text-slate-400">Specify an item-specific reorder threshold to override global automatic reorder levels.</p>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/15 shrink-0">
                  Item-level Override
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 min-w-[120px] relative">
                  <input
                    type="number"
                    min={0}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                    placeholder="Threshold units..."
                    value={customReorderPoint !== null ? customReorderPoint : focusedItem.reorderPoint}
                    onChange={(e) => setCustomReorderPoint(Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 font-bold uppercase">
                    Units
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    const val = customReorderPoint !== null ? customReorderPoint : focusedItem.reorderPoint;
                    onEditItem({
                      ...focusedItem,
                      reorderPoint: val
                    });
                    setSaveFeedback(`Saved trigger: ${val} units!`);
                    setTimeout(() => setSaveFeedback(''), 3000);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap"
                >
                  Save Custom Alert Threshold
                </button>
              </div>
            </div>

            {/* Sibling list of transactional entries */}
            <div className="space-y-2 mt-4">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider font-mono block">Historical Transaction Log</span>
              
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-2">
                {transactions.filter(t => t.itemId === focusedItem.id).length === 0 ? (
                  <p className="text-[11px] text-slate-400 font-mono py-6 text-center">No transactional movements registered for this catalog file yet.</p>
                ) : (
                  transactions
                    .filter(t => t.itemId === focusedItem.id)
                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(trans => {
                      const matchedWarehouse = warehouses.find(w => w.id === trans.warehouseId);
                      const isPositive = trans.quantity > 0;
                      const qtySigned = isPositive ? `+${trans.quantity}` : `${trans.quantity}`;

                      return (
                        <div key={trans.id} className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-between text-[11px] font-mono leading-relaxed gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <div>
                              <span className="text-slate-200 block truncate font-medium">
                                {trans.description || trans.type}
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                Warehouse: {matchedWarehouse?.name || 'Central Office'} • Ref: {trans.referenceNumber || 'N/A'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`font-extrabold text-xs block ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{qtySigned}</span>
                            <span className="text-[9px] text-slate-500 block mt-0.5">{new Date(trans.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
            
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setFocusedItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

      {/* STOCK ALERT OVERRIDE MODAL */}
      {alertConfigItem && (
        <div id="modal-container-alert-override" className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full animate-in zoom-in-95 duration-150 p-6 space-y-4 shadow-xl text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-150 pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-500 animate-bounce shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Stock Alert Config</h3>
                  <p className="text-[10px] text-slate-500">Override reorder point for {alertConfigItem.sku}</p>
                </div>
              </div>
              <button 
                onClick={() => setAlertConfigItem(null)} 
                className="p-1 cursor-pointer hover:bg-slate-100 rounded text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              <p className="leading-relaxed">
                Set an item-specific reorder threshold for <strong>{alertConfigItem.name}</strong>. When total stock drops below this level, an amber warnings flag triggers.
              </p>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 space-y-1.5 font-mono">
                <div className="flex justify-between text-[11px]">
                  <span>Product Code:</span>
                  <span className="font-bold text-slate-900">{alertConfigItem.sku}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Category:</span>
                  <span className="font-semibold text-slate-800">{alertConfigItem.category}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Current Reorder:</span>
                  <span className="font-bold text-amber-600">{alertConfigItem.reorderPoint} {alertConfigItem.unit}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Custom Alert Threshold (Units) *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={0}
                    value={alertThresholdVal}
                    onChange={(e) => setAlertThresholdVal(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-950 font-mono font-bold text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-[10px]">
                    {alertConfigItem.unit}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAlertConfigItem(null)}
                className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 cursor-pointer select-none text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onEditItem({
                    ...alertConfigItem,
                    reorderPoint: alertThresholdVal
                  });
                  setAlertConfigItem(null);
                }}
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-extrabold text-white cursor-pointer select-none text-xs shadow-xs"
              >
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WINDOWS CONTROLLERS */}

      {/* ADD ITEM SKU MODAL */}
      {isAddOpen && (
        <div id="modal-container-add" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Register Catalog Item SKU</h3>
                  <p className="text-[10px] text-slate-500">Insert permanent stock details to catalog</p>
                </div>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="p-1 cursor-pointer hover:bg-slate-100 rounded text-slate-500"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Stock Keeping Unit SKU *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.sku}
                    onChange={(e) => {
                      setItemForm({ ...itemForm, sku: e.target.value });
                      setSkuError('');
                    }}
                    className={`w-full px-3 py-1.5 border rounded-lg text-slate-800 font-mono text-xs focus:ring-1 focus:outline-none ${
                      skuError 
                        ? 'border-rose-450 bg-rose-50/20 focus:ring-rose-500 focus:bg-white' 
                        : 'border-slate-200 bg-slate-50 focus:ring-indigo-500 focus:bg-white'
                    }`}
                  />
                  {skuError && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1">
                      ⚠️ {skuError}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Category Taxonomy *</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Engine & Powertrain">Engine & Powertrain</option>
                    <option value="Hydraulic System">Hydraulic System</option>
                    <option value="Undercarriage">Undercarriage</option>
                    <option value="Attachments & Accessories">Attachments & Accessories</option>
                    <option value="Cabin & Operator Components">Cabin & Operator Components</option>
                    <option value="Frame & Structural Parts">Frame & Structural Parts</option>
                    <option value="Ground Engaging Tools">Ground Engaging Tools</option>
                    <option value="Fuel & Emission Systems">Fuel & Emission Systems</option>
                    <option value="Suspension & Rubber Components">Suspension & Rubber Components</option>
                    <option value="Fasteners, Seals & Hardware">Fasteners, Seals & Hardware</option>
                    <option value="General Maintenance">General Maintenance</option>
                    <option value="Aircon System">Aircon System</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Skilled Commercial Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Caterpillar Oil Filter D8"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Technical Specifications / Description</label>
                <textarea
                  placeholder="Insert dimensions, manufacturer model number allocations, compatibility warnings"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Brand *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.brand}
                    onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Count Unit *</label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:outline-none"
                  >
                    <option value="Pcs">Pieces (Pcs)</option>
                    <option value="Units">Complete Units</option>
                    <option value="Sets">Integrated Sets</option>
                    <option value="Liters">Liters (Ltr)</option>
                    <option value="Kgs">Kilograms (Kg)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Reorder Level *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={itemForm.reorderPoint}
                    onChange={(e) => setItemForm({ ...itemForm, reorderPoint: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* Preferred Supplier linked selector */}
              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono col-span-full">Preferred Supplier & Currency Integration</label>
                <select
                  value={itemForm.supplierId}
                  onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                >
                  <option value="">-- No Supplier Linked (Base Currency PHP) --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>🏭 {s.name} ({s.currency})</option>
                  ))}
                </select>
              </div>

              {canSeePricing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">
                      Purchase Price ({suppliers.find(s => s.id === itemForm.supplierId)?.currency || 'PHP'})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00 (Optional)"
                      value={itemForm.purchasePrice}
                      onChange={(e) => setItemForm({ ...itemForm, purchasePrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Standard Selling Price (PHP)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="PHP (Optional)"
                      value={itemForm.sellingPrice}
                      onChange={(e) => setItemForm({ ...itemForm, sellingPrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Applicable Models / Units</label>
                  <input
                    type="text"
                    placeholder="e.g. PC200-8, D8R"
                    value={itemForm.applicableUnits}
                    onChange={(e) => setItemForm({ ...itemForm, applicableUnits: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Alt Part Numbers / Codes</label>
                  <input
                    type="text"
                    placeholder="e.g. 154-19-12110"
                    value={itemForm.alternatePartNumbers}
                    onChange={(e) => setItemForm({ ...itemForm, alternatePartNumbers: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 font-extrabold text-white cursor-pointer select-none"
                >
                  Confirm & Write
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ITEM SKU PROPERTIES MODAL */}
      {isEditOpen && focusedItem && (
        <div id="modal-container-edit" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Edit Catalog Properties</h3>
                  <p className="text-[10px] text-slate-500">Update item identity variables: <b>{focusedItem.sku}</b></p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsEditOpen(false);
                  setFocusedItem(null);
                }} 
                className="p-1 cursor-pointer hover:bg-slate-100 rounded text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Stock Keeping Unit SKU *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.sku}
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-100/60 rounded-lg text-slate-500 font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Category Taxonomy *</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  >
                    <option value="Engine & Powertrain">Engine & Powertrain</option>
                    <option value="Hydraulic System">Hydraulic System</option>
                    <option value="Undercarriage">Undercarriage</option>
                    <option value="Attachments & Accessories">Attachments & Accessories</option>
                    <option value="Cabin & Operator Components">Cabin & Operator Components</option>
                    <option value="Frame & Structural Parts">Frame & Structural Parts</option>
                    <option value="Ground Engaging Tools">Ground Engaging Tools</option>
                    <option value="Fuel & Emission Systems">Fuel & Emission Systems</option>
                    <option value="Suspension & Rubber Components">Suspension & Rubber Components</option>
                    <option value="Fasteners, Seals & Hardware">Fasteners, Seals & Hardware</option>
                    <option value="General Maintenance">General Maintenance</option>
                    <option value="Aircon System">Aircon System</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Skilled Commercial Name *</label>
                <input
                  type="text"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-850 font-medium focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Technical Specifications / Description</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none focus:bg-white resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Brand *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.brand}
                    onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Count Unit *</label>
                  <select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:outline-none"
                  >
                    <option value="Pcs">Pieces (Pcs)</option>
                    <option value="Units">Complete Units</option>
                    <option value="Sets">Integrated Sets</option>
                    <option value="Liters">Liters (Ltr)</option>
                    <option value="Kgs font-bold">Kilograms (Kg)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Reorder Point Threshold *</label>
                  <input
                    type="number"
                    required
                    value={itemForm.reorderPoint}
                    onChange={(e) => setItemForm({ ...itemForm, reorderPoint: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  />
                </div>
              </div>

              {/* Preferred Supplier linked selector */}
              <div className="space-y-1 text-slate-700 col-span-full">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono col-span-full">Preferred Supplier & Currency Integration</label>
                <select
                  value={itemForm.supplierId}
                  onChange={(e) => setItemForm({ ...itemForm, supplierId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:bg-white"
                >
                  <option value="">-- No Supplier Linked (Base Currency PHP) --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>🏭 {s.name} ({s.currency})</option>
                  ))}
                </select>
              </div>

               {canSeePricing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 col-span-full">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">
                      Purchase Price ({suppliers.find(s => s.id === itemForm.supplierId)?.currency || 'PHP'})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00 (Optional)"
                      value={itemForm.purchasePrice}
                      onChange={(e) => setItemForm({ ...itemForm, purchasePrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Standard Selling Price (PHP)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="PHP (Optional)"
                      value={itemForm.sellingPrice}
                      onChange={(e) => setItemForm({ ...itemForm, sellingPrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Alternate Models Allocation</label>
                  <input
                    type="text"
                    value={itemForm.applicableUnits}
                    onChange={(e) => setItemForm({ ...itemForm, applicableUnits: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider font-mono">Alt Part Numbers</label>
                  <input
                    type="text"
                    value={itemForm.alternatePartNumbers}
                    onChange={(e) => setItemForm({ ...itemForm, alternatePartNumbers: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setFocusedItem(null);
                  }}
                  className="flex-1 py-1.8 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold rounded-lg transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.8 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold rounded-lg transition-all cursor-pointer text-center"
                >
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIRECT STOCK ADJUSTMENT DIALOG */}
      {isAdjustOpen && focusedItem && (
        <div id="modal-container-adjust" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full animate-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">Manual Balance Adjustment</h3>
                  <p className="text-[10.5px] text-slate-500">Record an instant balance correction audit</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsAdjustOpen(false);
                  setFocusedItem(null);
                }} 
                className="p-1 cursor-pointer hover:bg-slate-100 text-slate-500 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-indigo-50 text-indigo-805 rounded-lg flex items-start gap-2.5 text-[11px] leading-relaxed">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" />
              <div>
                <span>Target item SKU: <b>{focusedItem.sku}</b> • {focusedItem.name}</span>
                <span className="block text-[10px] text-indigo-700 mt-1">
                  Adjustments will trigger instant physical audit trails logging the actor and reason codes.
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteAdjustment} className="space-y-4 text-xs font-sans">
              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-550 tracking-wider font-mono">Location Warehouse *</label>
                <select
                  value={adjustForm.warehouseId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-1.8 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-semibold focus:ring-1 focus:ring-indigo-505 focus:outline-none"
                >
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>📍 {wh.name} ({focusedItem.stockByWarehouse?.[wh.id] || 0} Pcs active)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-550 tracking-wider font-mono">Correction Method *</label>
                  <select
                    value={adjustForm.type}
                    onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as 'add' | 'remove' | 'set' })}
                    className="w-full px-3 py-1.8 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-bold focus:ring-1 focus:ring-indigo-510 focus:outline-none"
                  >
                    <option value="add">➕ Increment (+) count</option>
                    <option value="remove">➖ Decrement (-) count</option>
                    <option value="set">✏️ Overwrite / Set (=) count</option>
                  </select>
                </div>

                <div className="space-y-1 text-slate-700">
                  <label className="text-[10px] font-bold uppercase text-slate-550 tracking-wider font-mono">Quantity Count *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-mono text-xs focus:ring-1 focus:ring-indigo-510 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1 text-slate-700">
                <label className="text-[10px] font-bold uppercase text-slate-550 tracking-wider font-mono">Reason for Correction / Justification *</label>
                <input
                  type="text"
                  required
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="e.g. Broken packaging write-off, manual check audit"
                  className="w-full px-3 py-1.8 border border-slate-200 bg-slate-50 rounded-lg text-slate-850 font-medium focus:ring-1 focus:ring-indigo-515 focus:outline-none focus:bg-white"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustOpen(false);
                    setFocusedItem(null);
                  }}
                  className="flex-1 py-1.8 bg-slate-100 hover:bg-slate-200 font-bold text-slate-650 rounded-lg transition-colors cursor-pointer text-center select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.8 bg-indigo-600 hover:bg-indigo-755 text-white font-extrabold rounded-lg transition-all cursor-pointer text-center select-none"
                >
                  Write Balance Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
