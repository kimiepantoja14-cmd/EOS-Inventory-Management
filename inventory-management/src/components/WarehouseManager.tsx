/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from 'react';
import { Warehouse, Item, StockTransfer, TransferItem, StockLot, UserRecord } from '../types';
import { Plus, Search, Building, Landmark, Mail, MapPin, X, Trash2, Edit3, ArrowRightLeft, Eye, ShieldCheck, HelpCircle, ToggleLeft, ShieldAlert, Download, TrendingUp, Layers, DollarSign, Activity } from 'lucide-react';
import WarehouseTreemap from './WarehouseTreemap';

interface WarehouseManagerProps {
  warehouses: Warehouse[];
  items: Item[];
  transfers: StockTransfer[];
  onAddWarehouse: (warehouse: Omit<Warehouse, 'id'>) => void;
  onEditWarehouse?: (id: string, updated: Partial<Warehouse>) => void;
  onDeleteWarehouse?: (id: string) => void;
  onExecuteStockTransfer: (transfer: Omit<StockTransfer, 'id' | 'transferNumber' | 'status'>) => void;
  lots: StockLot[];
  canEdit?: boolean;
  currentUser?: UserRecord;
}

export default function WarehouseManager({ 
  warehouses, 
  items, 
  transfers, 
  onAddWarehouse, 
  onEditWarehouse,
  onDeleteWarehouse,
  onExecuteStockTransfer, 
  lots, 
  canEdit = true,
  currentUser
}: WarehouseManagerProps) {
  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedWH, setFocusedWH] = useState<Warehouse | null>(null);
  const [activeLayoutTab, setActiveLayoutTab] = useState<'interactive' | 'highres'>('interactive');
  
  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Form states - Add Warehouse
  const [whForm, setWhForm] = useState({
    name: '',
    code: '',
    location: '',
    contactEmail: '',
    status: 'Active' as 'Active' | 'Inactive',
    maxCapacity: 1000
  });

  // Form states - Edit Warehouse
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editWhForm, setEditWhForm] = useState<Warehouse | null>(null);

  const handleOpenEdit = (wh: Warehouse) => {
    setEditWhForm({ ...wh });
    setIsEditOpen(true);
  };

  const handleUpdateWarehouse = (e: FormEvent) => {
    e.preventDefault();
    if (!editWhForm || !onEditWarehouse) return;
    onEditWarehouse(editWhForm.id, {
      name: editWhForm.name,
      code: editWhForm.code,
      location: editWhForm.location,
      contactEmail: editWhForm.contactEmail,
      status: editWhForm.status,
      maxCapacity: editWhForm.maxCapacity
    });
    setFocusedWH({ ...editWhForm });
    setIsEditOpen(false);
  };

  const handleDeleteWarehouseClick = (id: string) => {
    if (!onDeleteWarehouse) return;
    const wh = warehouses.find(w => w.id === id);
    if (!wh) return;
    if (window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete warehouse "${wh.name}"? This will remove all storage balances for this location.`)) {
      onDeleteWarehouse(id);
      const rem = warehouses.filter(w => w.id !== id);
      setFocusedWH(rem[0] || null);
    }
  };

  // Form states - Transfer Stock
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [transferLines, setTransferLines] = useState<TransferItem[]>([
    { itemId: items[0]?.id || '', quantity: 5 }
  ]);

  // Filtering
  const filteredWHs = warehouses.filter(wh => 
    wh.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wh.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wh.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper Stock Level
  const getStockAtWarehouse = (itemId: string, whId: string) => {
    const p = items.find(item => item.id === itemId);
    return p?.stockByWarehouse[whId] || 0;
  };

  const getOldestLotInfo = (itemId: string, currentWarehouseId: string) => {
    const activeLots = (lots || []).filter(
      l => l.itemId === itemId && l.warehouseId === currentWarehouseId && l.quantityRemaining > 0
    );
    if (activeLots.length === 0) return null;
    const sorted = [...activeLots].sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime());
    return sorted[0];
  };

  const getFifoViolation = (itemId: string, currentWarehouseId: string, selectedLotId?: string) => {
    if (!selectedLotId) return { violated: false };
    const oldest = getOldestLotInfo(itemId, currentWarehouseId);
    if (!oldest) return { violated: false };
    if (oldest.id !== selectedLotId) {
      const selected = (lots || []).find(l => l.id === selectedLotId);
      return { violated: true, oldest, selected };
    }
    return { violated: false };
  };

  // Check lines validation
  const hasInadequateTransferStock = () => {
    if (!sourceWarehouseId) return true;
    if (sourceWarehouseId === destinationWarehouseId) return true;
    return transferLines.some(line => {
      const stock = getStockAtWarehouse(line.itemId, sourceWarehouseId);
      return line.quantity > stock;
    });
  };

  // Handlers
  const handleOpenAdd = () => {
    setWhForm({
      name: '',
      code: `WH-${(warehouses.length + 1).toString().padStart(3, '0')}`,
      location: '',
      contactEmail: '',
      status: 'Active',
      maxCapacity: 1000
    });
    setIsAddOpen(true);
  };

  const handleOpenTransfer = () => {
    setSourceWarehouseId(warehouses[0]?.id || '');
    setDestinationWarehouseId(warehouses[1]?.id || warehouses[0]?.id || '');
    setNotes('');
    setTransferLines([
      { itemId: items[0]?.id || '', quantity: 5 }
    ]);
    setIsTransferOpen(true);
  };

  const handleCreateWarehouse = (e: FormEvent) => {
    e.preventDefault();
    if (!whForm.name || !whForm.code) return;
    onAddWarehouse({ ...whForm });
    setIsAddOpen(false);
  };

  const handleAddTransferRow = () => {
    const defaultProduct = items[0];
    if (!defaultProduct) return;
    setTransferLines([
      ...transferLines,
      { itemId: defaultProduct.id, quantity: 1 }
    ]);
  };

  const handleUpdateTransferRow = (index: number, fields: Partial<TransferItem>) => {
    setTransferLines(transferLines.map((row, idx) => {
      if (idx !== index) return row;
      const updatedRow = { ...row, ...fields };
      if (fields.itemId) {
        updatedRow.lotId = undefined; // reset lot select
      }
      return updatedRow;
    }));
  };

  const handleRemoveTransferRow = (index: number) => {
    if (transferLines.length === 1) return;
    setTransferLines(transferLines.filter((_, idx) => idx !== index));
  };

  const handleSaveTransfer = (e: FormEvent) => {
    e.preventDefault();
    if (hasInadequateTransferStock()) return;

    // Validate FIFO violations across all lines
    const violations: string[] = [];
    transferLines.forEach((line) => {
      if (line.lotId) {
        const violation = getFifoViolation(line.itemId, sourceWarehouseId, line.lotId);
        if (violation.violated && violation.selected && violation.oldest) {
          const itemPr = items.find(p => p.id === line.itemId);
          violations.push(
            `- Product: "${itemPr?.name}"\n  Selected Lot: "${violation.selected.lotNumber}"\n  Oldest Lot Available: "${violation.oldest.lotNumber}" (received on ${new Date(violation.oldest.dateReceived).toLocaleDateString()})`
          );
        }
      }
    });

    if (violations.length > 0) {
      const confirmOverride = window.confirm(
        `⚠️ FIFO STOCKING RULE VIOLATION DETECTED!\n\n` +
        `Executing this transfer will draw stock from lots that violate First In, First Out (FIFO) priorities in the source warehouse:\n\n` +
        violations.join('\n\n') +
        `\n\nAre you sure you want to OVERRIDE and permit this transfer anyway?`
      );
      if (!confirmOverride) {
        return; // Halt submission!
      }
    }

    onExecuteStockTransfer({
      sourceWarehouseId,
      destinationWarehouseId,
      transferDate: new Date().toISOString().split('T')[0],
      items: transferLines,
      notes
    });
    setIsTransferOpen(false);
  };

  const totalUnitCount = items.reduce((sum, item) => {
    return sum + Object.values(item.stockByWarehouse).reduce((acc, qty) => acc + qty, 0);
  }, 0);

  const totalCostValue = items.reduce((sum, item) => {
    const qty = Object.values(item.stockByWarehouse).reduce((acc, qty) => acc + qty, 0);
    return sum + (qty * item.purchasePrice);
  }, 0);

  const totalRetailPriceValue = items.reduce((sum, item) => {
    const qty = Object.values(item.stockByWarehouse).reduce((acc, qty) => acc + qty, 0);
    return sum + (qty * item.sellingPrice);
  }, 0);

  const totalMaxCapacity = warehouses.reduce((sum, wh) => sum + (wh.maxCapacity || 1000), 0);
  const totalUtilizationPercent = totalMaxCapacity > 0 
    ? Math.min(100, Math.round((totalUnitCount / totalMaxCapacity) * 100)) 
    : 0;

  const handleDownloadReport = () => {
    // Generate CSV content with perfect RFC rules representation
    const headers = [
      'Warehouse Code',
      'Warehouse Name',
      'Location',
      'Contact Email',
      'Max Capacity Limit',
      'Current Stored Units',
      'Unique Product Categories',
      'Utilization Rate',
      'Inventory Valuation Cost (PHP)',
      'Potential Retail Sales (PHP)',
      'Operational Status'
    ];

    const rows = warehouses.map(wh => {
      const currentStoredQty = items.reduce((sum, item) => sum + (item.stockByWarehouse[wh.id] || 0), 0);
      const currentItemTypes = items.filter(item => (item.stockByWarehouse[wh.id] || 0) > 0).length;
      const maxCap = wh.maxCapacity || 1000;
      const utilization = Math.min(100, Math.round((currentStoredQty / maxCap) * 100));
      
      const whCostValue = items.reduce((sum, item) => {
        const qty = item.stockByWarehouse[wh.id] || 0;
        return sum + (qty * item.purchasePrice);
      }, 0);
      
      const whSalesValue = items.reduce((sum, item) => {
        const qty = item.stockByWarehouse[wh.id] || 0;
        return sum + (qty * item.sellingPrice);
      }, 0);

      return [
        wh.code,
        `"${wh.name.replace(/"/g, '""')}"`,
        `"${wh.location.replace(/"/g, '""')}"`,
        wh.contactEmail || 'N/A',
        maxCap,
        currentStoredQty,
        currentItemTypes,
        `"${utilization}%"`,
        whCostValue.toFixed(2),
        whSalesValue.toFixed(2),
        wh.status
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\r\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Equiprime_Warehouse_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header section with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Multi-Warehouse sites</h1>
          <p className="text-sm text-gray-500">Add physical depot locations, balance site allocation levels and perform internal Stock Transfers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-emerald-50 hover:bg-emerald-100/90 active:bg-emerald-100 text-sm font-semibold text-emerald-700 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Download Warehouse Report</span>
          </button>
          {canEdit && (
            <button
              onClick={handleOpenTransfer}
              className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-indigo-50 hover:bg-indigo-100/80 active:bg-indigo-100 text-sm font-semibold text-indigo-700 rounded-lg transition-colors cursor-pointer border border-indigo-100"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Transfer Stock</span>
            </button>
          )}
          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-sm font-semibold text-white rounded-lg transition-colors shadow-xs hover:shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Warehouse Site</span>
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Storage Analytics Desk */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sites & Capacity */}
        <div className="bg-white p-4 rounded-xl border border-gray-150/80 shadow-2xs flex items-center gap-4 text-left">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Active Sites Capacity</span>
            <strong className="text-lg font-black text-slate-900 block mt-0.5">{warehouses.length} Depot Sites</strong>
            <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
              Max limit: {totalMaxCapacity.toLocaleString()} pcs
            </span>
          </div>
        </div>

        {/* Card 2: Total Aggregate Units */}
        <div className="bg-white p-4 rounded-xl border border-gray-150/80 shadow-2xs flex items-center gap-4 text-left">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Aggregated Unit Count</span>
            <strong className="text-lg font-black text-slate-900 block mt-0.5">{totalUnitCount.toLocaleString()} Pcs</strong>
            <span className="text-[10px] text-gray-500 font-mono mt-0.5 block flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-500" /> Space Fill utilization: {totalUtilizationPercent}%
            </span>
          </div>
        </div>

        {/* Card 3: Aggregate Cost Value */}
        <div className="bg-white p-4 rounded-xl border border-gray-150/80 shadow-2xs flex items-center gap-4 text-left">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 font-bold">
            ₱
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Asset Inventory Value (Cost)</span>
            <strong className="text-lg font-black text-emerald-700 block mt-0.5">₱{totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
              Avg book: ₱{totalUnitCount > 0 ? (totalCostValue / Math.max(1, totalUnitCount)).toFixed(2) : '0.00'} / unit
            </span>
          </div>
        </div>

        {/* Card 4: Potential Retail Value */}
        <div className="bg-white p-4 rounded-xl border border-gray-150/80 shadow-2xs flex items-center gap-4 text-left">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block tracking-wider">Projected Sales Valuation</span>
            <strong className="text-lg font-black text-amber-700 block mt-0.5">₱{totalRetailPriceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            <span className="text-[10px] text-gray-500 font-mono mt-0.5 block text-rose-600 font-bold">
              Margin spread: {totalCostValue > 0 ? (((totalRetailPriceValue - totalCostValue) / totalRetailPriceValue) * 100).toFixed(1) : '0.0'}% profit
            </span>
          </div>
        </div>
      </div>

      {/* Grid search system */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search warehouse code, name or locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm pl-10 pr-4 py-2 bg-gray-50 text-gray-800 rounded-lg border border-gray-100/80 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/55 focus:bg-white placeholder-gray-400 font-medium"
          />
        </div>
      </div>

      {/* D3 Treemap Density Visualizer */}
      <WarehouseTreemap 
        warehouses={warehouses}
        items={items}
        onSelectWarehouse={setFocusedWH}
        onExecuteStockTransfer={onExecuteStockTransfer}
      />

      {/* Core Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* WH Table List */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            {filteredWHs.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-400">
                No matching physical depot structures recordable.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-150">
                <thead>
                  <tr className="bg-gray-50/50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider font-mono">
                    <th className="px-6 py-4">Site Name</th>
                    <th className="px-6 py-4">Site Code</th>
                    <th className="px-6 py-4">Physical Location</th>
                    <th className="px-6 py-4">Fulfillment Capacity</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {filteredWHs.map(wh => {
                    const activeTypesCount = items.filter(item => (item.stockByWarehouse[wh.id] || 0) > 0).length;
                    const totalQtyAtWH = items.reduce((sum, item) => sum + (item.stockByWarehouse[wh.id] || 0), 0);
                    return (
                      <tr
                        key={wh.id}
                        onClick={() => setFocusedWH(wh)}
                        className={`hover:bg-indigo-50/15 cursor-pointer transition-colors ${focusedWH?.id === wh.id ? 'bg-indigo-50/30' : ''}`}
                      >
                        <td className="px-6 py-4 space-y-0.5">
                          <div className="font-semibold text-gray-900 text-sm">{wh.name}</div>
                          <div className="text-[10px] text-gray-450 font-mono flex items-center gap-1">
                            <Mail className="w-3 h-3 text-gray-400" /> {wh.contactEmail}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-gray-900">
                          {wh.code}
                        </td>
                        <td className="px-6 py-4 text-gray-650 flex items-center gap-1 pt-5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" /> {wh.location}
                        </td>
                        <td className="px-6 py-4 font-mono space-y-1.5 min-w-[150px]">
                          {(() => {
                            const maxCap = wh.maxCapacity || 1000;
                            const utilizationPct = Math.round((totalQtyAtWH / maxCap) * 100);
                            const isNearlyFull = utilizationPct >= 85;
                            return (
                              <>
                                <div className="flex justify-between items-center text-xs">
                                  <strong className={`text-slate-800 ${isNearlyFull ? 'text-red-650' : ''}`}>
                                    {totalQtyAtWH.toLocaleString()} / {maxCap.toLocaleString()}
                                  </strong>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    isNearlyFull 
                                      ? 'bg-rose-50 text-rose-600 animate-pulse font-extrabold' 
                                      : 'text-indigo-600 bg-indigo-50/50'
                                  }`}>
                                    {utilizationPct}%
                                  </span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all duration-300 ${isNearlyFull ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${Math.min(100, utilizationPct)}%` }}
                                  />
                                </div>
                                <div className="text-[10px] text-gray-400">{activeTypesCount} Unique SKUs</div>
                              </>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${wh.status === 'Active' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                            {wh.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detailed WH side */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-6">
          {focusedWH ? (
            <div className="space-y-6">
              {/* Header WH info */}
              {(() => {
                const whTotalQty = items.reduce((sum, item) => sum + (item.stockByWarehouse[focusedWH.id] || 0), 0);
                const whMaxCap = focusedWH.maxCapacity || 1000;
                const whUtilPct = Math.round((whTotalQty / whMaxCap) * 100);
                const whNearlyFull = whUtilPct >= 85;
                return (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-50 text-indigo-600 rounded">
                          {focusedWH.code}
                        </span>
                        {currentUser?.role === 'Admin' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(focusedWH)}
                              title="Edit Warehouse Site Info"
                              className="p-1 hover:bg-slate-100 text-indigo-600 hover:text-indigo-805 rounded border border-transparent hover:border-slate-200 cursor-pointer transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {warehouses.length > 1 && (
                              <button
                                onClick={() => handleDeleteWarehouseClick(focusedWH.id)}
                                title="Delete Warehouse Site"
                                className="p-1 hover:bg-rose-50 text-rose-600 hover:text-rose-850 rounded border border-transparent hover:border-rose-150 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 leading-snug">{focusedWH.name}</h3>
                      <div className="text-xs text-gray-500 space-y-1.5 pt-1">
                        <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {focusedWH.location}</div>
                        <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> {focusedWH.contactEmail}</div>
                      </div>
                    </div>

                    {/* Capacity Utilization Widget */}
                    <div className="p-3.5 bg-gray-50/50 rounded-xl border border-gray-150 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono text-[10px] text-gray-500 uppercase font-bold">Capacity Utilization</span>
                        <span className={`font-mono font-extrabold ${whNearlyFull ? 'text-rose-600 animate-pulse' : 'text-indigo-600'}`}>{whUtilPct}%</span>
                      </div>
                      <div className="w-full bg-gray-200/60 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${whNearlyFull ? 'bg-rose-500' : 'bg-indigo-500'}`}
                          style={{ width: `${Math.min(100, whUtilPct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono text-gray-500">
                        <span>Used: <strong>{whTotalQty.toLocaleString()} units</strong></span>
                        <span>Capacity: <strong>{whMaxCap.toLocaleString()} units</strong></span>
                      </div>
                      {whNearlyFull && (
                        <div className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-100/65 p-1.5 rounded text-center animate-pulse mt-1">
                          ⚠️ SHIELD ALERT: WAREHOUSE SITE NEAR INTENSITY LIMIT
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* INTERACTIVE WAREHOUSE LAYOUT SCHEMATIC MAP (Manila Central Logistics Hub & Site Blueprints) */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-550 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse inline-block" />
                    {focusedWH.name.includes('Manila') ? 'Manila Hub Layout Blueprint' : `${focusedWH.name} Layout Map`}
                  </h4>
                  {focusedWH.name.includes('Manila') && (
                    <div className="flex items-center gap-1 bg-slate-105 p-1 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setActiveLayoutTab('interactive')}
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                          activeLayoutTab === 'interactive'
                            ? 'bg-slate-800 text-white shadow-2xs font-extrabold'
                            : 'text-slate-500 hover:text-slate-800 bg-white'
                        }`}
                      >
                        Model
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveLayoutTab('highres')}
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                          activeLayoutTab === 'highres'
                            ? 'bg-rose-600 text-white shadow-2xs font-extrabold'
                            : 'text-slate-500 hover:text-slate-800 bg-white'
                        }`}
                      >
                        📸 Layout Map
                      </button>
                    </div>
                  )}
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.2 rounded font-mono uppercase border border-slate-200">
                    Live telemetry matrix
                  </span>
                </div>

                {focusedWH.name.includes('Manila') ? (
                  activeLayoutTab === 'interactive' ? (
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-inner relative overflow-hidden font-mono text-[10px] select-none">
                      {/* Architectural schematic grids background pattern */}
                      <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 0)', backgroundSize: '12px 12px' }} />
                      
                      <div className="relative z-10 space-y-3 font-mono">
                        <div className="grid grid-cols-3 gap-2 text-center select-none font-mono">
                          
                          {/* Zone A */}
                          <div className="bg-slate-950/85 border border-indigo-500/40 p-2 rounded-lg flex flex-col justify-between h-20 hover:border-indigo-400 hover:shadow-xs hover:shadow-indigo-500/10 transition-all cursor-pointer">
                            <span className="text-indigo-400 font-bold uppercase tracking-wider text-[9px] border-b border-indigo-500/10 pb-0.5">Aisle A</span>
                            <span className="text-[8px] text-slate-400 mt-1 uppercase">Engine & Powertrain</span>
                            <div className="mt-auto pt-1">
                              <span className="text-[10px] text-emerald-400 font-bold">Zone Active</span>
                              <div className="w-full bg-slate-800 h-1 overflow-hidden rounded-full mt-1">
                                <div className="bg-indigo-550 h-1 rounded-full" style={{ width: '68%' }} />
                              </div>
                            </div>
                          </div>

                          {/* Zone B */}
                          <div className="bg-slate-950/85 border border-purple-500/40 p-2 rounded-lg flex flex-col justify-between h-20 hover:border-purple-400 hover:shadow-xs hover:shadow-purple-500/10 transition-all cursor-pointer">
                            <span className="text-purple-400 font-bold uppercase tracking-wider text-[9px] border-b border-purple-500/10 pb-0.5">Aisle B</span>
                            <span className="text-[8px] text-slate-400 mt-1 uppercase">Hydraulics & Seals</span>
                            <div className="mt-auto pt-1">
                              <span className="text-[10px] text-emerald-400 font-bold">Zone Active</span>
                              <div className="w-full bg-slate-800 h-1 overflow-hidden rounded-full mt-1">
                                <div className="bg-purple-550 h-1 rounded-full" style={{ width: '42%' }} />
                              </div>
                            </div>
                          </div>

                          {/* Zone C */}
                          <div className="bg-slate-950/85 border border-amber-500/40 p-2 rounded-lg flex flex-col justify-between h-20 hover:border-amber-400 hover:shadow-xs hover:shadow-amber-500/10 transition-all cursor-pointer">
                            <span className="text-amber-400 font-bold uppercase tracking-wider text-[9px] border-b border-amber-500/10 pb-0.5">Aisle C</span>
                            <span className="text-[8px] text-slate-400 mt-1 uppercase">Chassis Parts</span>
                            <div className="mt-auto pt-1">
                              <span className="text-[10px] text-amber-400 font-bold">Reorder Watch</span>
                              <div className="w-full bg-slate-800 h-1 overflow-hidden rounded-full mt-1">
                                <div className="bg-amber-500 h-1 rounded-full" style={{ width: '89%' }} />
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Loading bays telemetry */}
                        <div className="grid grid-cols-2 gap-2 text-center text-[9px]">
                          <div className="bg-slate-950/85 border border-slate-750 p-2 rounded-lg text-slate-400 flex items-center justify-center gap-1.5 py-2.5 border-dashed">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span>DOCK GATE 1: CLEAR DEPLOYED</span>
                          </div>
                          <div className="bg-slate-950/85 border border-slate-750 p-2 rounded-lg text-slate-400 flex items-center justify-center gap-1.5 py-2.5 border-dashed">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span>DOCK GATE 2: STAGED OUTSIDE</span>
                          </div>
                        </div>

                        <div className="p-2 bg-slate-950/85 border border-slate-800 rounded-lg text-[9px] text-slate-400 text-center flex items-center justify-center gap-2">
                          <span>📡 FORKLIFT telemetry: Active</span>
                          <span className="text-indigo-400 font-bold">[PATH SHIELD SECURE]</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* HIGH RESOLUTION REALISTIC WAREHOUSE LAYOUT MAP */
                    <div className="bg-slate-955 border border-slate-800 rounded-xl overflow-hidden shadow-xl animate-in fade-in duration-200">
                      <div className="relative h-44 bg-slate-900 group">
                        <img 
                          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80" 
                          alt="Manila Central Logistics Hub Live Layout Map" 
                          className="w-full h-full object-cover opacity-85 transition-transform duration-75 group-hover:scale-[1.02]"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                        
                        <div className="absolute inset-0 p-4 flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <span className="bg-rose-600 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                              OPERATIONAL LAYOUT MAP
                            </span>
                            <span className="bg-slate-900/90 text-slate-400 border border-slate-750 font-mono text-[8px] px-1.5 py-0.5 rounded">
                              CTR-HUB-MNL-01
                            </span>
                          </div>
                          
                          <div className="space-y-0.5 text-left font-mono">
                            <h5 className="text-xs font-black text-white uppercase tracking-tight flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Manila Central Logistics Hub Siting Map
                            </h5>
                            <p className="text-[9px] text-slate-300">Class-A High-Bay Stacking Facility • Automated Warehouse Crane Lanes</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-3.5 grid grid-cols-2 gap-3 text-[9.5px] font-mono text-slate-300 border-t border-slate-800 bg-slate-900">
                        <div className="space-y-1.5 border-r border-slate-800 pr-2">
                          <div className="flex justify-between">
                            <span className="text-slate-450">Facility Floor:</span>
                            <strong className="text-emerald-400">14,800 M²</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-450">Aisle Capacity:</span>
                            <strong className="text-white">12,500 PALLETS</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-450">HVAC Status:</span>
                            <strong className="text-indigo-300">ACTIVE (21°C)</strong>
                          </div>
                        </div>
                        <div className="space-y-1.5 pl-2">
                          <div className="flex justify-between">
                            <span className="text-slate-300">Telemetry System:</span>
                            <strong className="text-amber-400">4 CORE ONLINE</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-450">Receiving Gates:</span>
                            <strong className="text-white">DOCKS 1 & 2 OPEN</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-450">Vertical clearance:</span>
                            <strong className="text-indigo-400">12.5 METERS</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  // Generic high contrast schematic dynamic layout for other warehouses
                  <div className="bg-slate-900 text-slate-105 p-4 rounded-xl border border-slate-800 shadow-inner relative overflow-hidden font-mono text-[10px] select-none text-center py-6">
                    <div className="relative z-10 space-y-2 font-mono">
                      <span className="text-xs text-slate-400 block uppercase font-bold">Generic Blueprint Schematic layout</span>
                      <p className="text-[10px] text-indigo-455 font-black tracking-widest uppercase">SITE GRID BLOCKS ONLINE</p>
                      <p className="text-[9px] text-slate-500 max-w-xs mx-auto leading-relaxed">Detailed custom layouts are configured exclusively for deep logistics storage hubs like the Manila Central Logistics Hub.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Items list inside this specific Warehouse */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Physical Inventory Ledger</span>
                </h4>
                
                <div className="divide-y divide-gray-50 overflow-y-auto max-h-[350px] pr-1">
                  {items.map(p => {
                    const qty = p.stockByWarehouse[focusedWH.id] || 0;
                    const isTotalLow = Object.values(p.stockByWarehouse).reduce((sum, q) => sum + q, 0) <= p.reorderPoint;
                    
                    return (
                      <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="space-y-0.5 pr-2 flex-1 min-w-0">
                          <span className="font-semibold text-gray-800 block truncate">{p.name}</span>
                          <span className="text-[10px] font-mono text-gray-450 uppercase">{p.sku} • {p.category}</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono font-bold ${qty === 0 ? 'text-red-500' : isTotalLow ? 'text-amber-600' : 'text-slate-800'}`}>
                            {qty} {p.unit}
                          </span>
                          <span className="text-[9px] text-gray-400 block mt-0.5 font-mono font-medium">Val: ₱{(qty * p.sellingPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Historic Transfer log for context */}
              <div className="space-y-2 pt-4 border-t border-gray-100">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Related Transfer logs</h4>
                {transfers.filter(t => t.sourceWarehouseId === focusedWH.id || t.destinationWarehouseId === focusedWH.id).length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">No transfers registered for this hub location.</p>
                ) : (
                  <div className="space-y-2.5 max-h-40 overflow-y-auto divide-y divide-gray-50">
                    {transfers
                      .filter(t => t.sourceWarehouseId === focusedWH.id || t.destinationWarehouseId === focusedWH.id)
                      .reverse()
                      .map(tr => {
                        const isSource = tr.sourceWarehouseId === focusedWH.id;
                        return (
                          <div key={tr.id} className="pt-2 text-xs">
                            <div className="flex justify-between font-mono text-[9px]">
                              <span className="font-bold text-gray-800">{tr.transferNumber}</span>
                              <span className="text-gray-450">{tr.transferDate}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-gray-700 leading-tight py-1">
                              <span>{isSource ? 'Outbound To:' : 'Inbound From:'}</span>
                              <strong className="text-indigo-600">
                                {isSource 
                                  ? (warehouses.find(w => w.id === tr.destinationWarehouseId)?.name || 'Another Hub')
                                  : (warehouses.find(w => w.id === tr.sourceWarehouseId)?.name || 'Another Hub')
                                }
                              </strong>
                            </div>
                            <span className="text-[10px] text-gray-400 block font-mono">Volume shipped: {tr.items.reduce((s, i) => s + i.quantity, 0)} items</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-gray-400">
              <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              Select spatial hub warehouse location on left to view deep site inventory breakdown, manager contacts and transit logs.
            </div>
          )}
        </div>
      </div>

      {/* CREATE WAREHOUSE MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Configure New Warehouse Location</h2>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateWarehouse}>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Site Code (Unique) *</label>
                    <input
                      type="text"
                      required
                      value={whForm.code}
                      onChange={(e) => setWhForm({ ...whForm, code: e.target.value.toUpperCase() })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Site Hub Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dallas Center"
                      value={whForm.name}
                      onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Physical Address / Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Houston, TX"
                    value={whForm.location}
                    onChange={(e) => setWhForm({ ...whForm, location: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Manager Contact Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. manager@hub.com"
                      value={whForm.contactEmail}
                      onChange={(e) => setWhForm({ ...whForm, contactEmail: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Max Capacity Limit (Units) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={whForm.maxCapacity}
                      onChange={(e) => setWhForm({ ...whForm, maxCapacity: Math.max(1, parseInt(e.target.value) || 0) })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Status</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={whForm.status === 'Active'}
                        onChange={() => setWhForm({ ...whForm, status: 'Active' })}
                      />
                      Active (Accepting transfers)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={whForm.status === 'Inactive'}
                        onChange={() => setWhForm({ ...whForm, status: 'Inactive' })}
                      />
                      Inactive (Suspended)
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                >
                  Spawn Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT WAREHOUSE DIALOG MODAL */}
      {isEditOpen && editWhForm && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 font-sans">Modify Warehouse Information</h2>
              <button 
                onClick={() => setIsEditOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateWarehouse}>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600 font-sans">Site Code (Unique) *</label>
                    <input
                      type="text"
                      required
                      value={editWhForm.code}
                      onChange={(e) => setEditWhForm({ ...editWhForm, code: e.target.value.toUpperCase() })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600 font-sans">Site Hub Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dallas Center"
                      value={editWhForm.name}
                      onChange={(e) => setEditWhForm({ ...editWhForm, name: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans font-medium hover:border-gray-300"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 font-sans">Physical Address / Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Houston, TX"
                    value={editWhForm.location}
                    onChange={(e) => setEditWhForm({ ...editWhForm, location: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600 font-sans">Manager Contact Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. manager@hub.com"
                      value={editWhForm.contactEmail}
                      onChange={(e) => setEditWhForm({ ...editWhForm, contactEmail: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600 font-sans">Max Capacity Limit *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editWhForm.maxCapacity || 1000}
                      onChange={(e) => setEditWhForm({ ...editWhForm, maxCapacity: Math.max(1, parseInt(e.target.value) || 0) })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 font-sans">Status</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer font-sans">
                      <input
                        type="radio"
                        checked={editWhForm.status === 'Active'}
                        onChange={() => setEditWhForm({ ...editWhForm, status: 'Active' })}
                      />
                      Active (Accepting transfers)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer font-sans">
                      <input
                        type="radio"
                        checked={editWhForm.status === 'Inactive'}
                        onChange={() => setEditWhForm({ ...editWhForm, status: 'Inactive' })}
                      />
                      Inactive (Suspended)
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK TRANSFER DIALOG MODAL */}
      {isTransferOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Initiate Inter-Warehouse Stock Transfer</h2>
              </div>
              <button 
                onClick={() => setIsTransferOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTransfer}>
              <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Source Warehouse Location *</label>
                    <select
                      value={sourceWarehouseId}
                      onChange={(e) => setSourceWarehouseId(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Destination Location *</label>
                    <select
                      value={destinationWarehouseId}
                      onChange={(e) => setDestinationWarehouseId(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {sourceWarehouseId === destinationWarehouseId && (
                  <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-lg text-center">
                    Warning: Source & Destination locations are identical! Physical stock cannot be transferred within identical bins.
                  </p>
                )}

                {/* Transfer items table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">Transfer Items ({transferLines.length})</span>
                    <button
                      type="button"
                      onClick={handleAddTransferRow}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      + Add Item Row
                    </button>
                  </div>

                  <div className="space-y-3">
                    {transferLines.map((row, idx) => {
                      const availableStock = getStockAtWarehouse(row.itemId, sourceWarehouseId);
                      const isOverStock = row.quantity > availableStock;
                      return (
                        <div key={idx} className="space-y-1 bg-gray-50/50 p-2.5 rounded-lg border border-gray-150">
                          <div className="flex gap-3 items-center">
                            {/* Item select */}
                            <div className="flex-1 min-w-0">
                              <select
                                value={row.itemId}
                                onChange={(e) => handleUpdateTransferRow(idx, { itemId: e.target.value })}
                                className="w-full text-xs px-3 py-1.5 border border-gray-250 rounded-lg focus:outline-hidden font-semibold bg-white"
                              >
                                {items.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                                ))}
                              </select>
                            </div>

                            {/* Lot select dropdown */}
                            <div className="w-40 text-left">
                              <select
                                value={row.lotId || ''}
                                onChange={(e) => {
                                  const selectedLotIdForLine = e.target.value || undefined;
                                  
                                  if (selectedLotIdForLine) {
                                    const violation = getFifoViolation(row.itemId, sourceWarehouseId, selectedLotIdForLine);
                                    if (violation.violated && violation.selected && violation.oldest) {
                                      const confirmOverride = window.confirm(
                                        `⚠️ FIFO COMPLIANCE TRIGGER WARNING!\n\n` +
                                        `The lot "${violation.selected.lotNumber}" is NOT the oldest available lot for this product in the source warehouse.\n\n` +
                                        `The oldest available lot is "${violation.oldest.lotNumber}" (received on ${new Date(violation.oldest.dateReceived).toLocaleDateString()}).\n\n` +
                                        `Withdrawing the selected lot violates the FIFO (First In, First Out) principle.\n\n` +
                                        `Are you sure you want to select this lot?`
                                      );
                                      if (!confirmOverride) {
                                        return;
                                      }
                                    }
                                  }
                                  handleUpdateTransferRow(idx, { lotId: selectedLotIdForLine });
                                }}
                                className="w-full text-xs px-2 py-1.5 border border-gray-250 rounded-lg focus:outline-hidden font-medium bg-white text-slate-800"
                              >
                                <option value="">Auto-allocate (FIFO)</option>
                                {lots
                                  .filter(l => l.itemId === row.itemId && l.warehouseId === sourceWarehouseId && l.quantityRemaining > 0)
                                  .map(l => (
                                    <option key={l.id} value={l.id}>
                                      {l.lotNumber} ({l.quantityRemaining} left)
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Quantity */}
                            <div className="w-24">
                              <input
                                type="number"
                                min={1}
                                value={row.quantity}
                                onChange={(e) => handleUpdateTransferRow(idx, { quantity: Math.max(1, parseInt(e.target.value) || 0) })}
                                className={`w-full text-xs px-3 py-1.5 border rounded-lg focus:outline-hidden text-center font-mono font-bold ${
                                  isOverStock ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-250 bg-white'
                                }`}
                              />
                            </div>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveTransferRow(idx)}
                              disabled={transferLines.length === 1}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg disabled:opacity-30 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex flex-col gap-1 text-[10px] text-gray-500 font-mono px-1">
                            <div className="flex justify-between items-center w-full">
                              <span>Available to withdraw: <strong className={availableStock === 0 ? 'text-red-550' : 'text-indigo-600'}>{availableStock} pcs</strong></span>
                              {isOverStock && (
                                <span className="text-amber-600 font-bold flex items-center gap-0.5 animate-pulse">
                                  Exceeds spatial bin count!
                                </span>
                              )}
                            </div>
                            {row.lotId && getFifoViolation(row.itemId, sourceWarehouseId, row.lotId).violated && (
                              <span className="text-rose-600 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 self-start mt-0.5">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                FIFO Warning: Older Lot ({getFifoViolation(row.itemId, sourceWarehouseId, row.lotId).oldest?.lotNumber}) exists!
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* notes */}
                <div className="space-y-1 bg-gray-50/45 p-4 rounded-xl border border-gray-100">
                  <label className="text-xs font-semibold text-gray-600">Transit Notes / Transport Order Authorization *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="e.g. Dispatched via Logistics Hub to rebalance regional inventory..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs px-3.5 py-1.5 border border-gray-250 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                {hasInadequateTransferStock() && (
                  <span className="text-xs text-rose-600 font-bold mr-auto flex items-center gap-1 pl-1">
                    Error: Transfer validation failed! check bin matches or stock limit deficits.
                  </span>
                )}
                
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={hasInadequateTransferStock()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                >
                  Confirm Transport Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
