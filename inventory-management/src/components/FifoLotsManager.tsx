/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, FormEvent, useMemo } from 'react';
import { StockLot, Item, Warehouse } from '../types';
import { VisualQRCode } from './BarcodeQRGenerator';
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Calendar, 
  Building, 
  AlertTriangle, 
  Barcode, 
  Tag, 
  TrendingDown, 
  CheckCircle2, 
  SlidersHorizontal,
  X,
  PlusCircle,
  Package,
  CalendarDays,
  FileSpreadsheet,
  QrCode,
  Volume2,
  Terminal,
  Printer
} from 'lucide-react';

interface FifoLotsManagerProps {
  lots: StockLot[];
  items: Item[];
  warehouses: Warehouse[];
  onAddLot: (newLot: Omit<StockLot, "id">) => void;
  onEditLot: (updatedLot: StockLot) => void;
  onDeleteLot: (id: string) => void;
  canEdit: boolean;
  onAdjustLotStock: (lotId: string, adjustmentType: "dispense" | "adjust", quantity: number, reason: string) => void;
}

export default function FifoLotsManager({
  lots = [],
  items = [],
  warehouses = [],
  onAddLot,
  onEditLot,
  onDeleteLot,
  canEdit,
  onAdjustLotStock
}: FifoLotsManagerProps) {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('All');
  const [selectedItemFilter, setSelectedItemFilter] = useState('All');
  const [stockState, setStockState] = useState('Active'); // 'All', 'Active' (quantityRemaining > 0), 'Depleted' (quantityRemaining === 0)
  
  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [focusedLot, setFocusedLot] = useState<StockLot | null>(null);

  // QR Passport Modal States
  const [selectedQRForModal, setSelectedQRForModal] = useState<StockLot | null>(null);
  const [qrSize, setQrSize] = useState<number>(21);
  const [qrColor, setQrColor] = useState<string>('text-slate-900');
  const [scanSimulatorLogs, setScanSimulatorLogs] = useState<string[]>([]);

  // Form states
  const [lotForm, setLotForm] = useState({
    itemId: '',
    lotNumber: '',
    warehouseId: '',
    quantityReceived: 100,
    quantityRemaining: 100,
    dateReceived: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    barcodeValue: ''
  });

  const [adjustForm, setAdjustForm] = useState({
    type: 'dispense' as 'dispense' | 'adjust',
    quantity: 10,
    reason: 'Manual cycle count decrement'
  });

  // Unique lists for filtering
  const itemsMap = useMemo(() => {
    return new Map<string, Item>(items.map(it => [it.id, it]));
  }, [items]);

  const warehousesMap = useMemo(() => {
    return new Map<string, Warehouse>(warehouses.map(wh => [wh.id, wh]));
  }, [warehouses]);

  // Derived Filtered lots
  const filteredLots = useMemo(() => {
    return lots.filter(lot => {
      const item = itemsMap.get(lot.itemId);
      const warehouse = warehousesMap.get(lot.warehouseId);

      const matchSearch = 
        lot.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lot.barcodeValue.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item?.sku || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchWarehouse = selectedWarehouseId === 'All' || lot.warehouseId === selectedWarehouseId;
      const matchItem = selectedItemFilter === 'All' || lot.itemId === selectedItemFilter;
      
      let matchStock = true;
      if (stockState === 'Active') {
        matchStock = lot.quantityRemaining > 0;
      } else if (stockState === 'Depleted') {
        matchStock = lot.quantityRemaining === 0;
      }

      return matchSearch && matchWarehouse && matchItem && matchStock;
    });
  }, [lots, searchTerm, selectedWarehouseId, selectedItemFilter, stockState, itemsMap, warehousesMap]);

  // Calculations for Stats Card
  const totalVolumeRemaining = useMemo(() => {
    return lots.reduce((sum, lot) => sum + lot.quantityRemaining, 0);
  }, [lots]);

  const activeLotsCount = useMemo(() => {
    return lots.filter(lot => lot.quantityRemaining > 0).length;
  }, [lots]);

  const customExpiringLots = useMemo(() => {
    const today = new Date();
    const thresholdDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days window
    return lots.filter(lot => 
      lot.quantityRemaining > 0 && 
      lot.expiryDate && 
      new Date(lot.expiryDate) <= thresholdDate
    );
  }, [lots]);

  // Handlers for Add Lot Dialog
  const handleOpenAdd = () => {
    if (!canEdit) return;
    const defaultItem = items[0]?.id || '';
    const defaultWarehouse = warehouses[0]?.id || '';
    const nowStamp = Date.now().toString().slice(-6);
    
    setLotForm({
      itemId: defaultItem,
      lotNumber: `LOT-${nowStamp}`,
      warehouseId: defaultWarehouse,
      quantityReceived: 100,
      quantityRemaining: 100,
      dateReceived: new Date().toISOString().slice(0, 10),
      expiryDate: '',
      barcodeValue: `BAR-${defaultItem.slice(-4)}-${nowStamp}`
    });
    setIsAddOpen(true);
  };

  const handleCreateLot = (e: FormEvent) => {
    e.preventDefault();
    if (!lotForm.itemId || !lotForm.warehouseId || !lotForm.lotNumber) return;

    onAddLot({
      itemId: lotForm.itemId,
      lotNumber: lotForm.lotNumber,
      warehouseId: lotForm.warehouseId,
      quantityReceived: Number(lotForm.quantityReceived),
      quantityRemaining: Number(lotForm.quantityRemaining),
      dateReceived: new Date(lotForm.dateReceived).toISOString(),
      expiryDate: lotForm.expiryDate ? new Date(lotForm.expiryDate).toISOString() : undefined,
      barcodeValue: lotForm.barcodeValue || `LOT-${lotForm.lotNumber}`
    });

    setIsAddOpen(false);
  };

  // Handlers for Edit Lot Dialog
  const handleOpenEdit = (lot: StockLot) => {
    if (!canEdit) return;
    setFocusedLot(lot);
    setLotForm({
      itemId: lot.itemId,
      lotNumber: lot.lotNumber,
      warehouseId: lot.warehouseId,
      quantityReceived: lot.quantityReceived,
      quantityRemaining: lot.quantityRemaining,
      dateReceived: lot.dateReceived.slice(0, 10),
      expiryDate: lot.expiryDate ? lot.expiryDate.slice(0, 10) : '',
      barcodeValue: lot.barcodeValue
    });
    setIsEditOpen(true);
  };

  const handleSaveEditLot = (e: FormEvent) => {
    e.preventDefault();
    if (!focusedLot) return;

    onEditLot({
      ...focusedLot,
      lotNumber: lotForm.lotNumber,
      quantityReceived: Number(lotForm.quantityReceived),
      quantityRemaining: Number(lotForm.quantityRemaining),
      dateReceived: new Date(lotForm.dateReceived).toISOString(),
      expiryDate: lotForm.expiryDate ? new Date(lotForm.expiryDate).toISOString() : undefined,
      barcodeValue: lotForm.barcodeValue
    });

    setIsEditOpen(false);
    setFocusedLot(null);
  };

  // Handlers for Dispatch/Adjustment dialog
  const handleOpenAdjust = (lot: StockLot) => {
    if (!canEdit) return;
    setFocusedLot(lot);
    setAdjustForm({
      type: 'dispense',
      quantity: Math.min(10, lot.quantityRemaining),
      reason: 'Physical production release / dispatch'
    });
    setIsAdjustOpen(true);
  };

  const handleApplyAdjustment = (e: FormEvent) => {
    e.preventDefault();
    if (!focusedLot) return;

    onAdjustLotStock(
      focusedLot.id,
      adjustForm.type,
      Number(adjustForm.quantity),
      adjustForm.reason
    );

    setIsAdjustOpen(false);
    setFocusedLot(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">FIFO Active Stock Lots</h1>
          <p className="text-xs text-gray-500">First-In, First-Out ledger batch control, decay tracing, and dispatch tools</p>
        </div>
        {canEdit && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-xs font-bold text-white rounded-lg shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Inbound Stock Lot
          </button>
        )}
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center gap-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Active Lots</p>
            <h3 className="text-lg font-bold text-gray-900">{activeLotsCount}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center gap-4">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-mono">Lot Storage Balance</p>
            <h3 className="text-lg font-bold text-gray-900">{totalVolumeRemaining.toLocaleString()} units</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center gap-4">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Expiring Soon (30d)</p>
            <h3 className="text-lg font-bold text-gray-900">{customExpiringLots.length} Lots</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center gap-4">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-mono">Barcode Registry</p>
            <h3 className="text-lg font-bold text-gray-900">{lots.filter(l => !!l.barcodeValue).length} Unique SKU Lots</h3>
          </div>
        </div>
      </div>

      {/* Control Filters Panel */}
      <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            Inventory Ledgers Filters
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Filtering {filteredLots.length} of {lots.length} records</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Lot, Custom SKU, Item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3.5 py-2 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-gray-50/50"
            />
          </div>

          {/* Item Filter */}
          <select
            value={selectedItemFilter}
            onChange={(e) => setSelectedItemFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50/50 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-gray-700"
          >
            <option value="All">All Catalog Items</option>
            {items.map(it => (
              <option key={it.id} value={it.id}>
                {it.name} ({it.sku})
              </option>
            ))}
          </select>

          {/* Warehouse Filter */}
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50/50 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-gray-700"
          >
            <option value="All">All Warehouse Locations</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>

          {/* Stock State Filter Button Group */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-gray-50 text-xs p-0.5">
            <button
              onClick={() => setStockState('Active')}
              className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition-all ${stockState === 'Active' ? 'bg-white shadow-xs text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Active Lots
            </button>
            <button
              onClick={() => setStockState('Depleted')}
              className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition-all ${stockState === 'Depleted' ? 'bg-white shadow-xs text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Depleted Lots
            </button>
            <button
              onClick={() => setStockState('All')}
              className={`flex-1 py-1 px-2.5 rounded-md font-semibold transition-all ${stockState === 'All' ? 'bg-white shadow-xs text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
            >
              All Logs
            </button>
          </div>
        </div>
      </div>

      {/* Lot Registry Grid/Table */}
      <div className="bg-white border border-gray-150 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-55/65 border-b border-gray-150 text-gray-600 text-xs font-bold uppercase tracking-wider font-mono">
                <th className="px-5 py-3">Lot reference</th>
                <th className="px-5 py-3">Catalog product</th>
                <th className="px-5 py-3">Warehouse facility</th>
                <th className="px-5 py-3 text-right">Batch quantity</th>
                <th className="px-5 py-3 text-right font-mono">Remaining stock</th>
                <th className="px-5 py-3">Dates (FIFO order)</th>
                <th className="px-5 py-3">Compliance & Code</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredLots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-1.5 font-mono">
                      <Barcode className="w-8 h-8 text-gray-300" />
                      <span>No matching Stock Lots found in ledger</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLots.map(lot => {
                  const item = itemsMap.get(lot.itemId);
                  const warehouse = warehousesMap.get(lot.warehouseId);
                  
                  // Check expiry thresholds
                  const isDepleted = lot.quantityRemaining === 0;
                  const isExpiring = lot.expiryDate && 
                    lot.quantityRemaining > 0 && 
                    new Date(lot.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  const isExpired = lot.expiryDate && 
                    lot.quantityRemaining > 0 && 
                    new Date(lot.expiryDate) < new Date();

                  return (
                    <tr key={lot.id} className="hover:bg-gray-52/45 transition-colors">
                      <td className="px-5 py-4 font-bold text-gray-900 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-indigo-500" />
                          {lot.lotNumber}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-800">{item?.name || 'Unknown item'}</div>
                        <div className="text-gray-400 text-[10px] font-mono">{item?.sku || 'N/A'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-700 flex items-center gap-1">
                          <Building className="w-3 h-3 text-gray-400" />
                          {warehouse?.name || 'Default Central'}
                        </div>
                        <div className="text-[10px] font-mono text-gray-400 uppercase">{warehouse?.code || 'MAIN'}</div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-gray-500 font-medium">
                        {lot.quantityReceived.toLocaleString()} {item?.unit || 'pcs'}
                      </td>
                      <td className="px-5 py-4 text-right font-mono">
                        <span className={`font-bold inline-block px-2 py-0.5 rounded-sm ${isDepleted ? 'bg-gray-100 text-gray-400 line-through' : lot.quantityRemaining < lot.quantityReceived * 0.20 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {lot.quantityRemaining.toLocaleString()} {item?.unit || 'pcs'}
                        </span>
                        {!isDepleted && (
                          <div className="text-[9px] text-gray-400">
                            {Math.round((lot.quantityRemaining / lot.quantityReceived) * 100)}% Available
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-gray-700 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          Inbound: {new Date(lot.dateReceived).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                        </div>
                        {lot.expiryDate ? (
                          <div className={`text-[10px] mt-0.5 flex items-center gap-1 font-bold ${isExpired ? 'text-red-600' : isExpiring ? 'text-amber-600' : 'text-gray-400'}`}>
                            <CalendarDays className="w-3 h-3 text-current" />
                            Expiry: {new Date(lot.expiryDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                          </div>
                        ) : (
                          <div className="text-[10px] font-mono text-gray-300">No expiration date limit</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQRForModal(lot);
                            setScanSimulatorLogs([
                              `[${new Date().toLocaleTimeString()}] 🔍 QR Passport Scanner initialized for Lot: ${lot.lotNumber}`,
                              `[${new Date().toLocaleTimeString()}] Ready for scan simulation...`
                            ]);
                          }}
                          className="group text-left block p-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-indigo-250 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          title="Open Interactive QR Code Passport and Scanner Simulator"
                        >
                          <div className="flex items-center gap-2.5">
                            {/* Visual procedural QR */}
                            <div className="w-8 h-8 shrink-0 bg-white border border-slate-205 group-hover:border-indigo-400 p-0.5 rounded-sm transition-transform group-hover:scale-105">
                              <VisualQRCode value={lot.barcodeValue} size={15} />
                            </div>
                            <div>
                              <div className="text-[10px] font-mono text-indigo-950 font-bold block leading-none flex items-center gap-1">
                                <QrCode className="w-3 h-3 text-indigo-600" />
                                <span>FIFO QR Code</span>
                              </div>
                              <div className="text-[10px] font-mono font-bold text-slate-700 mt-1 block">
                                {lot.barcodeValue}
                              </div>
                            </div>
                          </div>
                        </button>
                        {isExpired && (
                          <span className="block mt-1 text-[9px] text-red-600 bg-red-50 px-1 py-0.2 px-1.5 rounded w-max font-bold font-mono">⚠️ EXPIRED LOT</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && lot.quantityRemaining > 0 && (
                            <button
                              onClick={() => handleOpenAdjust(lot)}
                              title="Dispense / Adjust Volume"
                              className="p-1.5 hover:bg-emerald-50 hover:text-emerald-600 text-gray-400 rounded-md transition-colors cursor-pointer"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleOpenEdit(lot)}
                              title="Edit Lot Data"
                              className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-gray-400 rounded-md transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you absolutely sure you want to purge Lot "${lot.lotNumber}" from the database ledgers?`)) {
                                  onDeleteLot(lot.id);
                                }
                              }}
                              title="Delete Lot Log"
                              className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-gray-400 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* MODAL: ADD NEW STOCK LOT */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-md font-bold text-gray-900">Declare Inbound FIFO Stock Lot</h2>
                <p className="text-xs text-gray-400">Add a trackable batch receipt with unique lot number and barcode metrics</p>
              </div>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateLot}>
              <div className="p-5 space-y-4">
                {/* Catalog Item */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Select Catalog Product *</label>
                  <select
                    value={lotForm.itemId}
                    onChange={(e) => setLotForm({ ...lotForm, itemId: e.target.value })}
                    required
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium text-gray-800"
                  >
                    <option value="" disabled>-- Under surveillance catalog item --</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        {it.name} [{it.sku}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Warehouse Location select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Storage Facility Placement *</label>
                  <select
                    value={lotForm.warehouseId}
                    onChange={(e) => setLotForm({ ...lotForm, warehouseId: e.target.value })}
                    required
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  >
                    <option value="" disabled>-- Target warehouse --</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lot Number + Barcode */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Lot ID / Number Code *</label>
                    <input
                      type="text"
                      value={lotForm.lotNumber}
                      onChange={(e) => setLotForm({ ...lotForm, lotNumber: e.target.value })}
                      required
                      placeholder="e.g. LOT-A89230"
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Lot Barcode Value</label>
                    <input
                      type="text"
                      value={lotForm.barcodeValue}
                      onChange={(e) => setLotForm({ ...lotForm, barcodeValue: e.target.value })}
                      placeholder="Auto if empty"
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Quantities */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Quantity Received *</label>
                    <input
                      type="number"
                      min={1}
                      value={lotForm.quantityReceived}
                      onChange={(e) => {
                        const qty = Math.max(1, parseInt(e.target.value) || 0);
                        setLotForm({ ...lotForm, quantityReceived: qty, quantityRemaining: qty });
                      }}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5 bg-gray-50 px-3 py-1.5 border border-dashed border-gray-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase">Quantity Remaining</div>
                      <div className="text-sm font-extrabold text-gray-900 font-mono">{lotForm.quantityRemaining}</div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Date Received *</label>
                    <input
                      type="date"
                      value={lotForm.dateReceived}
                      onChange={(e) => setLotForm({ ...lotForm, dateReceived: e.target.value })}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={lotForm.expiryDate}
                      onChange={(e) => setLotForm({ ...lotForm, expiryDate: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-medium text-amber-700"
                    />
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
                  Create Lot Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STOCK LOT */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-md font-bold text-gray-900">Edit FIFO Lot Core Metadata</h2>
                <p className="text-xs text-gray-400 font-mono">Lot Target: {focusedLot?.lotNumber}</p>
              </div>
              <button 
                onClick={() => setIsEditOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEditLot}>
              <div className="p-5 space-y-4">
                {/* Catalog Item / WH info is non-editable during edit (locked to batch) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-400 font-semibold uppercase font-mono">Catalog Product (Locked)</label>
                    <div className="text-xs font-semibold text-gray-800 p-2 bg-gray-50 rounded border border-gray-100 mt-1">
                      {itemsMap.get(focusedLot?.itemId ?? '')?.name}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-semibold uppercase font-mono">Warehouse Node (Locked)</label>
                    <div className="text-xs font-semibold text-gray-800 p-2 bg-gray-50 rounded border border-gray-100 mt-1">
                      {warehousesMap.get(focusedLot?.warehouseId ?? '')?.name}
                    </div>
                  </div>
                </div>

                {/* Lot Number + Barcode */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Lot ID / Number Code *</label>
                    <input
                      type="text"
                      value={lotForm.lotNumber}
                      onChange={(e) => setLotForm({ ...lotForm, lotNumber: e.target.value })}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Lot Barcode SKU / Hash *</label>
                    <input
                      type="text"
                      value={lotForm.barcodeValue}
                      onChange={(e) => setLotForm({ ...lotForm, barcodeValue: e.target.value })}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Quantities */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Quantity Received *</label>
                    <input
                      type="number"
                      min={1}
                      value={lotForm.quantityReceived}
                      onChange={(e) => setLotForm({ ...lotForm, quantityReceived: Math.max(1, parseInt(e.target.value) || 0) })}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Quantity Remaining *</label>
                    <input
                      type="number"
                      min={0}
                      value={lotForm.quantityRemaining}
                      onChange={(e) => setLotForm({ ...lotForm, quantityRemaining: Math.max(0, parseInt(e.target.value) || 0) })}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-indigo-700 focus:text-indigo-850"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Transaction Date *</label>
                    <input
                      type="date"
                      value={lotForm.dateReceived}
                      onChange={(e) => setLotForm({ ...lotForm, dateReceived: e.target.value })}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={lotForm.expiryDate}
                      onChange={(e) => setLotForm({ ...lotForm, expiryDate: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-medium text-amber-700"
                    />
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
                  Save Batch Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DISPENSE OR ADJUST volume on lot */}
      {isAdjustOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-md font-bold text-gray-900">Direct Batch Release</h2>
                <p className="text-xs text-gray-400 font-mono">Lot: {focusedLot?.lotNumber} • {itemsMap.get(focusedLot?.itemId ?? '')?.name}</p>
              </div>
              <button 
                onClick={() => setIsAdjustOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleApplyAdjustment}>
              <div className="p-5 space-y-4">
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50 text-xs font-mono space-y-1 text-slate-800">
                  <div className="flex justify-between">
                    <span>Batch Initial Size:</span>
                    <span className="font-bold">{focusedLot?.quantityReceived}</span>
                  </div>
                  <div className="flex justify-between text-indigo-700 font-semibold">
                    <span>Current FIFO Remaining:</span>
                    <span className="font-extrabold">{focusedLot?.quantityRemaining} units</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Decrement / Change Mode</label>
                    <select
                      value={adjustForm.type}
                      onChange={(e) => {
                        const typeVal = e.target.value as 'dispense' | 'adjust';
                        setAdjustForm({ 
                          ...adjustForm, 
                          type: typeVal,
                          quantity: typeVal === 'dispense' ? Math.min(10, focusedLot?.quantityRemaining || 1) : focusedLot?.quantityRemaining || 10
                        });
                      }}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      <option value="dispense">Dispense Stock (Draw)</option>
                      <option value="adjust">Override Balance (Audit)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">
                      {adjustForm.type === 'dispense' ? 'Dispense Amount' : 'New Remaining Balance'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={adjustForm.type === 'dispense' ? focusedLot?.quantityRemaining : undefined}
                      value={adjustForm.quantity}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setAdjustForm({ ...adjustForm, quantity: val });
                      }}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Audit Trail Reason *</label>
                  <input
                    type="text"
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                    required
                    placeholder="e.g., Released to line production..."
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                >
                  {adjustForm.type === 'dispense' ? 'Dispense Now' : 'Save Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INTERACTIVE QR CODE PASSPORT & HANDHELD SCANNER SIMULATOR */}
      {selectedQRForModal && (() => {
        // Find matching item and warehouse details
        const lot = lots.find(l => l.id === selectedQRForModal.id) || selectedQRForModal;
        const itemObj = itemsMap.get(lot.itemId);
        const whObj = warehousesMap.get(lot.warehouseId);
        const isDepleted = lot.quantityRemaining <= 0;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="bg-indigo-950 text-white p-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-sm font-bold font-mono tracking-wider text-left leading-none uppercase">FIFO QR Batch Passport</h3>
                    <p className="text-[10px] text-indigo-250 font-mono text-left mt-0.5">Lot ID: {lot.lotNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedQRForModal(null)}
                  className="text-indigo-200 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-left bg-slate-50/50">
                
                {/* Visual QR & Customizer split row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                  
                  {/* Left Column: Enlarged Interactive QR Card */}
                  <div className="md:col-span-6 bg-white p-6 rounded-2xl border border-slate-200/85 shadow-sm flex flex-col items-center justify-center space-y-4">
                    <div className={`p-4 border border-indigo-100/50 rounded-2xl bg-indigo-50/10 w-44 h-44 flex items-center justify-center ${qrColor} transition-colors duration-150`}>
                      <VisualQRCode value={lot.barcodeValue} size={qrSize} />
                    </div>
                    <div className="text-center space-y-1.5 w-full">
                      <span className="text-[10px] uppercase font-mono bg-slate-100 px-2 py-0.5 rounded font-black text-slate-500 tracking-wider">
                        {lot.barcodeValue}
                      </span>
                      <p className="text-[9px] text-gray-400 font-sans">
                        Scan with active laser terminal to draw-down stock
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Customizer & Quick Diagnostics */}
                  <div className="md:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/85 shadow-sm flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <span className="text-[10px] uppercase font-bold text-indigo-900 font-mono tracking-widest block font-sans">
                        🛠️ Code Customizers
                      </span>
                      
                      {/* Color Option */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 block font-mono uppercase">QR Code Theme</label>
                        <select
                          value={qrColor}
                          onChange={(e) => setQrColor(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-250 bg-white rounded-lg focus:outline-hidden text-slate-800 font-semibold"
                        >
                          <option value="text-slate-900">Classic Charcoal</option>
                          <option value="text-indigo-650">Active Indigo</option>
                          <option value="text-emerald-750">Emerald Forest</option>
                          <option value="text-amber-600">Gold Amber</option>
                          <option value="text-rose-600">Crimson Security</option>
                        </select>
                      </div>

                      {/* Density / Size Grid Option */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <label className="font-extrabold text-slate-400 font-mono uppercase">Grid Density ({qrSize}x{qrSize})</label>
                          <span className="font-mono text-indigo-650 font-bold">Standard</span>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={31}
                          step={2}
                          value={qrSize}
                          onChange={(e) => setQrSize(Number(e.target.value))}
                          className="w-full text-indigo-650 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer range-xs"
                        />
                      </div>
                    </div>

                    {/* Traceability Details */}
                    <div className="border-t border-slate-200/80 pt-3.5 space-y-2">
                      <span className="text-[10px] font-bold text-slate-450 font-mono block uppercase">Traceability links</span>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600">
                        <div className="bg-slate-55 p-1.5 rounded border border-slate-200">
                          <span className="text-[8px] text-slate-400 block font-bold">PO LINK</span>
                          <span className="text-slate-900 font-bold">{lot.poNumber || 'PO-LINKED'}</span>
                        </div>
                        <div className="bg-slate-55 p-1.5 rounded border border-slate-200">
                          <span className="text-[8px] text-slate-400 block font-bold">GR LINK</span>
                          <span className="text-slate-900 font-bold">{lot.grNumber || 'GR-LINKED'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-Section 1: General Specs Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-3xs grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-gray-400 block uppercase font-bold">Catalog Component</span>
                    <strong className="text-slate-900 block text-xs">{itemObj?.name || 'Item'}</strong>
                    <span className="text-[10px] text-gray-400 font-mono">SKU: {itemObj?.sku}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-gray-400 block uppercase font-bold">Inbound Location</span>
                    <strong className="text-slate-900 block text-xs">{whObj?.name || 'Warehouse Location'}</strong>
                    <span className="text-[10px] text-gray-400 font-mono">Code: {whObj?.code}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-gray-400 block uppercase font-bold">Lot Inventory Balance</span>
                    {isDepleted ? (
                      <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 inline-block font-mono">DEPLETED STOCK</span>
                    ) : (
                      <>
                        <strong className="text-emerald-700 font-mono block text-xs">{lot.quantityRemaining} of {lot.quantityReceived} available</strong>
                        <span className="text-[10px] text-gray-400 block font-sans">Queue Rank: FIFO priority</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Sub-Section 2: HANDHELD QR SCANNER SIMULATOR TERMINAL */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg text-left space-y-4 font-mono select-none">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-1.5 flex-row">
                      <Terminal className="w-4 h-4 text-emerald-400 animate-pulse animate-none" />
                      <span className="text-[10px] uppercase font-extrabold text-slate-300 font-mono tracking-widest">
                        Handheld Laser Scanner Simulator
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      SYS ONLINE
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    
                    {/* Scanner Console Log */}
                    <div className="md:col-span-7 bg-black p-3 rounded-lg border border-slate-900 h-28 overflow-y-auto text-[10px] text-emerald-500/90 font-mono scrollbar-thin">
                      {scanSimulatorLogs.map((logStr, lIdx) => (
                        <div key={lIdx} className="leading-relaxed">
                          <span className="text-[8px] text-emerald-700 mr-1.5">&gt;</span>
                          {logStr}
                        </div>
                      ))}
                    </div>

                    {/* Trigger Button column */}
                    <div className="md:col-span-5 text-center flex flex-col justify-center h-full">
                      {isDepleted ? (
                        <div className="p-3 bg-red-950/40 border border-red-900/50 text-red-500 text-[10px] rounded-lg font-bold font-mono">
                          ❌ Cannot Scan: Lot depleted. FIFO balance is 0. Please select another lot.
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            // Deduct 1 unit in real-time
                            onAdjustLotStock(lot.id, "dispense", 1, "Handheld QR scanner trigger simulation");
                            
                            // Beep/Log simulator
                            const logTime = new Date().toLocaleTimeString();
                            setScanSimulatorLogs(prev => [
                              ...prev,
                              `[${logTime}] 📲 SCAN TRIGGERED: laser decoding successful.`,
                              `[${logTime}] Match key "${lot.barcodeValue}"`,
                              `[${logTime}] FIFO dispatch command sent. Dispensed exactly -1 unit.`,
                              `[${logTime}] Database balance synced. Lot Remaining: ${lot.quantityRemaining - 1} ${itemObj?.unit || 'pcs'}.`
                            ]);
                          }}
                          className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-750 text-white font-extrabold font-mono text-xs rounded-xl shadow-md cursor-pointer transition-all active:translate-y-0.5 flex items-center justify-center gap-2 border border-emerald-505"
                        >
                          <Volume2 className="w-4 h-4 animate-bounce shrink-0" />
                          <span>SIMULATE SCAN DEVICE (-1)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              </div>
              
              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-slate-200 flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedQRForModal(null)}
                  className="px-4 py-2 bg-indigo-950 hover:bg-indigo-900 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer uppercase"
                >
                  Dismiss Passport
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
