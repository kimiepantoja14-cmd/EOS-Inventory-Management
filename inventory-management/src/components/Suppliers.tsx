/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState, useEffect, FormEvent, useMemo } from 'react';
import { Supplier, PurchaseOrder } from '../types';
import { Search, Plus, User, Mail, Phone, Calendar, Clock, BarChart3, TrendingUp, DollarSign, X, CheckCircle2, AlertTriangle, ShieldCheck, Download } from 'lucide-react';

interface SuppliersProps {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  onEditSupplier?: (supplier: Supplier) => void;
  onDeleteSupplier?: (id: string) => void;
  canEdit?: boolean;
}

export default function Suppliers({ suppliers, purchaseOrders, onAddSupplier, onEditSupplier, onDeleteSupplier, canEdit = true }: SuppliersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedSupplier, setFocusedSupplier] = useState<Supplier | null>(suppliers[0] || null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Edit State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editSupplierForm, setEditSupplierForm] = useState({
    name: '',
    currency: 'USD',
    exchangeRate: 1.0,
    contactPerson: '',
    email: '',
    phone: '',
    leadTimeDays: 7,
    supplierType: 'International' as 'Local' | 'International'
  });

  // Form State for Add
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    currency: 'USD',
    exchangeRate: 1.0,
    contactPerson: '',
    email: '',
    phone: '',
    leadTimeDays: 7,
    supplierType: 'International' as 'Local' | 'International'
  });

  // Exchange rate live fetching state
  const [isLiveFetching, setIsLiveFetching] = useState(false);
  const [liveRateMsg, setLiveRateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Keep focused supplier updated when parent list changes (e.g., after edits)
  useEffect(() => {
    if (focusedSupplier) {
      const freshest = suppliers.find(s => s.id === focusedSupplier.id);
      if (freshest) {
        setFocusedSupplier(freshest);
      }
    } else if (suppliers.length > 0) {
      setFocusedSupplier(suppliers[0]);
    }
  }, [suppliers]);

  // Fetch live exchange rates from public API
  const handleFetchLiveRate = async (currency: string, updateFormWithRate: (rate: number, source: 'Manual' | 'Auto-Fetched') => void) => {
    if (currency === 'PHP') {
      updateFormWithRate(1.0, 'Manual');
      setLiveRateMsg({ type: 'success', text: 'PHP rate is always 1.00' });
      return;
    }
    
    setIsLiveFetching(true);
    setLiveRateMsg(null);
    
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/PHP');
      if (!response.ok) {
        throw new Error('Connection failed');
      }
      const data = await response.json();
      if (data && data.result === 'success' && data.rates && data.rates[currency] !== undefined) {
        // Since rate in fetched data is how many foreign units = 1 PHP,
        // 1 Foreign Unit = (1 / rates[currency]) PHP
        const rate = Number((1 / data.rates[currency]).toFixed(4));
        updateFormWithRate(rate, 'Auto-Fetched');
        setLiveRateMsg({ type: 'success', text: `Loaded live API rate: 1 ${currency} = ${rate} PHP` });
      } else {
        throw new Error(`Currency code "${currency}" not found in live data.`);
      }
    } catch (error: any) {
      setLiveRateMsg({ type: 'error', text: 'Unable to auto-fetch. Please input the rate manually.' });
    } finally {
      setIsLiveFetching(false);
    }
  };

  // Automatically update suggested exchange rates for convenience on supplier currency select
  const handleCurrencyChange = (curr: string) => {
    let rate = 1.0;
    if (curr === 'EUR') rate = 62.50;
    else if (curr === 'GBP') rate = 73.55;
    else if (curr === 'JPY') rate = 0.3636;
    else if (curr === 'CAD') rate = 42.50;
    else if (curr === 'AUD') rate = 38.50;
    else if (curr === 'INR') rate = 0.70;
    else if (curr === 'SGD') rate = 43.10;

    setSupplierForm(prev => ({
      ...prev,
      currency: curr,
      exchangeRate: rate
    }));
    setLiveRateMsg(null);
  };

  const handleEditCurrencyChange = (curr: string) => {
    let rate = 1.0;
    if (curr === 'EUR') rate = 62.50;
    else if (curr === 'GBP') rate = 73.55;
    else if (curr === 'JPY') rate = 0.3636;
    else if (curr === 'CAD') rate = 42.50;
    else if (curr === 'AUD') rate = 38.50;
    else if (curr === 'INR') rate = 0.70;
    else if (curr === 'SGD') rate = 43.10;

    setEditSupplierForm(prev => ({
      ...prev,
      currency: curr,
      exchangeRate: rate
    }));
    setLiveRateMsg(null);
  };

  // Filter suppliers
  const filteredSuppliers = suppliers.filter(sup => 
    sup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sup.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sup.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper calculation to get order history for a supplier
  const getSupplierPOs = (supplierId: string) => {
    return purchaseOrders.filter(po => po.supplierId === supplierId);
  };

  // Helper calculating actual delivery lead times (completed orders)
  const calculateActualLeadTime = (supplierId: string) => {
    const deliveredPOs = getSupplierPOs(supplierId).filter(
      po => po.status === 'Received' && po.orderDate && po.actualDeliveryDate
    );

    if (deliveredPOs.length === 0) return null;

    let totalDays = 0;
    deliveredPOs.forEach(po => {
      const orderDate = new Date(po.orderDate);
      const deliveryDate = new Date(po.actualDeliveryDate!);
      const diffTime = deliveryDate.getTime() - orderDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      totalDays += Math.max(1, diffDays); // at least 1 day
    });

    return Math.round((totalDays / deliveredPOs.length) * 10) / 10;
  };

  // Global KPIs across all suppliers
  const totalCount = suppliers.length;
  
  const avgDefaultLeadTime = totalCount > 0 
    ? Math.round((suppliers.reduce((sum, s) => sum + s.leadTimeDays, 0) / totalCount) * 10) / 10 
    : 0;

  // Compute all delivered POs to get actual vs default delay metrics
  const allDeliveredPOs = purchaseOrders.filter(po => po.status === 'Received' && po.orderDate && po.actualDeliveryDate);
  const onTimeCount = allDeliveredPOs.filter(po => {
    const sup = suppliers.find(s => s.id === po.supplierId);
    if (!sup) return true;
    const ordDate = new Date(po.orderDate);
    const delDate = new Date(po.actualDeliveryDate!);
    const days = Math.ceil((delDate.getTime() - ordDate.getTime()) / (1000 * 60 * 60 * 24));
    return days <= (po.leadTimeDays || sup.leadTimeDays);
  }).length;

  const onTimePercentage = allDeliveredPOs.length > 0
    ? Math.round((onTimeCount / allDeliveredPOs.length) * 100)
    : 100;

  // Total procurement order spend in USD (base currency)
  const totalProcurementSpendUSD = purchaseOrders
    .filter(po => po.status !== 'Draft')
    .reduce((sum, po) => sum + po.total, 0);

  // Supplier Rankings by PHP spend and actual lead times
  const supplierRankings = useMemo(() => {
    return suppliers.map(sup => {
      const pos = purchaseOrders.filter(po => po.supplierId === sup.id && po.status !== 'Cancelled');
      const totalSpendPHP = pos.reduce((sum, po) => {
        const currencySuffix = po.currency || sup.currency || 'USD';
        const rate = po.exchangeRate || sup.exchangeRate || 1.0;
        let pAmount = po.total || 0;
        if (currencySuffix === 'USD') {
          pAmount = pAmount * rate;
        }
        return sum + pAmount;
      }, 0);

      const avgLeadTime = calculateActualLeadTime(sup.id);

      return {
        supplierId: sup.id,
        name: sup.name,
        currency: sup.currency,
        promisedLeadTime: sup.leadTimeDays,
        actualLeadTime: avgLeadTime !== null ? avgLeadTime : 'No Deliveries',
        totalSpendPHP,
        poCount: pos.length,
        isOverdue: avgLeadTime !== null && avgLeadTime > sup.leadTimeDays
      };
    }).sort((a, b) => b.totalSpendPHP - a.totalSpendPHP);
  }, [suppliers, purchaseOrders]);

  const grandTotalSourcingSpendPHP = useMemo(() => {
    return supplierRankings.reduce((sum, item) => sum + item.totalSpendPHP, 0);
  }, [supplierRankings]);

  const handleExportSupplierLedger = () => {
    // CSV Header row
    const headers = [
      "Rank",
      "Supplier Name",
      "Supplier Base Currency",
      "Client PO Count",
      "Total Sourcing Spend (PHP)",
      "Procurement Share (%)",
      "Promised Lead Time (Days)",
      "Actual Average Lead Time (Days)",
      "Performance Score (Stars)",
      "Performance State"
    ];

    // Map each ranked supplier into a CSV text row
    const rows = supplierRankings.map((element, idx) => {
      const sharePercent = grandTotalSourcingSpendPHP > 0 
        ? ((element.totalSpendPHP / grandTotalSourcingSpendPHP) * 100)
        : 0;

      const leadRatio = typeof element.actualLeadTime === 'number' 
        ? (element.actualLeadTime / element.promisedLeadTime)
        : null;

      let stars = 0;
      let stateLabel = "No Data";
      if (leadRatio !== null) {
        if (leadRatio <= 0.8) { stars = 5; stateLabel = "Perfect Score (Very Fast)"; }
        else if (leadRatio <= 1.0) { stars = 4.5; stateLabel = "Excellent Speed"; }
        else if (leadRatio <= 1.1) { stars = 4; stateLabel = "On-Time Partner"; }
        else if (leadRatio <= 1.25) { stars = 3; stateLabel = "Minor Delays"; }
        else { stars = 1.5; stateLabel = "Latency Warning"; }
      }

      return [
        idx + 1,
        `"${element.name.replace(/"/g, '""')}"`,
        element.currency,
        element.poCount,
        element.totalSpendPHP.toFixed(2),
        sharePercent.toFixed(2) + "%",
        element.promisedLeadTime,
        typeof element.actualLeadTime === 'number' ? element.actualLeadTime.toFixed(1) : "N/A",
        stars,
        stateLabel
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Supplier_Performance_Ledger_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAdd = () => {
    setSupplierForm({
      name: '',
      currency: 'USD',
      exchangeRate: 1.0,
      contactPerson: '',
      email: '',
      phone: '',
      leadTimeDays: 7,
      supplierType: 'International'
    });
    setIsAddOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name) return;

    const initialHistory = [{
      rate: supplierForm.exchangeRate,
      timestamp: new Date().toISOString(),
      source: liveRateMsg && liveRateMsg.type === 'success' ? 'Auto-Fetched' as const : 'Manual' as const
    }];

    onAddSupplier({
      ...supplierForm,
      exchangeRateHistory: initialHistory
    });

    setIsAddOpen(false);
    setLiveRateMsg(null);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplierId(sup.id);
    setEditSupplierForm({
      name: sup.name,
      currency: sup.currency,
      exchangeRate: sup.exchangeRate,
      contactPerson: sup.contactPerson,
      email: sup.email,
      phone: sup.phone,
      leadTimeDays: sup.leadTimeDays,
      supplierType: sup.supplierType || 'International'
    });
    setLiveRateMsg(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingSupplierId) return;

    const existingSup = suppliers.find(s => s.id === editingSupplierId);
    if (!existingSup) return;

    // Check if rate has changed or if history was completely empty
    const rateChanged = existingSup.exchangeRate !== editSupplierForm.exchangeRate;
    let updatedHistory = existingSup.exchangeRateHistory || [];

    if (updatedHistory.length === 0) {
      updatedHistory = [{
        rate: existingSup.exchangeRate,
        timestamp: new Date().toISOString(),
        source: 'Manual' as const
      }];
    }

    if (rateChanged) {
      const source = liveRateMsg && liveRateMsg.type === 'success' ? 'Auto-Fetched' as const : 'Manual' as const;
      updatedHistory = [
          ...updatedHistory,
          {
            rate: editSupplierForm.exchangeRate,
            timestamp: new Date().toISOString(),
            source: source
          }
      ];
    }

    if (onEditSupplier) {
      onEditSupplier({
        ...existingSup,
        name: editSupplierForm.name,
        currency: editSupplierForm.currency,
        exchangeRate: editSupplierForm.exchangeRate,
        contactPerson: editSupplierForm.contactPerson,
        email: editSupplierForm.email,
        phone: editSupplierForm.phone,
        leadTimeDays: editSupplierForm.leadTimeDays,
        supplierType: editSupplierForm.supplierType,
        exchangeRateHistory: updatedHistory
      });
    }

    setIsEditOpen(false);
    setEditingSupplierId(null);
    setLiveRateMsg(null);
  };

  // Selected supplier dynamic data
  const selectedPOs = focusedSupplier ? getSupplierPOs(focusedSupplier.id) : [];
  const actualLeadTime = focusedSupplier ? calculateActualLeadTime(focusedSupplier.id) : null;
  const leadTimeHealth = actualLeadTime !== null && focusedSupplier
    ? actualLeadTime <= focusedSupplier.leadTimeDays
      ? 'Good'
      : actualLeadTime <= focusedSupplier.leadTimeDays + 3
        ? 'Warning'
        : 'Poor'
    : 'No Data';

  return (
    <div className="space-y-6">
      {/* Header section with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Supplier Partnerships</h1>
          <p className="text-sm text-gray-500">Add external supply providers, handle specific transaction currencies, and audit fulfillment lead times.</p>
        </div>
        {canEdit && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-sm font-semibold text-white rounded-lg transition-colors shadow-xs hover:shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Supplier Partner</span>
          </button>
        )}
      </div>

      {/* KPI Stats Widgets Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* TOTAL SUPPLIERS */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-mono">Supplier Count</span>
            <div className="text-xl font-bold text-slate-800">{totalCount} Partner{totalCount !== 1 ? 's' : ''}</div>
          </div>
          <div className="p-2.5 bg-indigo-50 border border-indigo-100/50 rounded-lg text-indigo-500">
            <User className="w-5 h-5" />
          </div>
        </div>

        {/* AVG PROMISED LEAD TIME */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-mono">Avg Backlog Window</span>
            <div className="text-xl font-bold text-slate-800">{avgDefaultLeadTime} Days</div>
          </div>
          <div className="p-2.5 bg-amber-50 border border-amber-100/50 rounded-lg text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* ON-TIME DELIVERY RATE */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between font-sans">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-mono">Fulfillment Rate</span>
            <div className="text-xl font-bold text-emerald-600">{onTimePercentage}% On-Time</div>
          </div>
          <div className="p-2.5 bg-emerald-50 border border-emerald-100/50 rounded-lg text-emerald-500">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* PROCUREMENT VOLUME */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-mono">Procured Ledger</span>
            <div className="text-xl font-bold text-slate-800">₱{totalProcurementSpendUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="p-2.5 bg-teal-50 border border-teal-100/50 rounded-lg text-teal-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SUPPLIER PERFORMANCE BREAKDOWN & RANKINGS SECTION */}
      <div className="bg-white border border-gray-150 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Supplier Performance Leadership Matrix
            </h3>
            <p className="text-xs text-gray-400">Comparing and ranking partners based on cumulative PHP spend and average actual vs promised lead-time latency</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSupplierLedger}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 font-bold font-sans text-white text-[11px] rounded-lg transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Supplier Ledger
            </button>
            <span className="text-[10px] font-bold font-mono text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-100">
              Ranked by PHP Sourcing Volume
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-mono text-[10px] uppercase">
                <th className="py-2.5 pr-4 font-bold">Rank</th>
                <th className="py-2.5 pr-4 font-bold">Supplier Partner</th>
                <th className="py-2.5 pr-4 text-center font-bold">Base Currency</th>
                <th className="py-2.5 pr-4 text-center font-bold">Client PO Volume</th>
                <th className="py-2.5 pr-4 text-right font-bold">Total PHP Spend</th>
                <th className="py-2.5 pr-4 text-right font-bold">Procurement Share</th>
                <th className="py-2.5 pr-4 text-center font-bold">Promised Deliv.</th>
                <th className="py-2.5 pr-4 text-center font-bold">Actual Avg Deliv.</th>
                <th className="py-2.5 text-center font-bold">Performance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {supplierRankings.map((element, index) => {
                const leadRatio = typeof element.actualLeadTime === 'number' 
                  ? (element.actualLeadTime / element.promisedLeadTime)
                  : null;

                let stars = 0;
                let ratingLabel = "No Data Available";
                let ratingColor = "text-slate-400 bg-slate-50";
                let isTopTier = false;

                if (leadRatio !== null) {
                  if (leadRatio <= 0.8) {
                    stars = 5;
                    ratingLabel = "5.0 ★ Perfect Score";
                    ratingColor = "text-emerald-700 bg-emerald-50 border border-emerald-100";
                    isTopTier = true;
                  } else if (leadRatio <= 1.0) {
                    stars = 4.5;
                    ratingLabel = "4.5 ★ Top Tier Speed";
                    ratingColor = "text-teal-700 bg-teal-50 border border-teal-100";
                    isTopTier = true;
                  } else if (leadRatio <= 1.1) {
                    stars = 4;
                    ratingLabel = "4.0 ★ On-Time Partner";
                    ratingColor = "text-indigo-700 bg-indigo-50 border border-indigo-100";
                  } else if (leadRatio <= 1.25) {
                    stars = 3;
                    ratingLabel = "3.0 ★ Minor Delays";
                    ratingColor = "text-amber-700 bg-amber-50 border border-amber-100";
                  } else {
                    stars = 1.5;
                    ratingLabel = "1.5 ★ Latency Warnings";
                    ratingColor = "text-rose-700 bg-rose-50 border border-rose-100";
                  }
                }

                const renderStarsHTML = (num: number) => {
                  if (num === 0) return <span className="text-slate-200 font-mono">☆☆☆☆☆</span>;
                  const full = Math.floor(num);
                  const half = num % 1 !== 0;
                  const empty = 5 - Math.ceil(num);
                  return (
                    <span className="text-amber-500 font-mono text-xs select-none tracking-wider">
                      {'★'.repeat(full)}
                      {half ? '½' : ''}
                      {'☆'.repeat(empty)}
                    </span>
                  );
                };

                const ratingBadge = (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1.5 justify-center">
                      {renderStarsHTML(stars)}
                      {isTopTier && (
                        <span className="px-1.5 py-[1px] bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-white font-extrabold text-[8px] rounded uppercase animate-pulse shadow-3xs tracking-widest leading-none block">
                          🏆 Top-Tier
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider font-mono ${ratingColor}`}>
                      {ratingLabel}
                    </span>
                  </div>
                );

                const sharePercent = grandTotalSourcingSpendPHP > 0 
                  ? ((element.totalSpendPHP / grandTotalSourcingSpendPHP) * 100)
                  : 0;

                const rowHighlightClass = isTopTier 
                  ? "bg-amber-50/20 hover:bg-amber-50/40 border-l-[3px] border-l-amber-400 transition-all" 
                  : "hover:bg-slate-50/40 border-l-[3px] border-l-transparent transition-all";

                return (
                  <tr key={element.supplierId} className={rowHighlightClass}>
                    <td className="py-3 pr-4 font-mono font-bold text-gray-500">
                      {index + 1 === 1 ? '🥇' : index + 1 === 2 ? '🥈' : index + 1 === 3 ? '🥉' : `#${index + 1}`}
                    </td>
                    <td className="py-3 pr-4 text-gray-900 font-bold">{element.name}</td>
                    <td className="py-3 pr-4 text-center text-gray-500 font-mono">{element.currency}</td>
                    <td className="py-3 pr-4 text-center text-gray-800 font-bold">{element.poCount} Orders</td>
                    <td className="py-3 pr-4 text-right text-gray-900 font-mono font-bold font-sans">
                      ₱{element.totalSpendPHP.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 pr-4 text-right text-gray-900 font-mono font-bold font-sans">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[11px]">
                        {sharePercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center text-gray-600 font-mono">{element.promisedLeadTime} Days</td>
                    <td className={`py-3 pr-4 text-center font-mono font-bold ${element.isOverdue ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {typeof element.actualLeadTime === 'number' ? `${element.actualLeadTime.toFixed(1)} Days` : element.actualLeadTime}
                    </td>
                    <td className="py-3 text-center">{ratingBadge}</td>
                  </tr>
                );
              })}
              {supplierRankings.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-gray-400 italic">No suppliers listed to measure performance.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Split Panel Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Suppliers List Column */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden lg:col-span-1">
          {/* List Search */}
          <div className="p-4 border-b border-gray-50 bg-gray-50/20">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search supplier, contact, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-white text-gray-800 rounded-md border border-gray-150 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 font-medium"
              />
            </div>
          </div>

          {/* Ledger Listing */}
          <div className="divide-y divide-gray-100 max-h-[550px] overflow-y-auto">
            {filteredSuppliers.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400 italic">
                No supply partners found matching criteria.
              </div>
            ) : (
              filteredSuppliers.map(sup => {
                const isActive = focusedSupplier?.id === sup.id;
                const poCount = getSupplierPOs(sup.id).length;

                return (
                  <div
                    key={sup.id}
                    onClick={() => setFocusedSupplier(sup)}
                    className={`p-4 cursor-pointer text-left transition-colors ${
                      isActive ? 'bg-indigo-50/40 border-l-4 border-indigo-600' : 'hover:bg-gray-50/40'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-bold text-gray-900 text-sm">{sup.name}</div>
                      <span className={`px-1 rounded text-[8px] font-bold uppercase tracking-wide shrink-0 ${sup.supplierType === 'Local' ? 'bg-green-100 text-green-800' : 'bg-sky-100 text-sky-800'}`}>
                        {sup.supplierType || 'International'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono flex items-center gap-1.5 flex-wrap">
                      <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px] font-bold">{sup.currency}</span>
                      <span>•</span>
                      <span>Target: {sup.leadTimeDays}d lead</span>
                      <span>•</span>
                      <span className="text-gray-500 font-sans">{poCount} Order{poCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Focus Inspector Pane */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-6 lg:col-span-2">
          {focusedSupplier ? (
            <div className="space-y-6">
              {/* Header profile info */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-50 text-left">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-indigo-50 text-indigo-600 rounded">
                      SUP-PARTNER
                    </span>
                    {onEditSupplier && canEdit && (
                      <button
                        onClick={() => handleOpenEdit(focusedSupplier)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
                      >
                        Edit Profile
                      </button>
                    )}
                    {onEditSupplier && onDeleteSupplier && canEdit && <span className="text-gray-300 text-[10px] font-medium">|</span>}
                    {onDeleteSupplier && canEdit && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to remove ${focusedSupplier.name}? All assigned purchase orders will remain intact, but the partner registration will be deleted.`)) {
                            onDeleteSupplier(focusedSupplier.id);
                            setFocusedSupplier(suppliers.find(s => s.id !== focusedSupplier.id) || null);
                          }
                        }}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold transition-colors cursor-pointer"
                      >
                        Delete Partner
                      </button>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{focusedSupplier.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-1">
                    <span className="font-bold text-slate-700 bg-gray-50 border border-gray-150 rounded px-1.5 py-0.5">
                      Currency: {focusedSupplier.currency}
                    </span>
                    <span>•</span>
                    <span>Classification: <strong className="text-indigo-600">{focusedSupplier.supplierType || 'International'}</strong></span>
                    <span>•</span>
                    <span>Rate: 1 {focusedSupplier.currency} = {focusedSupplier.exchangeRate} PHP</span>
                  </div>
                </div>

                {/* Performance metric tag for lead time */}
                <div className="space-y-1 font-mono text-left sm:text-right">
                  <span className="text-[10px] text-gray-400 block tracking-widest uppercase">Lead-Time Health</span>
                  {leadTimeHealth === 'Good' && (
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100/50">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Excellent ({actualLeadTime}d actual)
                    </span>
                  )}
                  {leadTimeHealth === 'Warning' && (
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-100/50 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Minor delays ({actualLeadTime}d actual)
                    </span>
                  )}
                  {leadTimeHealth === 'Poor' && (
                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 text-xs font-bold px-2.5 py-1 rounded-full border border-rose-100/50">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Unhealthy ({actualLeadTime}d actual)
                    </span>
                  )}
                  {leadTimeHealth === 'No Data' && (
                    <span className="text-xs text-gray-400 block font-medium">No delivered history yet</span>
                  )}
                  <span className="text-[10px] text-gray-400 block italic mt-0.5">Promised baseline: {focusedSupplier.leadTimeDays} days</span>
                </div>
              </div>

              {/* Contact Card Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-lg text-xs leading-relaxed text-gray-700 font-medium text-left">
                <div className="space-y-1">
                  <span className="text-gray-400 uppercase tracking-widest text-[9px] block font-mono">Contact Person</span>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold font-sans">
                    <User className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                    <span>{focusedSupplier.contactPerson || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-gray-400 uppercase tracking-widest text-[9px] block font-mono">Email Direct</span>
                  <div className="flex items-center gap-2 text-indigo-650 hover:underline">
                    <Mail className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                    <a href={`mailto:${focusedSupplier.email}`}>{focusedSupplier.email || 'N/A'}</a>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-gray-400 uppercase tracking-widest text-[9px] block font-mono">Telephone</span>
                  <div className="flex items-center gap-2 text-slate-800 font-sans">
                    <Phone className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                    <span>{focusedSupplier.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Historical Exchange Rates Valuation Log */}
              <div className="space-y-3 text-left border-t border-gray-50 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    Exchange Rate History & Multi-currency Valuations
                  </h4>
                  {onEditSupplier && (
                    <button
                      onClick={() => handleOpenEdit(focusedSupplier)}
                      className="text-xs text-indigo-650 hover:underline font-bold cursor-pointer"
                    >
                      Update Rate & View
                    </button>
                  )}
                </div>

                <div className="bg-slate-50/50 border border-slate-100/50 rounded-xl p-4">
                  {/* Modern brief summary of current rate */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-4 pb-3 border-b border-dashed border-gray-200">
                    <div>
                      <span className="text-gray-400 font-bold font-mono uppercase text-[9px] block">Active Book Rate</span>
                      <span className="text-sm font-bold text-slate-800 font-sans">
                        1 {focusedSupplier.currency} = {focusedSupplier.exchangeRate} PHP
                      </span>
                    </div>
                    {focusedSupplier.currency !== 'PHP' && (
                      <div className="text-right">
                        <span className="text-gray-400 font-bold font-mono uppercase text-[9px] block">Relative Purchasing Strength</span>
                        <span className="text-xs font-semibold text-slate-700 bg-white border border-gray-150 rounded px-2 py-0.5 font-mono">
                          1 PHP = {(1 / focusedSupplier.exchangeRate).toFixed(4)} {focusedSupplier.currency}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* List of historical checkpoints */}
                  {(!focusedSupplier.exchangeRateHistory || focusedSupplier.exchangeRateHistory.length === 0) ? (
                    <div className="text-xs text-gray-400 italic py-2 text-center">
                      No registered historical exchange rates found yet. Edits and auto-fetches will build history.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {focusedSupplier.exchangeRateHistory.slice().reverse().map((record, index) => (
                        <div key={index} className="bg-white border border-gray-100 rounded-lg p-2.5 flex items-center justify-between text-[11px] shadow-2xs">
                          <div className="space-y-0.5">
                            <div className="font-bold text-gray-900 font-mono">
                              1 PHP = {record.rate} {focusedSupplier.currency}
                            </div>
                            <div className="text-gray-400 font-mono text-[9px]">
                              {new Date(record.timestamp).toLocaleString(undefined, {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </div>
                          </div>
                          <div>
                            <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full uppercase font-mono ${
                              record.source === 'Auto-Fetched'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50'
                                : 'bg-indigo-50 text-indigo-600 border border-indigo-100/50'
                            }`}>
                              {record.source}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Historic PO Tracking for easily measuring Leadtimes and conversions */}
              <div className="space-y-3.5 text-left">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Procurement history & Leadtime tracking
                </h4>
                
                {selectedPOs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400 bg-gray-50/50 rounded-lg border border-dashed border-gray-150">
                    No purchase orders associated with this supplier yet. Use the "Purchase Orders" panel to issue orders.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-150 max-h-[350px]">
                    <table className="min-w-full divide-y divide-gray-150 text-[11px]">
                      <thead className="bg-gray-50 text-gray-500 font-mono font-bold uppercase text-[9px]">
                        <tr>
                          <th className="px-4 py-3 text-left">PO Reference</th>
                          <th className="px-4 py-3 text-left">Ordered</th>
                          <th className="px-4 py-3 text-left">Delivered</th>
                          <th className="px-4 py-3 text-left">Actual Lead</th>
                          <th className="px-4 py-3 text-right">Orig. Val</th>
                          <th className="px-4 py-3 text-right">Base currency val (PHP)</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                        {selectedPOs.map(po => {
                          let displayActualDays = 'Pending';
                          let actualLeadHealth = 'neutral';
                          
                          if (po.orderDate && po.actualDeliveryDate) {
                            const oDate = new Date(po.orderDate);
                            const dDate = new Date(po.actualDeliveryDate);
                            const calcDays = Math.ceil((dDate.getTime() - oDate.getTime()) / (1000 * 60 * 60 * 24));
                            displayActualDays = `${calcDays} days`;
                            
                            const referenceLead = po.leadTimeDays || focusedSupplier.leadTimeDays;
                            if (calcDays <= referenceLead) {
                              actualLeadHealth = 'good';
                            } else if (calcDays <= referenceLead + 3) {
                              actualLeadHealth = 'warn';
                            } else {
                              actualLeadHealth = 'poor';
                            }
                          }

                          // Convert original value if currency differs
                          const poCurrency = po.currency || 'PHP';
                          const poExchangeRate = po.exchangeRate || 1;
                          const originalTotal = po.total;
                          const phpTotal = poCurrency !== 'PHP' ? po.total * poExchangeRate : po.total;

                           return (
                            <tr key={po.id} className="hover:bg-gray-50/40">
                              <td className="px-4 py-3.5 font-bold font-mono text-indigo-700">{po.poNumber}</td>
                              <td className="px-4 py-3.5 text-gray-500 font-mono">{po.orderDate || 'N/A'}</td>
                              <td className="px-4 py-3.5 text-gray-500 font-mono">{po.actualDeliveryDate || 'N/A'}</td>
                              <td className="px-4 py-3.5 font-bold font-mono">
                                {displayActualDays === 'Pending' ? (
                                  <span className="text-gray-400 italic font-medium">Draft/Issued</span>
                                ) : (
                                  <span className={
                                    actualLeadHealth === 'good' ? 'text-emerald-600' :
                                    actualLeadHealth === 'warn' ? 'text-amber-600' : 'text-rose-600'
                                  }>
                                    {displayActualDays}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-800 font-mono">
                                {originalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {poCurrency}
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-900 font-mono">
                                ₱{phpTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                                  po.status === 'Received' ? 'bg-emerald-50 text-emerald-650' :
                                  po.status === 'Issued' ? 'font-sans bg-amber-50 text-amber-650' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {po.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-gray-400 font-medium">
              No supply partner selected. Add a partner to see lead time logs and currency summaries.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: REGISTER NEW SUPPLIER */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Add Supplier Partner</h2>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Supplier Enterprise Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pilot Corporation Japan"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full text-xs px-3.5 text-slate-800 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* Currency Section & suggested Rate */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Trading Currency</label>
                    <select
                      value={supplierForm.currency}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                    >
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="GBP">GBP (British Pound)</option>
                      <option value="JPY">JPY (Japanese Yen)</option>
                      <option value="CAD">CAD (Canadian Dollar)</option>
                      <option value="AUD">AUD (Australian Dollar)</option>
                      <option value="INR">INR (Indian Rupee)</option>
                      <option value="SGD">SGD (Singapore Dollar)</option>
                      <option value="PHP">PHP (Philippine Peso)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Exchange Rate (1 PHP = ?)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        required
                        value={supplierForm.exchangeRate}
                        onChange={(e) => setSupplierForm({ ...supplierForm, exchangeRate: Math.max(0.0001, parseFloat(e.target.value) || 1.0) })}
                        className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleFetchLiveRate(supplierForm.currency, (rate) => setSupplierForm(prev => ({ ...prev, exchangeRate: rate })))}
                        disabled={isLiveFetching || supplierForm.currency === 'PHP'}
                        className="px-2.5 py-2 text-[10px] whitespace-nowrap bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 disabled:opacity-55 active:bg-indigo-150 text-indigo-700 font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        {isLiveFetching ? '...' : 'Auto-Fetch'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Classification Group Option */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Supplier Classification *</label>
                  <select
                    value={supplierForm.supplierType}
                    onChange={(e) => setSupplierForm({ ...supplierForm, supplierType: e.target.value as 'Local' | 'International' })}
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value="Local">Local (Domestic)</option>
                    <option value="International">International (Overseas)</option>
                  </select>
                </div>

                {liveRateMsg && (
                  <div className={`text-[10px] font-medium leading-tight rounded-md p-2 ${
                    liveRateMsg.type === 'success' ? 'bg-emerald-55/10 text-emerald-700 border border-emerald-100' : 'bg-rose-55/10 text-rose-700 border border-rose-100'
                  }`}>
                    {liveRateMsg.text}
                  </div>
                )}

                <p className="text-[10px] text-gray-400 font-medium leading-relaxed italic">
                  * Dynamic Rate suggestions or Live Auto-Fetch map base USD conversions. Set appropriate contract baseline rates carefully.
                </p>

                {/* Contact name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Partner Key Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kenji Tanaka"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 border border-slate-200 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* Contact Email and Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="tanaka@pilot.jp"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Phone Code / Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="+81 3 5843 1111"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium font-mono"
                    />
                  </div>
                </div>

                {/* Default lead time */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Contracted Base Lead Time (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={supplierForm.leadTimeDays}
                    onChange={(e) => setSupplierForm({ ...supplierForm, leadTimeDays: Math.max(1, parseInt(e.target.value) || 7) })}
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
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
                  Register Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SUPPLIER */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Edit Supplier Partner</h2>
              <button 
                onClick={() => { setIsEditOpen(false); setLiveRateMsg(null); }}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Supplier Enterprise Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pilot Corporation Japan"
                    value={editSupplierForm.name}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, name: e.target.value })}
                    className="w-full text-xs px-3.5 text-slate-800 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* Currency Section & suggested Rate */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Trading Currency</label>
                    <select
                      value={editSupplierForm.currency}
                      onChange={(e) => handleEditCurrencyChange(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                    >
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="GBP">GBP (British Pound)</option>
                      <option value="JPY">JPY (Japanese Yen)</option>
                      <option value="CAD">CAD (Canadian Dollar)</option>
                      <option value="AUD">AUD (Australian Dollar)</option>
                      <option value="INR">INR (Indian Rupee)</option>
                      <option value="SGD">SGD (Singapore Dollar)</option>
                      <option value="PHP">PHP (Philippine Peso)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Exchange Rate (1 PHP = ?)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        required
                        value={editSupplierForm.exchangeRate}
                        onChange={(e) => setEditSupplierForm({ ...editSupplierForm, exchangeRate: Math.max(0.0001, parseFloat(e.target.value) || 1.0) })}
                        className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleFetchLiveRate(editSupplierForm.currency, (rate) => setEditSupplierForm(prev => ({ ...prev, exchangeRate: rate })))}
                        disabled={isLiveFetching || editSupplierForm.currency === 'PHP'}
                        className="px-2.5 py-2 text-[10px] whitespace-nowrap bg-indigo-50 border border-indigo-150 hover:bg-indigo-100 disabled:opacity-55 active:bg-indigo-150 text-indigo-700 font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        {isLiveFetching ? '...' : 'Auto-Fetch'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Classification Group Option */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Supplier Classification *</label>
                  <select
                    value={editSupplierForm.supplierType}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, supplierType: e.target.value as 'Local' | 'International' })}
                    className="w-full text-xs px-3.5 py-2 border border-slate-200 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value="Local">Local (Domestic)</option>
                    <option value="International">International (Overseas)</option>
                  </select>
                </div>

                {liveRateMsg && (
                  <div className={`text-[10px] font-medium leading-tight rounded-md p-2 ${
                    liveRateMsg.type === 'success' ? 'bg-emerald-55/10 text-emerald-700 border border-emerald-100' : 'bg-rose-55/10 text-rose-700 border border-rose-100'
                  }`}>
                    {liveRateMsg.text}
                  </div>
                )}

                <p className="text-[10px] text-gray-400 font-medium leading-relaxed italic">
                  * Note: Changing the active exchange rate triggers a write to this Supplier's history logs for secure PO auditing.
                </p>

                {/* Contact name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Partner Key Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kenji Tanaka"
                    value={editSupplierForm.contactPerson}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, contactPerson: e.target.value })}
                    className="w-full text-xs px-3.5 py-2 border border-slate-200 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                </div>

                {/* Contact Email and Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="tanaka@pilot.jp"
                      value={editSupplierForm.email}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, email: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Phone Code / Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="+81 3 5843 1111"
                      value={editSupplierForm.phone}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, phone: e.target.value })}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium font-mono"
                    />
                  </div>
                </div>

                {/* Default lead time */}
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-semibold text-gray-600">Contracted Base Lead Time (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editSupplierForm.leadTimeDays}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, leadTimeDays: Math.max(1, parseInt(e.target.value) || 7) })}
                    className="w-full text-xs px-3.5 py-2 border border-gray-250 text-slate-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setIsEditOpen(false); setLiveRateMsg(null); }}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                >
                  Save Partner Edits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
