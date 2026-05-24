/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { Item, Warehouse, PurchaseOrder, SalesOrder, InventoryTransaction } from '../types';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  ShoppingBag, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  ClipboardList, 
  ArrowRightLeft,
  DollarSign,
  Activity,
  ChevronRight,
  Boxes,
  Scan,
  Camera,
  X,
  Search,
  Grid,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  items: Item[];
  warehouses: Warehouse[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  transactions: InventoryTransaction[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({
  items,
  warehouses,
  purchaseOrders,
  salesOrders,
  transactions,
  onNavigate
}: DashboardProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('All');

  // Barcode / Scanner States
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanQuery, setScanQuery] = useState('');
  const [scannerFeedback, setScannerFeedback] = useState('');
  const [scanHistory, setScanHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('inv_scan_history');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Heatmap interactive state
  const [hoveredHeatmapItemId, setHoveredHeatmapItemId] = useState<string | null>(null);
  const [activeHeatmapItem, setActiveHeatmapItem] = useState<Item | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    setScannedItem(null);
    setScannerFeedback('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.warn("Video failed to auto-play:", err);
        });
      }
    } catch (err: any) {
      console.warn("Camera init failed:", err);
      setCameraError(
        err.name === 'NotAllowedError' 
          ? 'Access Blocked: Please enable camera/microphone frame permissions in your secure browser settings.' 
          : `Live camera stream is unavailable (${err.message || 'permission denied'}).`
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleBarcodeLookup = (code: string) => {
    const val = code.trim().toLowerCase();
    if (!val) return;
    
    // Find item with matching SKU or sub-properties
    const found = items.find(
      it => it.sku.toLowerCase() === val || 
            it.name.toLowerCase().includes(val) ||
            (it.applicableUnits || '').toLowerCase().includes(val)
    );

    if (found) {
      setScannedItem(found);
      setScannerFeedback(`Success: Located matching asset sku [${found.sku}]`);
      
      const totalStock = Object.values(found.stockByWarehouse || {}).reduce((s, q) => s + q, 0);
      const newEntry = {
        id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        itemId: found.id,
        sku: found.sku,
        name: found.name,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        brand: found.brand,
        category: found.category,
        stockLevel: totalStock,
        reorderPoint: found.reorderPoint,
        unit: found.unit
      };

      setScanHistory(prev => {
        // Avoid duplicate consecutive entries for the same item to keep the log tidy
        if (prev.length > 0 && prev[0].itemId === found.id) {
          return prev;
        }
        const updated = [newEntry, ...prev].slice(0, 15);
        try {
          localStorage.setItem('inv_scan_history', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    } else {
      setScannedItem(null);
      setScannerFeedback(`No records matching "${code}" in active catalogs.`);
    }
  };

  // Calculates total stock for an item in all or a specific warehouse
  const getItemStockForWarehouse = (item: Item, whId: string) => {
    if (whId === 'All') {
      return Object.values(item.stockByWarehouse || {}).reduce((s, q) => s + q, 0);
    }
    return item.stockByWarehouse?.[whId] || 0;
  };

  // Compute stats based on chosen warehouse
  const stats = useMemo(() => {
    let skuCount = 0;
    let totalStockUnits = 0;
    let totalAssetValuation = 0; // standard valuation (selling)
    let totalCostValuation = 0;   // expense valuation (cost)
    let lowStockCount = 0;

    items.forEach(item => {
      if (item.status !== 'Active') return;
      skuCount++;
      const itemStock = getItemStockForWarehouse(item, selectedWarehouseId);
      totalStockUnits += itemStock;
      totalAssetValuation += itemStock * item.sellingPrice;
      totalCostValuation += itemStock * item.purchasePrice;

      // Low stock check
      if (itemStock < item.reorderPoint) {
        lowStockCount++;
      }
    });

    // Active PO count
    const activePOs = purchaseOrders.filter(po => 
      po.status !== 'Received' && po.status !== 'Cancelled' &&
      (selectedWarehouseId === 'All' || po.warehouseId === selectedWarehouseId)
    ).length;

    // Active SO count
    const activeSOs = salesOrders.filter(so => 
      so.status !== 'Received' && so.status !== 'Cancelled' &&
      (selectedWarehouseId === 'All' || so.warehouseId === selectedWarehouseId)
    ).length;

    return {
      skuCount,
      totalStockUnits,
      totalAssetValuation,
      totalCostValuation,
      lowStockCount,
      activePOs,
      activeSOs
    };
  }, [items, selectedWarehouseId, purchaseOrders, salesOrders]);

  // Low stock alert list
  const lowStockItemsList = useMemo(() => {
    return items
      .filter(item => item.status === 'Active')
      .map(item => {
        const stock = getItemStockForWarehouse(item, selectedWarehouseId);
        return { item, stock };
      })
      .filter(entry => entry.stock < entry.item.reorderPoint)
      .sort((a,b) => a.stock - b.stock)
      .slice(0, 5);
  }, [items, selectedWarehouseId]);

  // Breakdown of stock by category
  const categoriesBreakdown = useMemo(() => {
    const counts: Record<string, { value: number; units: number }> = {};
    items.forEach(item => {
      if (item.status !== 'Active') return;
      const stock = getItemStockForWarehouse(item, selectedWarehouseId);
      if (!counts[item.category]) {
        counts[item.category] = { value: 0, units: 0 };
      }
      counts[item.category].value += stock * item.sellingPrice;
      counts[item.category].units += stock;
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [items, selectedWarehouseId]);

  // Breakdown of stock by warehouses
  const warehouseBreakdown = useMemo(() => {
    return warehouses
      .filter(w => w.status === 'Active')
      .map(w => {
        let totalUnits = 0;
        let totalVal = 0;
        items.forEach(item => {
          const qty = item.stockByWarehouse?.[w.id] || 0;
          totalUnits += qty;
          totalVal += qty * item.sellingPrice;
        });
        return {
          id: w.id,
          name: w.name,
          code: w.code,
          units: totalUnits,
          value: totalVal
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [items, warehouses]);

  // Recent transactions stream
  const recentActivity = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [transactions]);

  // Low stock counts adjusted for incoming PO and outgoing SO commitments
  const adjustedLowStockCount = useMemo(() => {
    let count = 0;
    items.forEach(item => {
      if (item.status !== 'Active') return;
      const stock = getItemStockForWarehouse(item, selectedWarehouseId);
      
      const incoming = purchaseOrders
        .filter(po => (po.status === 'Issued' || po.status === 'In Transit') && (selectedWarehouseId === 'All' || po.warehouseId === selectedWarehouseId))
        .reduce((sum, po) => {
          const m = po.items?.find((it: any) => it.itemId === item.id);
          return sum + (m?.quantity || 0);
        }, 0);

      const outgoing = salesOrders
        .filter(so => (so.status === 'Confirmed' || so.status === 'On Going') && (selectedWarehouseId === 'All' || so.warehouseId === selectedWarehouseId))
        .reduce((sum, so) => {
          const m = so.items?.find((it: any) => it.itemId === item.id);
          return sum + (m?.quantity || 0);
        }, 0);

      const netStock = stock + incoming - outgoing;
      if (netStock < item.reorderPoint) {
        count++;
      }
    });
    return count;
  }, [items, selectedWarehouseId, purchaseOrders, salesOrders]);

  // Dynamic visual charts drawing calculations
  const categoryMaxVal = Math.max(...categoriesBreakdown.map(c => c.value), 1);
  const warehouseMaxVal = Math.max(...warehouseBreakdown.map(w => w.value), 1);

  return (
    <div className="space-y-6" id="dashboard-portal-view">
      {/* HEADER BAR AND WAREHOUSE CONTROLLER */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-indigo-650" />
            Equiprime Inventory Portal
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Real-time multisite monitoring & logistics management dashboard
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-slate-600 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            Logistics Site:
          </label>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="w-full md:w-56 text-xs bg-white text-slate-800 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-505/50"
            id="warehouse-select-dashboard"
          >
            <option value="All">All Sites (Consolidated)</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* METRIC RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-ribbon">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:border-indigo-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold font-mono">Consolidated Valuation</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-2">
                ₱{stats.totalAssetValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Cost Basis: ₱{stats.totalCostValuation.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-2.5 bg-indigo-500/10 text-indigo-650 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold font-mono">Logistics Physical Stock</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-2">
                {stats.totalStockUnits.toLocaleString()}
              </h3>
              <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1">
                <span className="font-bold">{stats.skuCount}</span> active Catalog SKUs
              </p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:border-amber-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-550 text-[11px] uppercase tracking-wider font-semibold font-mono">Reorder Point Alerts</p>
              <h3 className={`text-2xl font-bold mt-2 ${stats.lowStockCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-750'}`}>
                {stats.lowStockCount}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                SKUs falling below alert limits
              </p>
              <p className="text-[10px] text-rose-600 font-bold mt-1 font-mono">
                Adjusted for PO/SO: {adjustedLowStockCount} SKUs
              </p>
            </div>
            <div className={`p-2.5 rounded-lg ${stats.lowStockCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-550'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:border-sky-500/30 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold font-mono">Pending Commitments</p>
              <h3 className="text-2xl font-bold text-slate-850 mt-2">
                {stats.activePOs + stats.activeSOs}
              </h3>
              <p className="text-[11px] text-sky-600 flex items-center gap-2 mt-1 font-mono">
                <span>Inbound POs: {stats.activePOs}</span>
                <span className="text-slate-350">|</span>
                <span className="text-indigo-600">Outbound SOs: {stats.activeSOs}</span>
              </p>
            </div>
            <div className="p-2.5 bg-sky-100 text-sky-655 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* CONSOLIDATED LOGISTICS STOCK HEALTH HEATMAP MATRIX */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-150 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <Grid className="w-5 h-5 text-indigo-650" />
              Consolidated Stock Health & Web Site Density Heatmap
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Faceted visualization of spatial warehouse utilization coordinates and individual SKU reserve depletion warning grids.
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono shrink-0 text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Well-Stocked</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400" /> Near Reorder Level</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> Critical Alert</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Warehouse capacity density grid */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <h4 className="text-xs font-bold font-mono uppercase text-indigo-700 tracking-wider">📍 Site Capacity Density Audits</h4>
              <p className="text-[10.5px] text-slate-500 mt-0.5">Physical volumetric footprint vs registered limits.</p>
            </div>

            <div className="space-y-3.5">
              {warehouses.map(wh => {
                // Calculate actual items stocked in this warehouse
                const occupiedStock = items.reduce((sum, item) => sum + (item.stockByWarehouse?.[wh.id] || 0), 0);
                const maxCap = wh.maxCapacity || 1000;
                const fillPercent = Math.min(100, Math.round((occupiedStock / maxCap) * 100));

                let densityColor = 'bg-emerald-500';
                let densityText = 'Optimal Room';
                let borderTheme = 'border-slate-200';
                if (fillPercent >= 85) {
                  densityColor = 'bg-rose-500';
                  densityText = 'Critical Footprint';
                  borderTheme = 'border-rose-300 animate-pulse bg-rose-50/10';
                } else if (fillPercent >= 55) {
                  densityColor = 'bg-amber-400';
                  densityText = 'Approaching Grid Cap';
                  borderTheme = 'border-amber-300 bg-amber-50/10';
                }

                return (
                  <div key={wh.id} className={`p-4 bg-slate-50/80 rounded-xl border ${borderTheme} space-y-3`}>
                    <div className="flex justify-between items-baseline">
                      <div>
                        <span className="text-xs font-bold text-slate-850 block truncate">{wh.name}</span>
                        <span className="text-[10px] text-slate-505 block mt-0.5 font-mono">CODE: {wh.code} • Status: {wh.status}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded ${
                          fillPercent >= 85 ? 'bg-rose-100 text-rose-700' :
                          fillPercent >= 55 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {densityText}
                        </span>
                      </div>
                    </div>

                    {/* Progress tracking indicator bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>Used: <b>{occupiedStock.toLocaleString()}</b> / {maxCap.toLocaleString()} {items[0]?.unit || 'pcs'}</span>
                        <span className="font-bold">{fillPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300">
                        <div 
                           className={`h-full rounded-full transition-all duration-500 ${densityColor}`} 
                          style={{ width: `${fillPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* DEFRAGMENTATION GRID MODULE Representing physical sectors */}
                    <div className="grid grid-cols-10 gap-1 pt-1">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const threshold = (idx + 1) * 10;
                        const isSustained = fillPercent >= threshold;
                        return (
                          <div 
                            key={idx} 
                            title={`Sector ${idx + 1}: ${isSustained ? 'Allocated' : 'Available'}`}
                            className={`h-2.5 rounded-xs transition-colors duration-200 ${
                              isSustained 
                                ? fillPercent >= 85 ? 'bg-rose-500' : fillPercent >= 55 ? 'bg-amber-400' : 'bg-emerald-500' 
                                : 'bg-slate-200 border border-slate-300'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: SKU Stock Health Level Contribution-style Grid */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex justify-between items-baseline">
              <div>
                <h4 className="text-xs font-bold font-mono uppercase text-indigo-700 tracking-wider">🎯 Catalog SKU Health Coordinates</h4>
                <p className="text-[10.5px] text-slate-500 mt-0.5">Click any block coordinates cell to review and inspect full SKU stock metrics.</p>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Viewing {items.length} Product SKUs</span>
            </div>

            {/* Continuous contributions graph representation */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-wrap gap-1.5 justify-start">
                {items.map((item) => {
                  const stock = getItemStockForWarehouse(item, selectedWarehouseId);
                  const isBelowReorder = stock < item.reorderPoint;
                  const isApproaching = stock < item.reorderPoint * 1.5 && stock >= item.reorderPoint;
                  
                  let blockBg = 'bg-emerald-500 hover:ring-2 hover:ring-emerald-300 text-white';
                  if (stock === 0) {
                    blockBg = 'bg-rose-200 border border-rose-300 hover:ring-2 hover:ring-rose-400 text-rose-800';
                  } else if (isBelowReorder) {
                    blockBg = 'bg-rose-500 hover:ring-2 hover:ring-rose-300 animate-pulse text-white';
                  } else if (isApproaching) {
                    blockBg = 'bg-amber-400 hover:ring-2 hover:ring-amber-200 text-slate-900';
                  }

                  const isActiveSelected = activeHeatmapItem?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setHoveredHeatmapItemId(item.id)}
                      onClick={() => setActiveHeatmapItem(item)}
                      className={`w-6 h-6 rounded flex items-center justify-center font-mono text-[9px] font-bold transition-all cursor-pointer ${blockBg} ${
                        isActiveSelected ? 'ring-2 ring-slate-800 scale-110 z-10' : ''
                      }`}
                      title={`${item.sku}: ${item.name} (Qty: ${stock})`}
                    >
                      {item.sku.substring(Math.max(0, item.sku.length - 2))}
                    </button>
                  );
                })}
              </div>

              {/* DYNAMIC ITEM DETAIL RETRIEVES INTERACTIVE PANEL */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3 min-h-[90px] flex flex-col justify-center">
                {(() => {
                  // Prioritize click state, fallback to hover, fallback to default hint
                  const activeId = activeHeatmapItem?.id || hoveredHeatmapItemId;
                  const currentItem = items.find(it => it.id === activeId);

                  if (!currentItem) {
                    return (
                      <div className="text-center text-slate-500 text-xs py-3 font-mono">
                        💡 Hover or select/click any SKU square coordinate cell above to load immediate structural telemetry analysis.
                      </div>
                    );
                  }

                  const itemStock = getItemStockForWarehouse(currentItem, selectedWarehouseId);
                  const healthStateText = itemStock === 0 ? 'CRITICAL DEPLETED (0 Qty)' :
                    itemStock < currentItem.reorderPoint ? 'FAIL: Below Reorder Point' :
                    itemStock < currentItem.reorderPoint * 1.5 ? 'WARNING: Low Threshold Warning' : 'HEALTHY: Well Stocked';

                  const healthTextColor = itemStock === 0 ? 'text-rose-600 font-bold' :
                    itemStock < currentItem.reorderPoint ? 'text-rose-500 font-bold animate-pulse' :
                    itemStock < currentItem.reorderPoint * 1.5 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold';

                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-1 text-left">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono">
                            SKU File: {currentItem.sku} {activeHeatmapItem?.id === currentItem.id ? '📍 PINNED' : ''}
                          </span>
                          <h5 className="text-xs font-bold text-slate-850">{currentItem.name}</h5>
                          <span className="text-[9.5px] font-mono text-slate-500">Brand: {currentItem.brand || 'Generic'} • {currentItem.category}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-[10px] font-mono whitespace-nowrap block ${healthTextColor}`}>
                            {healthStateText}
                          </span>
                        </div>
                      </div>

                      {/* Storage breakdown details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 uppercase font-mono text-[9.5px] text-slate-500 border-t border-slate-200 text-left">
                        <div>
                          <span>Consolidated: </span>
                          <strong className="text-slate-800 block">{itemStock} {currentItem.unit}</strong>
                        </div>
                        <div>
                          <span>Reorder Level: </span>
                          <strong className="text-slate-800 block">{currentItem.reorderPoint} {currentItem.unit}</strong>
                        </div>
                        <div>
                          <span>Purchase Price: </span>
                          <strong className="text-slate-800 block">₱{currentItem.purchasePrice.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span>Selling Pricing: </span>
                          <strong className="text-slate-800 block">₱{currentItem.sellingPrice.toFixed(2)}</strong>
                        </div>
                      </div>

                      {/* Display breakdown per warehouse sites and an explicit lookup link */}
                      {activeHeatmapItem?.id === currentItem.id && (
                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[9px] font-mono">
                          <div className="flex gap-2 text-slate-500 truncate max-w-sm">
                            {warehouses.map(w => (
                              <span key={w.id} className="bg-slate-100 border border-slate-200 text-slate-700 tracking-tight select-none px-1 py-0.5 rounded truncate">
                                📍 {w.code}: {currentItem.stockByWarehouse?.[w.id] || 0}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => onNavigate('items')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-[9.5px] text-white px-2.5 py-1 rounded-sm select-none font-bold whitespace-nowrap transition-colors"
                          >
                            Explore Timeline Logs →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </div>
      </div>
      {/* DETAILED STATS BENTO BANNERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ALLOCATION BY CATEGORY (Chart Panel 1) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-650" />
              Asset Value by Category
            </h3>
            <p className="text-slate-505 text-[11px] mt-1">High value segments in the active warehouse selection</p>
            
            <div className="space-y-4 mt-6 text-left">
              {categoriesBreakdown.length === 0 ? (
                <p className="text-slate-500 text-xs italic text-center py-10">No stock allocated to any categories.</p>
              ) : (
                categoriesBreakdown.map((cat, idx) => {
                  const percent = (cat.value / categoryMaxVal) * 100;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 font-medium">{cat.name}</span>
                        <span className="text-indigo-600 font-mono font-bold">₱{cat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-650 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{cat.units.toLocaleString()} active units</span>
                        <span>{((cat.value / Math.max(stats.totalAssetValuation, 1)) * 100).toFixed(0)}% share</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button 
            onClick={() => onNavigate('items')}
            className="w-full text-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs mt-6 border border-slate-200 hover:border-slate-300 font-medium flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            Manage Product Catalog
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* DISTRIBUTION BY SITE (Chart Panel 2) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-650" />
              Warehouse Allocation Breakdown
            </h3>
            <p className="text-slate-505 text-[11px] mt-1">Physical stock load distribution across operating hubs</p>

            <div className="space-y-4 mt-6 text-left">
              {warehouseBreakdown.length === 0 ? (
                <p className="text-slate-500 text-xs italic text-center py-10">No active warehouses setup.</p>
              ) : (
                warehouseBreakdown.map((wh, idx) => {
                  const percent = (wh.value / warehouseMaxVal) * 100;
                  return (
                    <div key={idx} className="space-y-1.5" onClick={() => setSelectedWarehouseId(wh.id)}>
                      <div className="flex justify-between text-xs cursor-pointer group">
                        <span className="text-slate-700 group-hover:text-emerald-700 transition-colors font-medium">{wh.name} ({wh.code})</span>
                        <span className="text-emerald-600 font-mono font-bold">₱{wh.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{wh.units.toLocaleString()} physical units</span>
                        <span>{((wh.value / Math.max(stats.totalAssetValuation, 1)) * 100).toFixed(0)}% workload</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button 
            onClick={() => onNavigate('warehouses')}
            className="w-full text-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs mt-6 border border-slate-200 hover:border-slate-300 font-medium flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            Inspect Warehouse Settings
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* LOW STOCK CRITICAL ALERT LIST */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
              Critical Reorder Levels
            </h3>
            <p className="text-slate-500 text-[11px] mt-1">Immediate action recommended to prevent stocking gaps</p>

            <div className="space-y-3 mt-6 text-left">
              {lowStockItemsList.length === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <div className="text-emerald-600 text-lg font-bold">✓ 100% Secure</div>
                  <p className="text-slate-500 text-xs text-center px-4">All SKU inventory counts reside safely above established reorder trigger levels.</p>
                </div>
              ) : (
                lowStockItemsList.map(({ item, stock }) => {
                  return (
                    <div key={item.id} className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{item.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span className="bg-slate-200 text-slate-700 px-1 rounded font-bold">{item.sku}</span>
                          <span>Reorder Pt: {item.reorderPoint}</span>
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap min-w-[70px]">
                        <div className="text-xs font-bold text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {stock} / {item.reorderPoint}
                        </div>
                        <span className="text-[9px] text-slate-500">Current Qty</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button 
            onClick={() => onNavigate('purchase')}
            className="w-full text-center py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs mt-6 font-bold flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
          >
            Draft Material Inbound order
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* QUICK QUICK ACTION MATRIX (BENTO TILES) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4" id="portal-quick-actions">
        <div 
          onClick={() => onNavigate('items')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
            <Package className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-indigo-650 transition-colors">SKU Catalog</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Stock levels & categories</span>
        </div>

        <div 
          onClick={() => onNavigate('purchase')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-sky-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform">
            <ClipboardList className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-sky-655 transition-colors">Purchase Orders</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Material procurement POs</span>
        </div>

        <div 
          onClick={() => onNavigate('sales')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-emerald-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-emerald-355 transition-colors">Sales Dispatch</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Client SO fulfillment</span>
        </div>

        <div 
          onClick={() => onNavigate('fifo-lots')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-pink-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-pink-50 text-pink-600 rounded-xl group-hover:scale-110 transition-transform">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-pink-650 transition-colors">FIFO Batches</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Lot codes & QR scanner</span>
        </div>

        <div 
          onClick={() => onNavigate('tracking-hub')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-purple-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
            <RefreshCw className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-purple-650 transition-colors">Tracking Hub</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">GR & DR verification docs</span>
        </div>

        <div 
          onClick={() => onNavigate('reports')}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-amber-400 hover:bg-slate-50 transition-all shadow-xs"
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-amber-650 transition-colors">KPI Reports</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Cross-site data analytics</span>
        </div>

        <div 
          onClick={() => {
            setIsScanModalOpen(true);
            setTimeout(startCamera, 80);
          }}
          className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-all shadow-xs relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
          <div className="p-3 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-650 rounded-xl group-hover:scale-110 transition-transform relative">
            <Scan className="w-5 h-5 text-indigo-600" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
          </div>
          <span className="text-xs font-semibold text-slate-800 mt-2.5 group-hover:text-indigo-650 transition-colors">Scan Barcode</span>
          <span className="text-[9px] text-slate-500 mt-0.5 font-mono">Mobile Scanner Sim</span>
        </div>
      </div>

      {/* RECENT ACTIVITY LOGS PANEL */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-5">
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-650" />
              Real-time Inventory Transaction Sync Stream
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">Live logistic state transitions, stocking adjustments and orders lifecycle</p>
          </div>
          <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 border border-indigo-200 rounded font-mono uppercase tracking-widest animate-pulse">● Live Sync</span>
        </div>

        <div id="activity-stream-table" className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-mono uppercase text-slate-505 tracking-wider">
                <th className="py-2.5 px-3">Date / Timestamp</th>
                <th className="py-2.5 px-3">Transaction ID / Reference</th>
                <th className="py-2.5 px-3">SKU - Product Name</th>
                <th className="py-2.5 px-3 font-mono">Type</th>
                <th className="py-2.5 px-3 text-right">Quantity Delta</th>
                <th className="py-2.5 px-3">Logged By</th>
                <th className="py-2.5 px-3">Site Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 italic">No inventory transactions logged yet.</td>
                </tr>
              ) : (
                recentActivity.map((txn, idx) => {
                  const correlatedItem = items.find(it => it.id === txn.itemId);
                  const correlatedWarehouse = warehouses.find(w => w.id === txn.warehouseId);
                  
                  let typeColor = 'text-slate-600 bg-slate-100';
                  let deltaSignStr = '+';
                  let deltaColor = 'text-emerald-700 font-bold';

                  if (txn.type === 'Stock Out' || txn.type === 'Adjustment Deduct') {
                    typeColor = 'text-rose-700 bg-rose-50 border border-rose-200';
                    deltaSignStr = '-';
                    deltaColor = 'text-rose-600 font-bold';
                  } else if (txn.type === 'Stock In' || txn.type === 'Adjustment Add' || txn.type === 'Stock Reversion') {
                    typeColor = 'text-emerald-700 bg-emerald-50 border border-emerald-200';
                    deltaSignStr = '+';
                    deltaColor = 'text-emerald-600 font-bold';
                  } else if (txn.type === 'Transfer Out') {
                    typeColor = 'text-amber-755 bg-amber-50 border border-amber-200';
                    deltaSignStr = '-';
                    deltaColor = 'text-amber-600 font-bold';
                  } else if (txn.type === 'Transfer In') {
                    typeColor = 'text-teal-700 bg-teal-50 border border-teal-200';
                    deltaSignStr = '+';
                    deltaColor = 'text-teal-600 font-bold';
                  }

                  return (
                    <tr key={txn.id || idx} className="hover:bg-slate-50/55 transition-colors">
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-mono">
                        {new Date(txn.date).toLocaleString(undefined, { 
                          year: 'numeric', month: 'short', day: '2-digit', 
                          hour: '2-digit', minute: '2-digit' 
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded text-slate-700 text-[10px] border border-slate-205">
                          {txn.reference || txn.id}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 text-left">
                        {correlatedItem ? (
                          <div className="flex flex-col">
                            <span>{correlatedItem.name}</span>
                            <span className="text-[9px] text-slate-505 font-mono tracking-wider">{correlatedItem.sku}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unknown SKU</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left">
                        <span className={`px-2 py-0.5 text-[9px] rounded font-semibold whitespace-nowrap uppercase tracking-wider ${typeColor}`}>
                          {txn.type}
                        </span>
                      </td>
                      <td className={`py-3 px-3 text-right font-mono ${deltaColor}`}>
                        {deltaSignStr}{txn.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-left">
                        {txn.user || 'System Process'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-left">
                        {correlatedWarehouse ? correlatedWarehouse.name : 'Cross-Site'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SCAN QR / BARCODE CAMERA VIEWPORT LOOKUP MODAL */}
      {isScanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-400 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-100 font-mono tracking-tight">Active Scan Barcode Module</h3>
              </div>
              <button 
                type="button"
                onClick={() => {
                  stopCamera();
                  setIsScanModalOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewfinder & Output log */}
            <div className="p-6 space-y-4">
              
              {/* Media element video stream */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
                {cameraError ? (
                  <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center space-y-3 bg-slate-950/80">
                    <div className="p-2.5 bg-slate-900 rounded-full border border-slate-800 text-slate-500">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">Live Viewport Authorization Blocked</p>
                      <p className="text-[10px] text-slate-500 max-w-xs mt-1 leading-relaxed">
                        Camera permissions are disabled by standard iframe browser sandboxes. Direct barcode search remains active below.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      className="absolute inset-0 w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    
                    {/* Visual Reticle overlays */}
                    <div className="absolute inset-4 border border-dashed border-indigo-500/30 rounded-lg pointer-events-none flex items-center justify-center">
                      <div className="w-44 h-0.5 bg-rose-500/50 shadow shadow-red-500/50 animate-bounce absolute" />
                      <div className="w-40 h-28 border border-rose-500/20 rounded relative" />
                    </div>
                  </>
                )}
              </div>

              {/* BARCODE / SKU INPUT MANUAL ENTRY AND TEST SIMULATOR */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">
                  Scan Simulation & Part Lookup
                </label>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input 
                      type="text"
                      placeholder="Type SKU or part code (e.g., BRK-001)..."
                      value={scanQuery}
                      onChange={(e) => {
                        setScanQuery(e.target.value);
                        handleBarcodeLookup(e.target.value);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  
                  {/* Option helper picker to simulate barcodes quickly */}
                  <select
                    onChange={(e) => {
                      setScanQuery(e.target.value);
                      handleBarcodeLookup(e.target.value);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 text-xs text-slate-400 focus:outline-none"
                  >
                    <option value="">-- Seed Codes --</option>
                    {items.map(it => (
                      <option key={it.id} value={it.sku}>{it.sku} ({it.brand || 'Generic'})</option>
                    ))}
                  </select>
                </div>

                {scannerFeedback && (
                  <p className={`text-[10.5px] font-mono leading-tight ${
                    scannerFeedback.startsWith('Success') ? 'text-emerald-450 border-l border-emerald-500/45 pl-2' : 'text-slate-450'
                  }`}>
                    {scannerFeedback}
                  </p>
                )}
              </div>

              {/* DETAILED RESULTS SUMMARY */}
              {scannedItem && (
                <div className="bg-slate-950 border border-indigo-500/20 rounded-xl p-4 space-y-3 animate-fade-in">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-mono uppercase bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">
                          CATALOG ASSET MATCHED
                        </span>
                        {getItemStockForWarehouse(scannedItem, 'All') < scannedItem.reorderPoint && (
                          <span className="text-[9.5px] font-bold font-mono tracking-wide uppercase bg-rose-500/15 text-rose-400 border border-rose-500/35 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                            ⚠️ Low Stock Alert (Below {scannedItem.reorderPoint})
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 mt-1.5">{scannedItem.name}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">SKU ID: {scannedItem.sku} • {scannedItem.brand || 'N/A Brand'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-300 block">
                        Total Stock
                      </span>
                      <strong className="text-lg font-mono text-emerald-400 font-black block">
                        {getItemStockForWarehouse(scannedItem, 'All')} {scannedItem.unit}
                      </strong>
                    </div>
                  </div>

                  {/* Physical locations split */}
                  <div className="bg-slate-900 rounded-lg p-2.5 border border-slate-850 space-y-1.5">
                    <span className="text-[9px] font-mono text-indigo-300">Site Quantity Breakdown</span>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono leading-tight">
                      {warehouses.map(w => {
                        const qty = scannedItem.stockByWarehouse?.[w.id] || 0;
                        return (
                          <div key={w.id} className="flex justify-between p-1 bg-slate-950 rounded">
                            <span className="text-slate-400 truncate">{w.code}:</span>
                            <strong className={qty > 0 ? 'text-slate-200' : 'text-slate-600'}>{qty} {scannedItem.unit}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions inside scanner modal */}
                  <div className="flex gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setIsScanModalOpen(false);
                        onNavigate('items');
                      }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      Audit Shelf Levels
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setIsScanModalOpen(false);
                        onNavigate('purchase');
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 py-2 rounded-lg transition-colors cursor-pointer border border-slate-700"
                    >
                      Draft Inbound restock
                    </button>
                  </div>
                </div>
              )}

              {/* PERSISTENT SCAN HISTORY LOG */}
              <div className="pt-4 border-t border-slate-850 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                    🕒 Scan History Log ({scanHistory.length})
                  </span>
                  {scanHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setScanHistory([]);
                        try {
                          localStorage.setItem('inv_scan_history', JSON.stringify([]));
                        } catch (_) {}
                      }}
                      className="text-[9px] font-mono text-slate-500 hover:text-rose-400 transition-colors cursor-pointer bg-transparent border-none"
                    >
                      Clear Log
                    </button>
                  )}
                </div>

                {scanHistory.length === 0 ? (
                  <p className="text-[10px] font-mono text-slate-500 italic">
                    No items searched or scanned in this session.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {scanHistory.map((entry) => {
                      const associatedItem = items.find((it) => it.id === entry.itemId) || {
                        ...entry,
                        stockByWarehouse: { All: entry.stockLevel }
                      };
                      const liveStock = Object.values((associatedItem.stockByWarehouse || {}) as Record<string, number>).reduce((s, q) => s + Number(q), 0);
                      const isLow = liveStock < associatedItem.reorderPoint;

                      return (
                        <div
                          key={entry.id}
                          onClick={() => {
                            const fullItem = items.find((it) => it.id === entry.itemId);
                            if (fullItem) {
                              setScannedItem(fullItem);
                              setScanQuery(fullItem.sku);
                              setScannerFeedback(`Loaded from history: ${fullItem.sku}`);
                            }
                          }}
                          className={`p-2.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between border ${
                            scannedItem?.id === entry.itemId
                              ? 'bg-indigo-950/20 border-indigo-500/40'
                              : 'bg-slate-900/60 border-slate-850 hover:border-slate-800 hover:bg-slate-900'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-bold text-slate-200">
                                {entry.sku}
                              </span>
                              <span className="text-[9px] font-mono text-slate-500">
                                {entry.timestamp}
                              </span>
                            </div>
                            <h5 className="text-[10.5px] font-medium text-slate-400 truncate mt-0.5">
                              {entry.name}
                            </h5>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`text-[10px] font-mono font-bold block ${
                                isLow ? 'text-amber-500' : 'text-emerald-450'
                              }`}
                            >
                              {liveStock} {associatedItem.unit || 'Pcs'}
                            </span>
                            {isLow && (
                              <span className="text-[8px] font-bold font-mono text-rose-400 uppercase tracking-tight block">
                                ⚠️ Low
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Footer informational context */}
            <div className="bg-slate-950 p-3 text-[9.5px] text-slate-500 font-mono text-center border-t border-slate-850">
              💡 Point device lens at component barcode plates to parse warehouse files.
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
