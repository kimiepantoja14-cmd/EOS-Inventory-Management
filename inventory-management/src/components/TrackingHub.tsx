/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Central Tracking Ledgers Hub for Goods Receipts (GRs) and Delivery Receipts (DRs).
 */

import React, { useState } from 'react';
import { PurchaseOrder, SalesOrder, Item, Warehouse, Supplier, StockLot, ExplicitGoodsReceipt, ExplicitDeliveryReceipt } from '../types';
import { 
  FileText, FileCheck, Search, Filter, Printer, X, Eye, 
  ArrowUpRight, ArrowDownLeft, Building, Clipboard, Calendar, Trash2
} from 'lucide-react';

interface TrackingHubProps {
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  items: Item[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  lots: StockLot[];
  explicitGoodsReceipts?: ExplicitGoodsReceipt[];
  explicitDeliveryReceipts?: ExplicitDeliveryReceipt[];
  onDeleteGoodsReceipt?: (grId: string) => void;
  onDeleteDeliveryReceipt?: (drId: string) => void;
}

export default function TrackingHub({
  purchaseOrders,
  salesOrders,
  items,
  warehouses,
  suppliers,
  lots,
  explicitGoodsReceipts = [],
  explicitDeliveryReceipts = [],
  onDeleteGoodsReceipt,
  onDeleteDeliveryReceipt
}: TrackingHubProps) {
  const [docTypeFilter, setDocTypeFilter] = useState<'All' | 'DR' | 'GR'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals view states
  const [activeSOForDR, setActiveSOForDR] = useState<SalesOrder | ExplicitDeliveryReceipt | null>(null);
  const [activePOForGR, setActivePOForGR] = useState<PurchaseOrder | ExplicitGoodsReceipt | null>(null);

  // Helper functions to identify explicit receipt records
  const isExplicitDR = (obj: any): obj is ExplicitDeliveryReceipt => {
    return obj && typeof obj.drNumber === 'string';
  };

  const isExplicitGR = (obj: any): obj is ExplicitGoodsReceipt => {
    return obj && typeof obj.grNumber === 'string';
  };

  // Compile DR Records
  const drRecords = explicitDeliveryReceipts.map(dr => {
    const so = salesOrders.find(s => s.id === dr.soId);
    return {
      id: dr.id,
      docNo: dr.drNumber,
      type: 'DR' as const,
      relatedRef: dr.soNumber,
      partner: so?.customerName || 'Walk-In Customer',
      date: dr.dispatchDate,
      warehouseId: dr.warehouseId,
      logistics: dr.dispatchedBy || 'Logistics Officer',
      total: dr.items.reduce((sum, line) => {
        const soLine = so?.items.find(it => it.itemId === line.itemId);
        const price = soLine?.unitPrice || 0;
        return sum + (line.quantity * price);
      }, 0),
      currency: 'PHP',
      originalObj: dr,
      status: 'DISPATCHED'
    };
  });

  // Compile GR Records
  const grRecords = explicitGoodsReceipts.map(gr => {
    const po = purchaseOrders.find(p => p.id === gr.poId);
    return {
      id: gr.id,
      docNo: gr.grNumber,
      type: 'GR' as const,
      relatedRef: gr.poNumber,
      partner: po?.vendorName || 'Supplier Depot',
      date: gr.receivedDate,
      warehouseId: gr.warehouseId,
      logistics: gr.receivedBy || 'Receiving Officer',
      total: gr.items.reduce((sum, line) => {
        const poLine = po?.items.find(it => it.itemId === line.itemId);
        const cost = poLine?.unitCost || 0;
        return sum + (line.quantity * cost);
      }, 0),
      currency: po?.currency || 'USD',
      originalObj: gr,
      status: 'In Stock'
    };
  });

  // Compile Incoming unreceived POs
  const incomingRecords = purchaseOrders
    .filter(po => po.status !== 'Received' && po.status !== 'Cancelled')
    .map(po => ({
      id: `IN-${po.poNumber.substring(3)}`,
      docNo: `PO-EXP-${po.poNumber.substring(3)}`,
      type: 'GR' as const,
      relatedRef: po.poNumber,
      partner: po.vendorName,
      date: po.deliveryDate || po.orderDate,
      warehouseId: po.warehouseId,
      logistics: `${po.deliveryOption || 'Integrated Carrier'} (EXPECTED)`,
      total: po.total,
      currency: po.currency || 'USD',
      originalObj: po,
      status: 'INCOMING'
    }));

  // Merged Tracking entries
  const allTrackingRecords = [...drRecords, ...grRecords, ...incomingRecords].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const filteredRecords = allTrackingRecords.filter(rec => {
    const matchesType = docTypeFilter === 'All' || rec.type === docTypeFilter;
    const sTerm = searchTerm.toLowerCase();
    const matchesSearch = 
      rec.docNo.toLowerCase().includes(sTerm) ||
      rec.relatedRef.toLowerCase().includes(sTerm) ||
      rec.partner.toLowerCase().includes(sTerm) ||
      rec.logistics.toLowerCase().includes(sTerm);
    return matchesType && matchesSearch;
  });

  const totalDRCount = drRecords.length;
  const totalGRCount = grRecords.length;

  return (
    <div className="space-y-6 text-left">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Delivery & Goods Receipts (DR & GR) Log</h1>
          <p className="text-sm text-gray-500">
            Dedicated auditing system to track dispatched Delivery Receipts (DR) and received Goods Receipts (GR).
          </p>
        </div>
      </div>

      {/* Overview Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-xs">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider font-mono">Dispatched Delivery Receipts</span>
              <h3 className="text-2xl font-extrabold text-indigo-600 font-mono">{totalDRCount} Releases</h3>
            </div>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ArrowUpRight className="w-5 h-5" />
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-mono">Released to buyers and forwarding partners</p>
        </div>

        <div className="bg-white border border-gray-100 p-5 rounded-xl shadow-xs">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider font-mono">Received Goods Receipts</span>
              <h3 className="text-2xl font-extrabold text-emerald-600 font-mono">{totalGRCount} Receivings</h3>
            </div>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ArrowDownLeft className="w-5 h-5" />
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-mono">Stored into warehouses from suppliers</p>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-xl shadow-xs sm:col-span-2 md:col-span-1">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider font-mono">Audit Coverage Status</span>
              <h3 className="text-lg font-bold text-slate-100">100% Secured Vault</h3>
            </div>
            <span className="p-2 bg-slate-800 text-slate-300 rounded-lg">
              <Clipboard className="w-5 h-5" />
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2.5 font-mono">Automatic DR & GR generation enabled</p>
        </div>
      </div>

      {/* Filters & Search workspace */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search receipt code, ref ID, partner. . ."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-gray-50 text-gray-800 rounded-lg border border-gray-105 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white placeholder-gray-400 font-mono"
          />
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 text-xs text-gray-400 font-semibold font-mono">
            <Filter className="w-3.5 h-3.5" />
            <span>Scope:</span>
          </div>

          <div className="inline-flex rounded-lg border border-gray-100 bg-gray-50 p-1 text-xs font-semibold">
            <button
              onClick={() => setDocTypeFilter('All')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${docTypeFilter === 'All' ? 'bg-white text-slate-900 font-extrabold shadow-2xs' : 'text-gray-500 hover:text-slate-800'}`}
            >
              All Documents
            </button>
            <button
              onClick={() => setDocTypeFilter('DR')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${docTypeFilter === 'DR' ? 'bg-indigo-600 text-white font-extrabold shadow-2xs' : 'text-gray-500 hover:text-indigo-650'}`}
            >
              Delivery Receipts (DR)
            </button>
            <button
              onClick={() => setDocTypeFilter('GR')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${docTypeFilter === 'GR' ? 'bg-emerald-600 text-white font-extrabold shadow-2xs' : 'text-gray-500 hover:text-emerald-750'}`}
            >
              Goods Receipts (GR)
            </button>
          </div>
        </div>
      </div>

      {/* Receipts Table List */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto text-[11px] font-sans">
          <table className="min-w-full divide-y divide-gray-150">
            <thead className="bg-slate-50 text-gray-400 font-mono uppercase text-[9px] font-bold">
              <tr className="text-left">
                <th className="px-6 py-3.5">Document Type</th>
                <th className="px-6 py-3.5">Receipt Num</th>
                <th className="px-6 py-3.5 font-mono">Date Filed</th>
                <th className="px-6 py-3.5">Linked Reference</th>
                <th className="px-6 py-3.5">Transacting Client/Supplier</th>
                <th className="px-6 py-3.5">Logistics/Carrier</th>
                <th className="px-6 py-3.5 text-right font-mono">Gross Total</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400 italic">
                    No matching generated Delivery Receipts or Goods Receipts found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => {
                  const isDR = rec.type === 'DR';
                  const wh = warehouses.find(w => w.id === rec.warehouseId);

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3.5 font-bold">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono tracking-wide ${isDR ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
                          {isDR ? 'Outbound DR' : 'Inbound GR'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-gray-900">
                        {rec.docNo}
                      </td>
                      <td className="px-6 py-3.5 font-mono">
                        {rec.date}
                      </td>
                      <td className="px-6 py-3.5 font-mono">
                        {rec.relatedRef}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-slate-800">
                        {rec.partner}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="space-y-0.5">
                          <span className="font-semibold block">{rec.logistics}</span>
                          <span className="text-[9px] text-gray-450 block font-mono">Site: {wh?.name || 'Main Warehouse'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                        {isDR ? `₱${rec.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${rec.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold font-mono uppercase ${
                          rec.status === 'INCOMING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : rec.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : rec.status === 'UNPAID' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            if (isDR) {
                              const originalId = (rec.originalObj as any).id;
                              const soId = (rec.originalObj as any).soId || originalId;
                              const matchingSO = salesOrders.find(s => s.id === soId) || rec.originalObj;
                              setActiveSOForDR(matchingSO as any);
                            } else {
                              const originalId = (rec.originalObj as any).id;
                              const poId = (rec.originalObj as any).poId || originalId;
                              const matchingPO = purchaseOrders.find(p => p.id === poId) || rec.originalObj;
                              setActivePOForGR(matchingPO as any);
                            }
                          }}
                          className="p-1.5 bg-slate-50 text-slate-705 hover:bg-slate-700 hover:text-white rounded transition-colors cursor-pointer"
                          title="Open Document Worksheet Viewer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {rec.status !== 'INCOMING' && (
                          <button
                            onClick={() => {
                              if (isDR) {
                                onDeleteDeliveryReceipt?.(rec.id);
                              } else {
                                onDeleteGoodsReceipt?.(rec.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 text-rose-650 hover:bg-rose-600 hover:text-white rounded transition-colors cursor-pointer"
                            title={isDR ? "Delete Outbound Delivery Receipt" : "Delete Inbound Goods Receipt"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================== */}
      {/* DELIVERY RECEIPT MODAL PREVIEW */}
      {activeSOForDR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-gray-150 w-full max-w-3xl overflow-hidden animate-in fade-in duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold font-mono uppercase tracking-wider">
                  DELIVERY RECEIPT PREVIEW (COMPLIANCE DOCUMENT)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSOForDR(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document sheet */}
            <div id="dr-modal-print-ledger" className="p-8 space-y-6 text-left text-xs bg-white text-slate-800 select-text">
              <div className="flex justify-between items-start border-b border-gray-200 pb-5">
                <div>
                  <h1 className="text-lg font-bold uppercase tracking-tight text-slate-900">
                    PHILIPPINE CODA INDUSTRIES
                  </h1>
                  <p className="text-[10px] text-gray-500 font-mono">
                    Official Central Logistics Release Hub
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    TIN Registration No: 405-192-385-000 • VAT Standard Output
                  </p>
                </div>
                <div className="text-right font-mono">
                  {(() => {
                    const statusVal = (() => {
                      const st = isExplicitDR(activeSOForDR)
                        ? salesOrders.find(s => s.id === activeSOForDR.soId)?.status
                        : activeSOForDR.status;
                      if (!st) return 'In-Transit';
                      if (st === 'Delivered' || st === 'Completed' || st === 'Received') return 'Delivered';
                      if (st === 'Shipped' || st === 'Dispatched' || st === 'Partially Shipped') return 'Shipped';
                      return 'In-Transit';
                    })();
                    const badgeStyles = {
                      'Delivered': 'bg-emerald-100/90 text-emerald-800 border-emerald-300 font-black',
                      'Shipped': 'bg-indigo-100/90 text-indigo-800 border-indigo-300 font-black',
                      'In-Transit': 'bg-amber-100/95 text-amber-800 border-amber-300 font-black'
                    } as Record<string, string>;
                    return (
                      <div className="flex flex-col items-end gap-1 mb-2.5">
                        <span className="text-[8px] uppercase font-black text-slate-400 font-mono tracking-wider">
                          Delivery Status
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-wider ${badgeStyles[statusVal] || badgeStyles['In-Transit']}`}>
                          <span className="relative flex h-1.5 w-1.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusVal === 'Delivered' ? 'bg-emerald-400' : statusVal === 'Shipped' ? 'bg-indigo-400' : 'bg-amber-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${statusVal === 'Delivered' ? 'bg-emerald-500' : statusVal === 'Shipped' ? 'bg-indigo-600' : 'bg-amber-500'}`}></span>
                          </span>
                          {statusVal}
                        </span>
                      </div>
                    );
                  })()}
                  <span className="p-1 px-2 text-[10px] bg-indigo-50/50 text-indigo-700 border border-indigo-150 rounded font-bold uppercase block w-max ml-auto mb-2">
                    Delivery Receipt Doc
                  </span>
                  <div className="text-slate-950 text-sm font-bold">
                    DR NUMBER: <span className="font-extrabold text-indigo-600">{isExplicitDR(activeSOForDR) ? activeSOForDR.drNumber : `DR-${activeSOForDR.soNumber.replace('SO-', '')}`}</span>
                  </div>
                  <div className="text-gray-500 mt-1">
                    Date Released: <span className="font-bold">{isExplicitDR(activeSOForDR) ? activeSOForDR.dispatchDate : (activeSOForDR.shipmentDate || activeSOForDR.orderDate)}</span>
                  </div>
                  <div className="text-gray-400 text-[10px] mt-0.5">
                    Related SO Reference: {activeSOForDR.soNumber}
                  </div>
                </div>
              </div>

              {/* Contracting Parties */}
              <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50/75 border border-slate-100 rounded-lg">
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 font-mono tracking-wider block mb-1">
                    DELIVERY RELEASED TO / CLIENT:
                  </span>
                  <div className="space-y-0.5 font-medium text-slate-850">
                    <strong className="text-indigo-950 font-bold text-xs">
                      {isExplicitDR(activeSOForDR) 
                        ? (salesOrders.find(s => s.id === activeSOForDR.soId)?.customerName || 'Registered Client') 
                        : activeSOForDR.customerName}
                    </strong>
                    <p className="text-gray-500">Logistics dispatch destination point</p>
                    <p className="text-gray-500">Order Purpose Category: <strong className="font-bold text-slate-700 font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">
                      {isExplicitDR(activeSOForDR) 
                        ? (salesOrders.find(s => s.id === activeSOForDR.soId)?.orderPurpose || 'Sales') 
                        : activeSOForDR.orderPurpose || 'Sales'}
                    </strong></p>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 font-mono tracking-wider block mb-1">
                    LOGISTICS SERVICE DISPATCH POINT:
                  </span>
                  <div className="space-y-0.5 font-medium text-slate-850">
                    {(() => {
                      const matchedWh = warehouses.find(w => w.id === activeSOForDR.warehouseId);
                      if (matchedWh) {
                        return (
                          <>
                            <strong className="text-slate-950 font-bold block">{matchedWh.name}</strong>
                            <p className="font-mono text-[10px] text-gray-500">Site Code: {matchedWh.code}</p>
                            <p className="text-gray-500">{matchedWh.location}</p>
                          </>
                        );
                      }
                      return <strong className="text-slate-950">Release Logistics Depot</strong>;
                    })()}
                    <p className="text-[10px] text-indigo-650 font-extrabold mt-1">
                      {isExplicitDR(activeSOForDR) 
                        ? `Dispatched By: ${activeSOForDR.dispatchedBy}` 
                        : `Forwarder Service: ${activeSOForDR.deliveryOption || 'Integrated Carrier'}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Released Items table */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
                  VERIFIED DISPATCH ITEMS SHEET
                </span>
                <table className="min-w-full divide-y divide-gray-200 border border-slate-100 rounded-lg text-xs">
                  <thead className="bg-slate-55 font-mono text-[10px]">
                    <tr className="text-left py-2 font-bold text-gray-500">
                      <th className="px-3 py-2">No.</th>
                      <th className="px-3 py-2">Product SKU</th>
                      <th className="px-3 py-2">Item Description / Special Specs</th>
                      <th className="px-3 py-2 text-center">Batch Lots Allocated</th>
                      <th className="px-3 py-2 text-right">Qty Shipped</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-slate-705">
                    {activeSOForDR.items.map((it, idx) => {
                      const itemObj = items.find(p => p.id === it.itemId);
                      const lotStr = !isExplicitDR(activeSOForDR) && 'lotId' in it && it.lotId ? lots.find(l => l.id === it.lotId)?.lotNumber || 'FIFO LOT' : 'FIFO LOT';

                      return (
                        <tr key={it.itemId} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-mono text-gray-450">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{itemObj?.sku || 'N/A'}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-slate-800">{itemObj?.name || 'Linked SKU Spec'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-[10px] text-indigo-650 font-semibold">{lotStr}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{it.quantity} {itemObj?.unit || 'pcs'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Delivery Receipt Note */}
              <div className="pt-3 border-t border-gray-100 text-right">
                <p className="text-[10px] text-gray-400 italic">
                  Official delivery release document verifying physical quantities and batch codes. Pricing details omitted.
                </p>
              </div>

              {/* Signatures checklist */}
              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-dashed border-gray-250 text-center text-[10px]">
                <div className="space-y-4">
                  <span className="text-gray-400 uppercase tracking-widest block font-mono text-[8px]">LOGISTICS DISPATCH OFFICER</span>
                  <div className="border-b border-slate-350 mx-4 h-6 pt-1">
                    <span className="font-serif font-semibold italic text-slate-700">Central Logistics Agent</span>
                  </div>
                  <span className="text-gray-500 block font-bold font-mono">Sign-off / Date Dispatched</span>
                </div>

                <div className="space-y-4">
                  <span className="text-gray-400 uppercase tracking-widest block font-mono text-[8px]">FREIGHT RUNNER COURIER</span>
                  <div className="border-b border-slate-350 mx-4 h-6 pt-1" />
                  <span className="text-gray-500 block font-bold font-mono">Forwarder Representative Signature</span>
                </div>

                <div className="space-y-4">
                  <span className="text-gray-400 uppercase tracking-widest block font-mono text-[8px]">CLIENT RECIPIENT END USER</span>
                  <div className="border-b border-slate-350 mx-4 h-6 pt-1" />
                  <span className="text-gray-500 block font-bold font-mono">Authorized Corporate Signatory</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 p-3.5 border-t border-gray-150 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 block font-mono">
                Philippine compliance Delivery Slip (Non-invoice internal logistics receipt).
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1 uppercase"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSOForDR(null)}
                  className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded transition-colors cursor-pointer uppercase"
                >
                  Close Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* GOODS RECEIPT MODAL PREVIEW */}
      {activePOForGR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-gray-150 w-full max-w-3xl overflow-hidden animate-in fade-in duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold font-mono uppercase tracking-wider">
                  GOODS RECEIPT PREVIEW (COMPLIANCE DOCUMENT)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActivePOForGR(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document sheet */}
            <div id="gr-modal-print-ledger" className="p-8 space-y-6 text-left text-xs bg-white text-slate-800 select-text">
              <div className="flex justify-between items-start border-b border-gray-200 pb-5">
                <div>
                  <h1 className="text-lg font-bold uppercase tracking-tight text-slate-900">
                    PHILIPPINE CODA INDUSTRIES
                  </h1>
                  <p className="text-[10px] text-gray-500 font-mono">
                    Official Central Logistics Release Hub
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    TIN Registration No: 405-192-385-000 • VAT Standard Output
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="p-1 px-2 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold uppercase block w-max ml-auto mb-1.5">
                    Goods Receipt Received
                  </span>
                  <div className="text-slate-950 text-sm font-bold">
                    GR NUMBER: <span className="font-extrabold text-emerald-600">{isExplicitGR(activePOForGR) ? activePOForGR.grNumber : `GR-${activePOForGR.poNumber.replace('PO-', '')}`}</span>
                  </div>
                  <div className="text-gray-500 mt-1">
                    Date Received: <span className="font-bold">{isExplicitGR(activePOForGR) ? activePOForGR.receivedDate : (activePOForGR.actualDeliveryDate || activePOForGR.deliveryDate)}</span>
                  </div>
                  <div className="text-gray-400 text-[10px] mt-0.5">
                    Related PO Reference: {activePOForGR.poNumber}
                  </div>
                </div>
              </div>

              {/* Contracting Parties */}
              <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50/75 border border-slate-100 rounded-lg">
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 font-mono tracking-wider block mb-1">
                    SUPPLIER VENDOR / ORIGIN:
                  </span>
                  <div className="space-y-0.5 font-medium text-slate-850">
                    <strong className="text-indigo-950 font-bold text-xs">
                      {isExplicitGR(activePOForGR) 
                        ? (purchaseOrders.find(p => p.id === activePOForGR.poId)?.vendorName || 'Supplier Depot') 
                        : activePOForGR.vendorName}
                    </strong>
                    {(() => {
                      const poObj = purchaseOrders.find(p => p.id === ('poId' in activePOForGR ? activePOForGR.poId : activePOForGR.id));
                      const matchedSup = suppliers.find(s => s.id === poObj?.supplierId);
                      if (matchedSup) {
                        return (
                          <>
                            <p className="font-mono text-[10px] text-gray-500">TIN: {matchedSup.tin || 'N/A'}</p>
                            <p className="text-gray-500">{matchedSup.contactPerson}</p>
                            <p className="text-gray-400 block text-[10px] truncate">{matchedSup.address}</p>
                          </>
                        );
                      }
                      return <p className="text-gray-400">Supplier linked in database.</p>;
                    })()}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 font-mono tracking-wider block mb-1">
                    DESTINATION WAREHOUSE HUB:
                  </span>
                  <div className="space-y-0.5 font-medium text-slate-850">
                    {(() => {
                      const matchedWh = warehouses.find(w => w.id === activePOForGR.warehouseId);
                      if (matchedWh) {
                        return (
                          <>
                            <strong className="text-slate-950 font-bold block">{matchedWh.name}</strong>
                            <p className="font-mono text-[10px] text-gray-500">Site Code: {matchedWh.code}</p>
                            <p className="text-gray-500">{matchedWh.location}</p>
                          </>
                        );
                      }
                      return <strong className="text-slate-950">Active Storing Warehouse</strong>;
                    })()}
                    <p className="text-[10px] text-indigo-650 font-extrabold mt-1">
                      {isExplicitGR(activePOForGR) 
                        ? `Received By: ${activePOForGR.receivedBy}` 
                        : `Carrier Link: ${activePOForGR.deliveryOption || 'DHL Express'}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Received Items table */}
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
                  VERIFIED RECEIVING DETAILS LEDGER
                </span>
                <table className="min-w-full divide-y divide-gray-200 border border-slate-100 rounded-lg text-xs">
                  <thead className="bg-slate-50 font-mono text-[10px]">
                    <tr className="text-left py-2 font-bold text-gray-500">
                      <th className="px-3 py-2">No.</th>
                      <th className="px-3 py-2">Product SKU</th>
                      <th className="px-3 py-2">Item Description & Brand Specs</th>
                      <th className="px-3 py-2 text-center">Batch Lots Added</th>
                      <th className="px-3 py-2 text-right">Qty Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-slate-705">
                    {activePOForGR.items.map((it, idx) => {
                      const itemObj = items.find(p => p.id === it.itemId);
                      
                      const relatedLots = (lots || []).filter(l => l.itemId === it.itemId && l.lotNumber.includes(activePOForGR.poNumber.slice(-4)));
                      const lotStr = relatedLots.length > 0 
                        ? relatedLots.map(l => l.lotNumber).join(', ')
                        : `LOT-AUTO-${it.itemId.slice(-4)}`;

                      return (
                        <tr key={it.itemId} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-mono text-gray-450">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{itemObj?.sku || 'N/A'}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-slate-800">{itemObj?.name || 'Linked SKU Spec'}</span>
                            {itemObj?.brand && <span className="block text-[9px] text-gray-400 font-mono">Brand: {itemObj.brand}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-[10px] text-indigo-650 font-semibold">{lotStr}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{it.quantity} {itemObj?.unit || 'pcs'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Status footer gap spacer */}
              <div className="pt-2"></div>

              {/* Signatures checklist */}
              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-dashed border-gray-250 text-center text-[10px]">
                <div className="space-y-4">
                  <span className="text-gray-400 uppercase tracking-widest block font-mono text-[8px]">LOGISTICS RECEIVER OFFICER</span>
                  <div className="border-b border-slate-350 mx-4 h-6 pt-1">
                    <span className="font-serif font-semibold italic text-slate-700">
                      {isExplicitGR(activePOForGR) 
                        ? activePOForGR.receivedBy 
                        : (activePOForGR.statusHistory?.[activePOForGR.statusHistory.length - 1]?.user || 'Warehouse checking crew')}
                    </span>
                  </div>
                  <span className="text-gray-500 block font-bold font-mono">Sign-off / Date Received</span>
                </div>

                <div className="space-y-4">
                  <span className="text-gray-400 uppercase tracking-widest block font-mono text-[8px]">QUALITY CONTROL AUDIT BY</span>
                  <div className="border-b border-slate-350 mx-4 h-6 pt-1" />
                  <span className="text-gray-500 block font-bold font-mono">Quality Assurance In-charge</span>
                </div>

                <div className="space-y-4">
                  <span className="text-gray-400 uppercase tracking-widest block font-mono text-[8px]">AUTHORIZED CENTRAL ADMIN</span>
                  <div className="border-b border-slate-350 mx-4 h-6 pt-1">
                    <span className="font-sans font-bold text-slate-800">John Silverio</span>
                  </div>
                  <span className="text-gray-500 block font-bold font-mono">Operations Approver</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 p-3.5 border-t border-gray-150 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 block font-mono">
                Philippine compliance Goods Receipt (Non-invoice internal logistics document).
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1 uppercase"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePOForGR(null)}
                  className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded transition-colors cursor-pointer uppercase"
                >
                  Close Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
