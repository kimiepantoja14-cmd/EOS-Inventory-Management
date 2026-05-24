/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect, ChangeEvent, useRef } from 'react';
import { SalesOrder, Item, Warehouse, SOItem, Customer, StockLot, ExplicitDeliveryReceipt } from '../types';
import { Search, Plus, Eye, Truck, CheckCircle, Ban, X, Trash2, ShieldCheck, FileText, AlertCircle, Edit2, ShieldAlert, Paperclip, MapPin, Tag, Wrench, ClipboardCheck, Printer, Upload, Download } from 'lucide-react';
import { AttachmentRecord } from '../types';

interface SalesOrdersProps {
  salesOrders: SalesOrder[];
  items: Item[];
  warehouses: Warehouse[];
  customers: Customer[];
  onCreateSO: (so: Omit<SalesOrder, 'id' | 'subtotal' | 'tax' | 'total'> & { subtotal: number, tax: number, total: number }) => void;
  onUpdateSOStatus: (soId: string, status: SalesOrder['status']) => void;
  onEditSO: (so: SalesOrder, isRemarkOnly?: boolean) => void;
  canEdit: boolean;
  lots: StockLot[];
  machineLogs?: import('../types').MachineLog[];
  currentUser?: import('../types').UserRecord;
  users?: import('../types').UserRecord[];
  canSeePricing?: boolean;
  onShipSOBatch?: (
    soId: string,
    receiptNumber: string,
    dispatchedBy: string,
    dispatchDate: string,
    notes: string,
    shippedAmounts: Record<string, number>
  ) => void;
  explicitDeliveryReceipts?: any[];
  onDeleteSO?: (soId: string) => void;
  onBatchUpdateSOStatus?: (soIds: string[], status: 'Confirmed' | 'Shipped') => void;
  onDeleteDeliveryReceipt?: (drId: string) => void;
}

export default function SalesOrders({
  salesOrders,
  items,
  warehouses,
  customers,
  onCreateSO,
  onUpdateSOStatus,
  onEditSO,
  canEdit,
  lots,
  machineLogs = [],
  currentUser,
  users = [],
  canSeePricing = true,
  onShipSOBatch,
  explicitDeliveryReceipts = [],
  onDeleteSO,
  onBatchUpdateSOStatus,
  onDeleteDeliveryReceipt,
}: SalesOrdersProps) {
  // UI states
  const [selectedSOIds, setSelectedSOIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [focusedSO, setFocusedSO] = useState<SalesOrder | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [revisingSO, setRevisingSO] = useState<SalesOrder | null>(null);
  const [viewingMachineSerial, setViewingMachineSerial] = useState<string | null>(null);

  // Synchronize focusedSO with updated props when salesOrders changes
  useEffect(() => {
    if (focusedSO) {
      const currentSO = salesOrders.find(s => s.id === focusedSO.id);
      if (currentSO && JSON.stringify(currentSO) !== JSON.stringify(focusedSO)) {
        setFocusedSO(currentSO);
      }
    }
  }, [salesOrders, focusedSO]);

  const [soLogRemarks, setSoLogRemarks] = useState<Record<number, string>>({});

  const handleAppendSoLogRemark = (logIdx: number, text: string) => {
    if (!focusedSO || !text.trim() || !onEditSO) return;
    
    const fallbackHistory = focusedSO.statusHistory && focusedSO.statusHistory.length > 0
      ? [...focusedSO.statusHistory]
      : [
          { status: 'Draft' as const, date: focusedSO.orderDate || new Date().toISOString().split('T')[0], note: 'Sales Order drafted by sales team.', user: 'Operations' }
        ];
      
    if (logIdx >= 0 && logIdx < fallbackHistory.length) {
      const entry = { ...fallbackHistory[logIdx] };
      entry.note = `${entry.note} (${text.trim()})`;
      fallbackHistory[logIdx] = entry;
      
      const updatedSO: SalesOrder = {
        ...focusedSO,
        statusHistory: fallbackHistory
      };
      
      onEditSO(updatedSO, true);
      setFocusedSO(updatedSO);
    }
  };

  const handleExportAuditSO = () => {
    if (!focusedSO) return;
    const historyList = focusedSO.statusHistory && focusedSO.statusHistory.length > 0
      ? focusedSO.statusHistory
      : [
          { status: 'Draft', date: focusedSO.orderDate || new Date().toISOString().split('T')[0], note: 'Sales Order drafted by sales team.', user: 'Operations' }
        ];

    // CSV format: Columns are SO details and the history records
    const headers = ['Sales Order Number', 'Customer', 'Date/Time Stamp', 'Transaction Status', 'Log / Transition Note', 'Operator'];
    const rows = historyList.map(h => [
      focusedSO.soNumber,
      focusedSO.customerName,
      h.date || '',
      h.status,
      h.note || '',
      h.user || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SO_AuditLog_${focusedSO.soNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Form states for Create/Edit SO
  const [soNumber, setSoNumber] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [shipmentDate, setShipmentDate] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [deliveryOption, setDeliveryOption] = useState('Standard Cargo');
  const [forwarderName, setForwarderName] = useState('');
  const [isDeliveryReceiptOpen, setIsDeliveryReceiptOpen] = useState(false);
  const [isCreateReceiptOpen, setIsCreateReceiptOpen] = useState(false);
  const [isPickListOpen, setIsPickListOpen] = useState(false);
  const [selectedDRForView, setSelectedDRForView] = useState<ExplicitDeliveryReceipt | null>(null);
  const [receiptForm, setReceiptForm] = useState<{
    receiptNumber: string;
    dispatchedBy: string;
    dispatchDate: string;
    notes: string;
    serialNumbers: Record<string, string>;
    shippedAmounts: Record<string, number>;
  }>({
    receiptNumber: '',
    dispatchedBy: '',
    dispatchDate: '',
    notes: '',
    serialNumbers: {},
    shippedAmounts: {}
  });

  const handleOpenCreateReceipt = (so: SalesOrder) => {
    const today = new Date().toISOString().split('T')[0];
    const drPrefix = `DR-${so.soNumber.replace('SO-', '')}-${Date.now().toString().slice(-4)}`;
    
    // Default form quantities to 0
    const initialShippedAmounts: Record<string, number> = {};
    const initialSerials: Record<string, string> = {};
    
    so.items.forEach(it => {
      const balance = Math.max(0, it.quantity - (it.shippedQuantity || 0));
      initialShippedAmounts[it.itemId] = 0; // Standard Zoho starts at 0 for user input choice
      initialSerials[it.itemId] = '';
    });

    setReceiptForm({
      receiptNumber: drPrefix,
      dispatchedBy: 'Logistics Supervisor',
      dispatchDate: today,
      notes: 'Shipment dispatched in compliance with sales layout criteria and transit security.',
      serialNumbers: initialSerials,
      shippedAmounts: initialShippedAmounts
    });
    setFocusedSO(so);
    setIsCreateReceiptOpen(true);
  };

  const [notes, setNotes] = useState('');
  
  // Custom states for Machine Serial and Order Purpose (Sales/Warranty)
  const [orderPurpose, setOrderPurpose] = useState<'Sales' | 'Warranty'>('Sales');
  const [machineSerialNumber, setMachineSerialNumber] = useState('');
  
  // Custom tax, discount, region, classification, and attachments
  const [taxType, setTaxType] = useState<'VAT' | 'Non-VAT' | 'Custom' | 'None'>('None');
  const [customTaxRate, setCustomTaxRate] = useState<number>(12);
  const [discountType, setDiscountType] = useState<'Percentage' | 'Fixed' | 'None'>('None');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [region, setRegion] = useState<string>('Head Office');
  const [description, setDescription] = useState<string>('');
  const [salesCategory, setSalesCategory] = useState<'Parts' | 'Services' | 'Both'>('Parts');
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);

  // File system upload handlers
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    const newRecords: AttachmentRecord[] = filesArray.map((f: File) => ({
      id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: f.name,
      size: f.size,
      type: f.type,
      url: '#',
      uploadedAt: new Date().toISOString()
    }));
    setAttachments(prev => [...prev, ...newRecords]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };
  
  // Custom items currently drafted inside SO
  const [draftedItems, setDraftedItems] = useState<(SOItem & { _searchQuery?: string })[]>([
    { itemId: items[0]?.id || '', quantity: 2, unitPrice: items[0]?.sellingPrice || 0, category: 'Parts' }
  ]);

  // Sync focused SO with fresh sales orders list in case of status update
  useEffect(() => {
    if (focusedSO) {
      const match = salesOrders.find(s => s.id === focusedSO.id);
      if (match) {
        setFocusedSO(match);
      }
    }
  }, [salesOrders, focusedSO]);

  // Filtering list
  const filteredSOs = salesOrders.filter(so => {
    const matchedCustomer = customers.find(c => c.id === so.customerId);
    const clientName = matchedCustomer ? matchedCustomer.name : so.customerName;
    const matchSearch = so.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = selectedStatus === 'All' || so.status === selectedStatus;
    const matchCustomer = selectedCustomer === 'All' || so.customerId === selectedCustomer;
    return matchSearch && matchStatus && matchCustomer;
  });

  // Helper: check stock in chosen warehouse
  const checkStockLevel = (itemId: string, targetWhId: string) => {
    const product = items.find(p => p.id === itemId);
    if (!product) return 0;
    return product.stockByWarehouse[targetWhId] || 0;
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

  // Helper validation: any line exceeding available stock?
  const hasInadequateStock = () => {
    return draftedItems.some(row => {
      const stock = checkStockLevel(row.itemId, warehouseId);
      return row.quantity > stock;
    });
  };

  // Calculate Draft Summary
  const calculateDraftTotals = () => {
    const subtotal = draftedItems.reduce((acc, row) => acc + (row.quantity * row.unitPrice), 0);
    
    let discountAmount = 0;
    if (discountType === 'Percentage') {
      discountAmount = subtotal * (discountValue / 100);
    } else if (discountType === 'Fixed') {
      discountAmount = discountValue;
    }
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

    let taxRate = 0.12;
    if (taxType === 'Non-VAT' || taxType === 'None') {
      taxRate = 0;
    } else if (taxType === 'Custom') {
      taxRate = customTaxRate / 100;
    }

    const tax = subtotalAfterDiscount * taxRate;
    const total = subtotalAfterDiscount + tax;

    return { subtotal, discountAmount, subtotalAfterDiscount, tax, total };
  };

  const totals = calculateDraftTotals();

  // Handlers for DraftingItems
  const handleAddItemToDraft = () => {
    const defaultProduct = items[0];
    if (!defaultProduct) return;
    setDraftedItems([
      ...draftedItems,
      { itemId: defaultProduct.id, quantity: 1, unitPrice: defaultProduct.sellingPrice, category: 'Parts' }
    ]);
  };

  const handleUpdateDraftRow = (index: number, fields: Partial<SOItem & { _searchQuery?: string }>) => {
    setDraftedItems(draftedItems.map((row, idx) => {
      if (idx !== index) return row;
      const updatedRow = { ...row, ...fields };
      // Auto-populate unit price when switching itemId
      if (fields.itemId) {
        updatedRow.lotId = undefined; // reset lot select
        const found = items.find(p => p.id === fields.itemId);
        if (found) {
          updatedRow.unitPrice = found.sellingPrice;
        }
      }
      return updatedRow;
    }));
  };

  const handleRemoveDraftRow = (index: number) => {
    if (draftedItems.length === 1) return; // Must have at least one slot
    setDraftedItems(draftedItems.filter((_, idx) => idx !== index));
  };

  const handleOpenDrafting = () => {
    setRevisingSO(null);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setSoNumber(`SO-${new Date().getFullYear()}-${randomSuffix}`);
    setReferenceNo('');
    setCustomerId(customers[0]?.id || '');
    setShipmentDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // 3 days from now
    setWarehouseId(warehouses[0]?.id || '');
    setDeliveryOption('Standard Cargo');
    setForwarderName('');
    setNotes('');
    setDescription('');
    setTaxType('VAT');
    setCustomTaxRate(12);
    setDiscountType('None');
    setDiscountValue(0);
    setRegion('Head Office');
    setSalesCategory('Parts');
    setAttachments([]);
    setOrderPurpose('Sales');
    setMachineSerialNumber('');
    setDraftedItems([
      { itemId: items[0]?.id || '', quantity: 2, unitPrice: items[0]?.sellingPrice || 0 }
    ]);
    setIsFormOpen(true);
  };

  const handleOpenEditDraft = (so: SalesOrder) => {
    if (so.status !== 'Draft') {
      alert("Only 'Draft' status Sales Orders can be edited to prevent inventory discrepancy.");
      return;
    }
    setRevisingSO(so);
    setSoNumber(so.soNumber);
    setReferenceNo(so.referenceNo || '');
    setCustomerId(so.customerId || '');
    setShipmentDate(so.shipmentDate);
    setWarehouseId(so.warehouseId);
    if (so.deliveryOption?.startsWith("Others (Forwarder: ")) {
      setDeliveryOption('Others');
      const startIdx = "Others (Forwarder: ".length;
      const endIdx = so.deliveryOption.lastIndexOf(")");
      setForwarderName(so.deliveryOption.substring(startIdx, endIdx !== -1 ? endIdx : undefined));
    } else if (so.deliveryOption === 'Others') {
      setDeliveryOption('Others');
      setForwarderName('');
    } else {
      setDeliveryOption(so.deliveryOption || 'Standard Cargo');
      setForwarderName('');
    }
    setNotes(so.notes);
    setDescription(so.description || '');
    setTaxType(so.taxType || 'None');
    setCustomTaxRate(so.customTaxRate || 12);
    setDiscountType(so.discountType || 'None');
    setDiscountValue(so.discountValue || 0);
    setRegion(so.salesCluster || so.region || 'Head Office');
    setSalesCategory(so.salesCategory || 'Parts');
    setAttachments(so.attachments || []);
    setOrderPurpose(so.orderPurpose || 'Sales');
    setMachineSerialNumber(so.machineSerialNumber || '');
    setDraftedItems(so.items);
    setIsFormOpen(true);
  };

  const handleSubmitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!customerId || draftedItems.length === 0 || hasInadequateStock()) return;

    // Validate FIFO violations across all lines
    const violations: string[] = [];
    draftedItems.forEach((line) => {
      if (line.lotId) {
        const violation = getFifoViolation(line.itemId, warehouseId, line.lotId);
        if (violation.violated && violation.selected && violation.oldest) {
          const itemPr = items.find(p => p.id === line.itemId);
          violations.push(
            `- Product: "${itemPr?.name}"\n  Selected Lot: "${violation.selected.lotNumber}"\n  Oldest Lot Available: "${violation.oldest.lotNumber}" (received on ${violation.oldest.dateReceived})`
          );
        }
      }
    });

    if (violations.length > 0) {
      const confirmOverride = window.confirm(
        `⚠️ FIFO STOCKING RULE VIOLATION DETECTED!\n\n` +
        `Saving this order will associate it with lots that violate First In, First Out (FIFO) priorities:\n\n` +
        violations.join('\n\n') +
        `\n\nAre you sure you want to OVERRIDE and permit this selection anyway?`
      );
      if (!confirmOverride) {
        return; // Halt submission!
      }
    }

    const chosenCustName = customers.find(c => c.id === customerId)?.name || 'Default Customer';
    const computed = calculateDraftTotals();

    const finalizedSOData = {
      soNumber,
      referenceNo,
      customerName: chosenCustName,
      customerId,
      shipmentDate,
      warehouseId,
      deliveryOption: deliveryOption === 'Others' ? `Others (Forwarder: ${forwarderName})` : deliveryOption,
      items: draftedItems,
      subtotal: computed.subtotal,
      tax: computed.tax,
      total: computed.total,
      notes,
      description,
      taxType,
      customTaxRate,
      discountType,
      discountValue,
      region,
      salesCluster: region,
      salesCategory,
      attachments,
      orderPurpose,
      machineSerialNumber
    };

    if (revisingSO) {
      onEditSO({
        ...revisingSO,
        ...finalizedSOData
      });
      setFocusedSO({
        ...revisingSO,
        ...finalizedSOData
      });
    } else {
      onCreateSO({
        ...finalizedSOData,
        orderDate: new Date().toISOString().split('T')[0],
        status: 'Draft'
      });
    }
    
    setIsFormOpen(false);
  };

  const renderMachineSerialModal = () => {
    if (!viewingMachineSerial) return null;
    const activeMachine = machineLogs.find(m => m.serialNumber === viewingMachineSerial);
    const relatedSOs = salesOrders.filter(so => so.machineSerialNumber === viewingMachineSerial);
    const maintenanceLogs = machineLogs.filter(m => m.serialNumber === viewingMachineSerial && (m.notes || m.description));

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full border border-gray-150 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all animate-in fade-in duration-200 text-left">
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-gray-900">Heavy Equipment Asset Inspection</h4>
                <p className="text-xs text-gray-400 font-mono">SN: {viewingMachineSerial}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewingMachineSerial(null)}
              className="p-1.5 hover:bg-gray-150 rounded-lg text-gray-400 hover:text-gray-900 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 text-left">
            {activeMachine ? (
              <div className="grid grid-cols-2 gap-4 bg-indigo-50/20 p-4 rounded-xl border border-indigo-100/40">
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 tracking-wider font-mono block uppercase">Model Unit</span>
                  <span className="text-xs font-bold text-gray-850 block mt-0.5">{activeMachine.model}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 tracking-wider font-mono block uppercase">Operational Status</span>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-900">
                    {activeMachine.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 tracking-wider font-mono block uppercase">Active Owner Customer</span>
                  <span className="text-xs font-bold text-gray-850 block mt-0.5">{activeMachine.customerName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 tracking-wider font-mono block uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Live Location</span>
                  </span>
                  <span className="text-xs font-bold text-slate-800 block mt-0.5 font-mono">
                    {activeMachine.machineLocation || 'Unassigned / Customer Depot Address'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 tracking-wider font-mono block uppercase">Delivery / Commission Date</span>
                  <span className="text-xs font-semibold text-gray-500 block font-mono mt-0.5">{activeMachine.deliveryDate}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 tracking-wider font-mono block uppercase">Warranty Ends</span>
                  <span className="text-xs font-semibold text-red-600 block font-mono mt-0.5">{activeMachine.warrantyEnd}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-gray-500 text-center">
                No active registry index was found for this serial number. Deployed as custom client equipment.
              </div>
            )}

            {/* Repair logs / Notes */}
            <div className="space-y-2.5 text-left">
              <h5 className="text-[11px] font-extrabold text-slate-555 uppercase tracking-widest font-mono">Repair Notes & Maintenance Logs</h5>
              {maintenanceLogs.length > 0 ? (
                <div className="space-y-3">
                  {maintenanceLogs.map((log) => (
                    <div key={log.id} className="p-3.5 bg-amber-50/20 border border-amber-200/50 rounded-xl space-y-1.5 text-left text-xs text-slate-705">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full font-mono">{log.status}</span>
                        <span className="text-gray-450 font-mono font-medium">{log.deliveryDate}</span>
                      </div>
                      {log.description && (
                        <p className="leading-snug">
                          <b>Desc:</b> {log.description}
                        </p>
                      )}
                      {log.notes && (
                        <p className="italic bg-white p-2 rounded border border-amber-100/60 leading-snug">
                          <b>Repair Note:</b> {log.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No historical breakdown notes or field interventions found for this equipment.</p>
              )}
            </div>

            {/* Sales orders logs */}
            <div className="space-y-2.5 text-left font-sans">
              <h5 className="text-[11px] font-extrabold text-slate-555 uppercase tracking-widest font-mono">Associated Sales Orders History</h5>
              {relatedSOs.length > 0 ? (
                <div className="divide-y divide-gray-100 border border-gray-150 rounded-xl overflow-hidden bg-white text-xs">
                  {relatedSOs.map((so) => (
                    <div key={so.id} className="p-3.5 flex justify-between items-center hover:bg-slate-50/50 transition-colors text-left">
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-700 block">{so.soNumber}</span>
                        <span className="text-[10px] text-gray-400 font-mono font-semibold">Purpose: {so.orderPurpose || 'Sales'} — Date: {so.orderDate || so.shipmentDate || 'Recent'}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          so.status === 'Shipped' ? 'bg-emerald-55 text-emerald-800' :
                          so.status === 'Confirmed' ? 'bg-blue-55 text-blue-800' :
                          'bg-indigo-55 text-indigo-805'
                        }`}>
                          {so.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic font-sans text-left">No sales orders currently linked with this equipment.</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-gray-100 flex justify-end shrink-0">
            <button
              type="button"
              onClick={() => setViewingMachineSerial(null)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-250 font-bold text-slate-700 rounded-lg text-xs cursor-pointer transition-colors"
            >
              Close Explorer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDeliveryReceiptModal = () => {
    if (!isDeliveryReceiptOpen || !focusedSO) return null;
    const selectedCust = customers.find(c => c.id === focusedSO.customerId);
    const originWarehouse = warehouses.find(w => w.id === focusedSO.warehouseId);
    
    const drNumber = selectedDRForView ? selectedDRForView.drNumber : `DR-${focusedSO.soNumber.replace('SO-', '')}`;
    const dispatchDate = selectedDRForView ? selectedDRForView.dispatchDate : (focusedSO.actualDeliveryDate || focusedSO.shipmentDate || new Date().toISOString().split('T')[0]);
    const dispatchedBy = selectedDRForView ? selectedDRForView.dispatchedBy : 'Logistics Supervisor';
    const notesValue = selectedDRForView ? selectedDRForView.notes : 'Shipment dispatched in compliance with sales layout criteria and transit security. All custom logs preserved.';

    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 duration-150 text-left">
          {/* Header Controller Bar */}
          <div className="bg-slate-50 p-4 border-b border-gray-150 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
              <div className="text-left font-sans">
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#0e1e38] block uppercase">Official Land Delivery Protocol</span>
                <span className="text-xs text-slate-400 font-serif italic font-semibold">{drNumber} — BIR SEC Registered Sheet</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-sans">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="p-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 hover:border-emerald-800 text-[10px] font-mono font-bold rounded-md flex items-center gap-1 cursor-pointer shadow-xs transition-all uppercase"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDeliveryReceiptOpen(false)}
                className="p-1 hover:bg-gray-200 text-gray-500 rounded-md cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable DR Payload Area */}
          <div className="p-8 overflow-y-auto space-y-6 text-left selection:bg-indigo-100 flex-1">
            {/* Print Sheet Borders */}
            <div className="border border-slate-350 p-6 md:p-8 bg-slate-50/10 rounded-xl space-y-6 relative overflow-hidden font-sans">
              {/* Visual Background Stamp */}
              <div className="absolute top-[33%] left-[12%] right-[12%] rotate-[-25deg] text-red-100 border-4 border-red-50/20 px-8 py-4 pointer-events-none text-center select-none rounded animate-pulse">
                <span className="text-5xl font-mono uppercase tracking-[12px] font-black leading-none text-rose-50/30 font-sans">RELEASED FOR CARRIER</span>
              </div>

              {/* Document Logistical Header */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-slate-250 pb-6">
                <div className="text-left space-y-1">
                  <h1 className="text-base font-bold font-serif text-slate-900 tracking-tight leading-none text-left">PHILIPPINE CODA INDUSTRIES</h1>
                  <span className="text-[9px] text-gray-400 font-mono tracking-wider block font-semibold text-left">124 P. SENSON ST., SAN BUENAVENTURA DISTRICT, PILA, LAGUNA</span>
                  <span className="text-[9px] text-gray-400 font-mono tracking-wider block font-semibold text-left">VAT REG TIN No: 485-992-051-00000 | PH Carrier Transit Registry</span>
                </div>
                <div className="text-left md:text-right font-mono space-y-1">
                  <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-[9px] font-extrabold px-2.5 py-1 rounded inline-block uppercase tracking-wider">DELIVERY RECEIPT</span>
                  <div className="pt-1.5 text-[10px] space-y-0.5 text-left md:text-right font-mono">
                    <p><span className="text-gray-400 font-sans">DR Sheet #:</span> <b className="text-slate-900">{drNumber}</b></p>
                    <p><span className="text-gray-400 font-sans">Log Date:</span> <b className="text-slate-800">{dispatchDate}</b></p>
                    <p><span className="text-gray-400 font-sans">Origin Whse:</span> <b className="text-slate-800 font-sans">{originWarehouse?.name || 'Central Laguna Hub'}</b></p>
                  </div>
                </div>
              </div>

              {/* Transaction Context Pair Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-205 space-y-1.5 text-left">
                  <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-widest font-sans block border-b border-slate-200 pb-1 mb-1">CONSIGNEE RECIPIENT BILL TO</span>
                  <p className="font-bold text-slate-900">{selectedCust?.name || 'BIR Register Account'}</p>
                  <p className="text-gray-500 font-medium font-sans">{selectedCust?.address || 'No registered corporate tax billing address.'}</p>
                  <p><span className="text-gray-400">Account Contact:</span> <span className="font-semibold text-slate-800">{selectedCust?.phone || 'N/A'}</span></p>
                  <p><span className="text-gray-400">TIN File Ref:</span> <span className="font-semibold text-slate-800 font-mono">{selectedCust?.email ? `TIN-${selectedCust.email.substring(0,6).toUpperCase()}` : 'VAT No.'}</span></p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-205 space-y-1.5 text-left">
                  <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-widest font-sans block border-b border-slate-200 pb-1 mb-1">SHIPPING LOGISTICS PROTOCOL</span>
                  <p><span className="text-gray-400 font-sans">Transit Carrier:</span> <span className="font-bold text-slate-900">Laguna Land Transit Corp.</span></p>
                  <p><span className="text-gray-400 font-sans">Despatch Supervisor:</span> <span className="font-semibold text-slate-850 font-serif italic text-indigo-755">{dispatchedBy}</span></p>
                  <p><span className="text-gray-400">Associated Reference:</span> <span className="font-bold text-indigo-700 font-mono">{focusedSO.soNumber}</span></p>
                  {focusedSO.machineSerialNumber && (
                    <p className="bg-amber-50 text-amber-900 font-mono font-black text-[9px] px-2 py-0.5 rounded border border-amber-200/50 inline-block uppercase mt-0.5">
                      🚚 LINKED ASSET: SN #{focusedSO.machineSerialNumber}
                    </p>
                  )}
                </div>
              </div>

              {/* Verified Product Load manifest */}
              <div className="space-y-2 text-left">
                <span className="text-[9px] font-extrabold text-slate-550 uppercase tracking-widest font-mono block">VERIFIED LOAD LOGS PROTOCOL</span>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-[#0e1e38] text-white text-[10px] font-bold uppercase tracking-wider font-mono">
                      <tr>
                        <th className="px-4 py-2.5 text-left">#</th>
                        <th className="px-4 py-2.5 text-left">SKU</th>
                        <th className="px-4 py-2.5 text-left">Item Name</th>
                        <th className="px-4 py-2.5 text-center">Batch Lots</th>
                        <th className="px-4 py-2.5 text-right">Qty Despatched</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-slate-705 text-left">
                      {(() => {
                        const drLines = selectedDRForView 
                          ? selectedDRForView.items 
                          : focusedSO.items.map(it => {
                              const matchObj = items.find(p => p.id === it.itemId);
                              return {
                                itemId: it.itemId,
                                sku: matchObj?.sku || 'N/A',
                                name: matchObj?.name || 'Direct Item Spec',
                                quantity: it.quantity,
                                unitPrice: it.unitPrice
                              };
                            });

                        return drLines.map((line, idx) => {
                          const itemObj = items.find(p => p.id === line.itemId);
                          
                          // Seek linked lot tracking strings
                          const matchedLots = (lots || []).filter(l => l.itemId === line.itemId && l.lotNumber.includes(focusedSO.soNumber.replace('SO-', '')));
                          const calculatedLotText = matchedLots.length > 0 
                            ? matchedLots.map(l => l.lotNumber).join(', ')
                            : `LOT-${focusedSO.soNumber.substring(3)}-${line.sku || idx}`;

                          return (
                            <tr key={line.itemId} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-mono text-gray-400">{idx+1}</td>
                              <td className="px-4 py-3 font-mono font-bold text-slate-900">{line.sku}</td>
                              <td className="px-4 py-3">
                                <span className="font-semibold text-slate-800 block leading-tight">{line.name}</span>
                                {itemObj?.brand && <span className="block text-[8px] text-gray-405 font-mono mt-0.5">Brand: {itemObj.brand}</span>}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-[9px] text-indigo-755 font-bold uppercase">{calculatedLotText}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{line.quantity} {itemObj?.unit || 'pcs'}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Box and Terms Conditions */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-2">
                <div className="text-[10px] text-slate-450 leading-relaxed font-sans w-full text-left">
                  <b>TERMS & CONDITIONS:</b> All physical goods listed on this Delivery Receipt must be counted and cross-inspected. Any claim for missing stock or shipping defect must be filed formally within 48 hours of transit release. Signatories verify goods arrived complete and fit for service operations.
                </div>
              </div>

              {/* Notes remark status from specific sheet */}
              <div className="p-3 bg-red-50/20 border border-slate-200 rounded-lg text-left text-[11px] text-slate-700 italic">
                <span className="font-mono text-[9px] block uppercase font-bold text-gray-500 mb-0.5 font-sans">DELIVERY DESPATCH OBSERVATIONS:</span>
                {notesValue}
              </div>

              {/* Official Signatures Row */}
              <div className="grid grid-cols-3 gap-6 pt-12 text-[10px] leading-snug">
                <div className="space-y-8 text-center border-t border-slate-350 pt-2.5">
                  <span className="font-bold text-slate-755 block text-xs font-serif italic text-emerald-800">
                    {dispatchedBy}
                  </span>
                  <span className="text-slate-450 uppercase font-mono block">Released (Planning & Dispatch)</span>
                </div>

                <div className="space-y-8 text-center border-t border-slate-330 pt-2.5">
                  <div className="h-4"></div>
                  <span className="text-slate-450 uppercase font-mono block">Checked By (Warehouse Security)</span>
                </div>

                <div className="space-y-8 text-center border-t border-slate-350 pt-2.5 font-sans">
                  <div className="h-4"></div>
                  <span className="text-slate-450 uppercase font-mono block">Customer Seal & Signature</span>
                </div>
              </div>
            </div>
          </div>

          {/* Close controls at bottom */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0 font-sans">
            <button
              type="button"
              onClick={() => setIsDeliveryReceiptOpen(false)}
              className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors"
            >
              Close Document Viewer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getStatusStyle = (status: SalesOrder['status']) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700 border border-gray-200';
      case 'Confirmed': return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'On Going': return 'bg-blue-50 text-blue-700 border border-blue-100';
      case 'Shipped': return 'bg-teal-50 text-teal-700 border border-teal-100';
      case 'Received': return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'Cancelled': return 'bg-rose-50 text-rose-700 border border-rose-100';
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-mono">Sales Orders (SO)</h1>
          <p className="text-sm text-gray-500">
            Dispatch stock to clients, manage BIR-registered customer corporate purchases, and print Philippine-compliant 12% VAT bills.
          </p>
        </div>
        <button
          onClick={handleOpenDrafting}
          disabled={!canEdit}
          className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold text-white rounded-lg transition-colors shadow-xs hover:shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Sales Order</span>
        </button>
      </div>

      {/* Filtering SO Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search SO Number, or Customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2 bg-gray-50 text-gray-800 rounded-lg border border-gray-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold font-mono">Customer:</span>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-700 font-bold focus:outline-hidden max-w-[200px] truncate"
            >
              <option value="All">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold font-mono">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-700 font-bold focus:outline-hidden"
            >
              <option value="All">All Transactions</option>
              <option value="Draft">Draft</option>
              <option value="Confirmed">Confirmed (Approved)</option>
              <option value="On Going">On Going</option>
              <option value="Shipped">Shipped (Fulfilled)</option>
              <option value="Received">Received (Delivered)</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Splits SO Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* SO Table list */}
        <div className="relative bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            {filteredSOs.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-400 font-medium">
                No matching client Sales Orders detected.
              </div>
            ) : (
              <>
              {currentUser?.role === 'Admin' && selectedSOIds.length > 0 && (
                <div className="bg-indigo-50 border-b border-indigo-150 p-3 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in duration-205">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 p-1 px-2.5 rounded-full select-none">
                      {selectedSOIds.length} Selected
                    </span>
                    <span className="text-xs text-indigo-900 font-bold">
                      Batch status transition selected Sales Orders to:
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onBatchUpdateSOStatus) {
                          onBatchUpdateSOStatus(selectedSOIds, 'Confirmed');
                          setSelectedSOIds([]);
                        }
                      }}
                      className="bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold text-[10px] p-2 px-3.5 rounded-lg shadow-sm transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      ✓ Confirmed
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onBatchUpdateSOStatus) {
                          if (window.confirm(`⚠️ WARNING: Transition ${selectedSOIds.length} orders to Shipped?\nThis will deduct stock, adjust FIFO lots, register machine logs, and record transactions.`)) {
                            onBatchUpdateSOStatus(selectedSOIds, 'Shipped');
                            setSelectedSOIds([]);
                          }
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] p-2 px-3.5 rounded-lg shadow-sm transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      🚚 Shipped
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSOIds([])}
                      className="text-gray-500 hover:text-gray-700 text-[10px] font-bold p-2 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr className="bg-gray-55/45 border-b border-gray-100 text-left text-xs font-bold text-gray-500 uppercase tracking-widest font-mono select-none">
                    {currentUser?.role === 'Admin' && (
                      <th className="px-4 py-4 text-center w-12">
                        <input
                          type="checkbox"
                          checked={filteredSOs.length > 0 && selectedSOIds.length === filteredSOs.length}
                          onChange={() => {
                            if (selectedSOIds.length === filteredSOs.length) {
                              setSelectedSOIds([]);
                            } else {
                              setSelectedSOIds(filteredSOs.map(s => s.id));
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-6 py-4">SO Number</th>
                    <th className="px-6 py-4">Customer & Dispatch Hub</th>
                    <th className="px-6 py-4 font-mono">Invoice Value (12% VAT Inc.)</th>
                    <th className="px-6 py-4">Shipment Target</th>
                    <th className="px-6 py-4 text-center">Lifecycle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {filteredSOs.map(so => {
                    const srcWarehouse = warehouses.find(w => w.id === so.warehouseId)?.name || 'Central Site';
                    const matchedCustomer = customers.find(c => c.id === so.customerId);
                    const clientLabel = matchedCustomer ? matchedCustomer.name : so.customerName;
                    const isSelected = selectedSOIds.includes(so.id);
                    return (
                      <tr
                        key={so.id}
                        onClick={() => setFocusedSO(so)}
                        className={`hover:bg-indigo-50/15 cursor-pointer transition-colors ${focusedSO?.id === so.id ? 'bg-indigo-50/30' : ''} ${isSelected ? 'bg-indigo-50/5' : ''}`}
                      >
                        {currentUser?.role === 'Admin' && (
                          <td className="px-4 py-4 text-center select-none w-12" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedSOIds(prev =>
                                  prev.includes(so.id)
                                    ? prev.filter(id => id !== so.id)
                                    : [...prev, so.id]
                                );
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 font-mono font-bold text-gray-900">
                          <div>{so.soNumber}</div>
                          {so.referenceNo && (
                            <div className="text-[10px] text-indigo-650 font-semibold font-sans mt-0.5 bg-indigo-50/50 px-1 py-0.2 rounded inline-block max-w-full truncate">Ref: {so.referenceNo}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 space-y-0.5">
                          <div className="font-bold text-gray-805 text-sm leading-tight">{clientLabel}</div>
                          <div className="text-[10px] text-gray-400 font-mono">From: {srcWarehouse}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-800">
                          ₱{so.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 font-mono text-left">
                          <div className="text-gray-850 font-medium">Ship: {so.shipmentDate}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Created: {so.orderDate}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-[9px] font-bold rounded-full ${getStatusStyle(so.status)}`}>
                            {so.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </>
            )}
          </div>


        </div>

        {/* SO inspector Side */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-6">
          {focusedSO ? (
            <div className="space-y-6">
              {/* Header and visual status */}
              <div className="flex justify-between items-start gap-3 border-b border-gray-50 pb-4">
                <div className="space-y-0.5 text-left">
                  <span className="text-[10px] font-mono text-indigo-600 font-bold">PHILIPPINES SALES BILL</span>
                  <h3 className="text-xl font-extrabold text-gray-950 font-mono tracking-tight">{focusedSO.soNumber}</h3>
                  {focusedSO.referenceNo && (
                    <div className="mt-1 font-mono text-[10px] font-bold text-indigo-750 bg-indigo-50/50 border border-indigo-100 px-2 py-0.5 rounded inline-block">
                      REF: {focusedSO.referenceNo}
                    </div>
                  )}
                  {focusedSO.description && (
                    <p className="text-xs text-gray-650 italic mt-1 font-sans max-w-[240px] break-words">
                      <b>Project/Desc:</b> {focusedSO.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${getStatusStyle(focusedSO.status)}`}>
                    {focusedSO.status}
                  </span>
                  
                  {focusedSO.status === 'Draft' && canEdit && (
                    <button
                      onClick={() => handleOpenEditDraft(focusedSO)}
                      className="inline-flex items-center gap-1 py-1 px-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-[10px] text-slate-600 font-bold rounded border border-slate-200 cursor-pointer transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit SO</span>
                    </button>
                  )}
                  {currentUser?.role === 'Admin' && onDeleteSO && (
                    <button
                      onClick={() => {
                        if (window.confirm(`⚠️ CRITICAL ACTION: Are you sure you want to permanently delete Sales Order ${focusedSO.soNumber}? This cannot be undone.`)) {
                          onDeleteSO(focusedSO.id);
                          setFocusedSO(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-[10px] text-rose-700 font-extrabold rounded border border-rose-200 cursor-pointer transition-colors mt-1"
                    >
                      <Trash2 className="w-3 h-3 text-rose-650" />
                      <span>Delete SO</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Customer & src info */}
              <div className="grid grid-cols-2 gap-4 text-xs text-left">
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mb-1 font-mono">Customer Account</span>
                  <span className="text-gray-800 font-bold block">
                    {customers.find(c => c.id === focusedSO.customerId)?.name || focusedSO.customerName}
                  </span>
                  {customers.find(c => c.id === focusedSO.customerId)?.tin && (
                    <span className="font-mono text-[10px] block text-indigo-700 font-semibold mt-0.5">
                      TIN: {customers.find(c => c.id === focusedSO.customerId)?.tin}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mb-1 font-mono">Origin Depot</span>
                  <span className="text-gray-800 font-bold block">
                    {warehouses.find(w => w.id === focusedSO.warehouseId)?.name || 'Central Site'}
                  </span>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mt-1.5 mb-0.5 font-mono">Logistics Option</span>
                  <span className="text-indigo-600 font-bold block text-[11px]">
                    {focusedSO.deliveryOption || 'Standard Cargo'}
                  </span>
                </div>
              </div>

              {/* Region and Business Classification Category */}
              <div className="grid grid-cols-2 gap-4 text-xs text-left bg-slate-50/50 p-3 rounded-lg border border-gray-100">
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mb-1 font-mono flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-indigo-500 animate-pulse" />
                    <span>Sales Cluster</span>
                  </span>
                  <span className="text-gray-850 font-bold bg-indigo-50/40 text-indigo-800 px-2.5 py-1 rounded text-xs inline-block border border-indigo-100">
                    {focusedSO.salesCluster || focusedSO.region || 'Head Office'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-bold text-[9px] mb-1 font-mono flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-500" />
                    <span>Transaction Class</span>
                  </span>
                  <span className="text-gray-850 font-bold bg-emerald-50/40 text-emerald-800 px-2.5 py-1 rounded text-xs inline-block border border-emerald-100">
                    {focusedSO.salesCategory || 'Parts'}
                  </span>
                </div>
              </div>

              {/* Order lifecycle steps */}
              <div className="p-4 bg-indigo-50/45 rounded-xl border border-indigo-100/50 space-y-3">
                <div className="flex gap-2 items-center">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-widest font-mono">Life Cycle Status (Reversible)</span>
                </div>
                <p className="text-[11px] text-indigo-850 leading-relaxed text-left font-normal">
                  You can freely transition or reverse the state of this sales order. Reverting shipment automatically returns physical stock and lot allocations safely.
                </p>
                <div className="flex gap-2 pt-1">
                  <select
                    value={focusedSO.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as any;
                      if (nextStatus === 'Shipped') {
                        const shipViolations: string[] = [];
                        focusedSO.items.forEach((line) => {
                          if (line.lotId) {
                            const violation = getFifoViolation(line.itemId, focusedSO.warehouseId, line.lotId);
                            if (violation.violated && violation.selected && violation.oldest) {
                              const itemPr = items.find(p => p.id === line.itemId);
                              shipViolations.push(
                                `- Product: "${itemPr?.name}"\n  Selected Lot: "${violation.selected.lotNumber}"\n  Oldest Lot Available: "${violation.oldest.lotNumber}"`
                              );
                            }
                          }
                        });

                        if (shipViolations.length > 0) {
                          const confirmOverride = window.confirm(
                            `⚠️ FIFO COMPLIANCE TRIGGER WARNING!\n\n` +
                            `You are about to FULFILL / SHIP inventory with lot associations violating FIFO standards:\n\n` +
                            shipViolations.join('\n\n') +
                            `\n\nThis will lock the transaction ledger and programmatically decrease stock from non-sequential batches.\n\n` +
                            `Are you sure you want to proceed?`
                          );
                          if (!confirmOverride) return;
                        }
                      }

                      onUpdateSOStatus(focusedSO.id, nextStatus);
                    }}
                    className="flex-1 text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="On Going">On Going</option>
                    <option value="Shipped">Shipped (Fulfill)</option>
                    <option value="Received">Received (Delivered)</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Warehouse Pick List Section */}
              <div className="bg-white rounded-lg p-3.5 border border-gray-150 text-left flex items-center justify-between gap-4">
                <div className="text-left space-y-0.5">
                  <h6 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider font-mono">Warehouse Fulfillment</h6>
                  <p className="text-[10px] text-gray-400">Generate a simplified, printer-friendly summary of shelves, quantities, and barcodes.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickListOpen(true)}
                  className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-indigo-150 shadow-3xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Generate Pick List</span>
                </button>
              </div>

              {/* Delivery Receipt Sheets Section */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-left space-y-2.5">
                <div className="flex justify-between items-center bg-transparent">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#0e1e38] block flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-indigo-500" />
                    Delivery Receipt Sheets (DRs)
                  </span>
                  <button
                    type="button"
                    disabled={focusedSO.status === 'Draft' || focusedSO.status === 'Cancelled'}
                    onClick={() => {
                      setSelectedDRForView(null);
                      handleOpenCreateReceipt(focusedSO);
                    }}
                    className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded font-mono transition-all flex items-center gap-0.5 ${
                      focusedSO.status === 'Draft' || focusedSO.status === 'Cancelled'
                        ? 'bg-gray-150 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer'
                    }`}
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>New Receipt</span>
                  </button>
                </div>

                {/* List of related delivery sheets */}
                {(() => {
                  const relatedDRs = (explicitDeliveryReceipts || []).filter(dr => dr.soId === focusedSO.id);

                  return (
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {/* Standard full system receipt if no explicit sheets exist yet */}
                      {relatedDRs.length === 0 && (
                        <div className="p-2 border border-slate-150 bg-white hover:bg-slate-50 rounded flex items-center justify-between text-[11px] font-medium text-slate-800 leading-none">
                          <div className="space-y-0.5">
                            <span className="font-mono text-[10px] text-gray-500 block">SYSTEM DEFAULT FULL RECEIPT</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{`DR-${focusedSO.soNumber.replace('SO-', '')}`}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDRForView(null);
                              setIsDeliveryReceiptOpen(true);
                            }}
                            className="p-1 px-2 text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 rounded hover:bg-slate-200 hover:text-slate-900 flex items-center gap-0.5 cursor-pointer uppercase transition-all"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                        </div>
                      )}

                      {/* Display explicit custom delivery sheets */}
                      {relatedDRs.map(dr => (
                        <div key={dr.id} className="p-2 border border-emerald-100 bg-white hover:bg-emerald-50/40 rounded flex items-center justify-between text-[11px] font-medium text-slate-800 leading-none">
                          <div className="space-y-0.5">
                            <span className="font-mono text-[9px] text-indigo-700 uppercase font-black block tracking-wider">DELIVERY RECEIPT LOGGED</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{dr.drNumber}</span>
                            <span className="text-[9px] font-mono text-gray-400 block font-normal">{dr.dispatchDate} • {dr.items.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0)} items</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDRForView(dr);
                                setIsDeliveryReceiptOpen(true);
                              }}
                              className="p-1 px-2 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded hover:bg-emerald-100 hover:text-emerald-950 flex items-center gap-0.5 cursor-pointer uppercase transition-all"
                            >
                              <Eye className="w-3 h-3 text-emerald-655" />
                              <span>View DR</span>
                            </button>
                            {onDeleteDeliveryReceipt && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteDeliveryReceipt(dr.id);
                                }}
                                title="Delete Delivery Receipt"
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Payment and Invoice status togglers */}
              <div className="grid grid-cols-2 gap-3 text-xs text-left bg-slate-50 p-3 rounded-lg border border-gray-200">
                <div className="space-y-1.5 border-r border-gray-200 pr-2">
                  <span className="text-gray-400 font-mono font-bold text-[8px] uppercase tracking-wider block">Payment Status</span>
                  <div>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-sm border ${focusedSO.isPaid ? 'bg-emerald-100 text-emerald-800 border-emerald-250' : 'bg-red-50 text-red-700 border-red-250'}`}>
                      {focusedSO.isPaid ? '✓ PAID' : '✗ UNPAID'}
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...focusedSO, isPaid: !focusedSO.isPaid };
                        onEditSO(updated);
                        setFocusedSO(updated);
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 underline block cursor-pointer"
                    >
                      {focusedSO.isPaid ? 'Mark as Unpaid' : 'Mark as Paid'}
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 pl-1">
                  <span className="text-gray-400 font-mono font-bold text-[8px] uppercase tracking-wider block">Invoice Status</span>
                  <div>
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-sm border ${focusedSO.invoiceCreated ? 'bg-blue-100 text-blue-800 border-blue-250' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {focusedSO.invoiceCreated ? '✓ INVOICED' : '✗ NO INVOICE'}
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...focusedSO, invoiceCreated: !focusedSO.invoiceCreated };
                        onEditSO(updated);
                        setFocusedSO(updated);
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 underline block cursor-pointer"
                    >
                      {focusedSO.invoiceCreated ? 'Set Pending' : 'Mark Invoiced'}
                    </button>
                  )}
                </div>
              </div>

              {/* Billing Purpose & Pricing status indicators */}
              <div className="grid grid-cols-2 gap-3 text-xs text-left bg-indigo-50/20 p-3 rounded-lg border border-indigo-100/30">
                <div>
                  <span className="text-gray-400 font-mono font-bold text-[8px] uppercase tracking-wider block mb-1">Invoice Billing Category</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${focusedSO.orderPurpose === 'Warranty' ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-indigo-100 text-indigo-900 border border-indigo-200'}`}>
                    {focusedSO.orderPurpose === 'Warranty' ? '🛡️ Warranty dispatch' : '💼 Commercial sale'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-mono font-bold text-[8px] uppercase tracking-wider block mb-1">Price Configuration</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${canSeePricing ? 'bg-emerald-50 text-emerald-800 border border-emerald-100 font-semibold' : 'bg-rose-50 text-rose-800 border border-rose-100 font-semibold'}`}>
                    {canSeePricing ? 'Authorized pricing details shown' : 'Hidden financial params'}
                  </span>
                </div>
              </div>

              {/* Clickable Heavy machinery association details / Input box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-200 text-left space-y-2.5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 font-mono">
                    Associate Machine Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-KUB-987"
                    disabled={!canEdit}
                    value={focusedSO.machineSerialNumber || ''}
                    onChange={(e) => {
                      const updated = {
                        ...focusedSO,
                        machineSerialNumber: e.target.value
                      };
                      onEditSO(updated);
                      setFocusedSO(updated);
                    }}
                    className="w-full text-xs px-3 py-1.5 bg-white border border-slate-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono disabled:opacity-50"
                  />
                </div>

                {focusedSO.machineSerialNumber && (
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] text-amber-800 uppercase tracking-wider font-extrabold font-mono">Associated Fleet Machinery</span>
                      <span className="text-[8px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded uppercase font-mono animate-pulse">Click below to view logs</span>
                    </div>
                    <div 
                      onClick={() => setViewingMachineSerial(focusedSO.machineSerialNumber || null)}
                      className="flex items-center gap-3 p-2.5 bg-white hover:bg-amber-50/40 border border-amber-250/60 hover:border-amber-300 rounded-lg cursor-pointer shadow-3xs hover:shadow-2xs transition-all duration-150 group"
                    >
                      <Wrench className="w-4 h-4 text-amber-500 shrink-0 group-hover:rotate-12 transition-transform" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-amber-850 transition-colors">
                          SN: {focusedSO.machineSerialNumber}
                        </span>
                        {(() => {
                          const mObj = machineLogs.find(m => m.serialNumber === focusedSO.machineSerialNumber);
                          return (
                            <>
                              <span className="text-[10px] text-gray-500 block truncate">{mObj ? mObj.model : 'Heavy Machinery Asset Unit'}</span>
                              {mObj?.machineLocation && (
                                <span className="text-[9px] text-indigo-700 font-bold block truncate mt-0.5 flex items-center gap-1 font-mono">
                                  <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                                  <span>Site: {mObj.machineLocation}</span>
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Items in focused SO */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider font-mono text-left">Line Items Summary</h4>
                <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg overflow-hidden bg-gray-50/20">
                   {focusedSO.items.map((line, pos) => {
                     const itemProfile = items.find(p => p.id === line.itemId);
                     return (
                       <div key={pos} className="p-3 text-xs bg-white space-y-1">
                         <div className="flex justify-between items-center">
                           <div className="min-w-0 text-left">
                             <span className="font-bold text-gray-900 block">{itemProfile?.name || 'Item Code'}</span>
                             <span className="font-mono text-[10px] text-gray-400 block">SKU: {itemProfile?.sku} — Qty: {line.quantity} pcs {line.category ? `(${line.category})` : ''}</span>
                           </div>
                           <div className="text-right font-mono font-bold text-gray-751">
                             ₱{(line.quantity * line.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                           </div>
                         </div>
                         {itemProfile?.description && (
                           <div className="text-[11px] text-gray-500 italic text-left pl-2 border-l border-gray-200">
                             Description: {itemProfile.description}
                           </div>
                         )}
                         {line.note && (
                           <div className="text-[11px] text-indigo-700 bg-indigo-50/30 px-2 py-1 rounded text-left border border-indigo-100/40">
                             ✍️ Line Note: {line.note}
                           </div>
                         )}
                       </div>
                     );
                   })}
                </div>
              </div>

              {/* Invoicing summary details */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-xs text-gray-600 space-y-2">
                <div className="flex justify-between text-indigo-750 font-bold border-b border-dashed border-gray-250 pb-2 mb-2">
                  <span className="font-sans text-[11px]">SO Creation Date:</span>
                  <span className="text-[11px]">{focusedSO.orderDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal value:</span>
                  <span>₱{focusedSO.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {focusedSO.discountType && focusedSO.discountType !== 'None' && (
                  <div className="flex justify-between text-red-650 font-medium">
                    <span>Discount ({focusedSO.discountType === 'Percentage' ? `${focusedSO.discountValue}%` : 'Fixed'}):</span>
                    <span>-₱{((focusedSO.discountType === 'Percentage' ? (focusedSO.subtotal * (focusedSO.discountValue || 0) / 100) : (focusedSO.discountValue || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {focusedSO.discountType && focusedSO.discountType !== 'None' && (
                  <div className="flex justify-between text-gray-400 border-t border-dashed border-gray-200 pt-1">
                    <span>Subtotal After Disc:</span>
                    <span>₱{(Math.max(0, focusedSO.subtotal - ((focusedSO.discountType === 'Percentage' ? (focusedSO.subtotal * (focusedSO.discountValue || 0) / 100) : (focusedSO.discountValue || 0))))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {focusedSO.taxType !== 'None' ? (
                  <div className="flex justify-between text-indigo-800">
                    <span>Philippine Tax ({focusedSO.taxType === 'VAT' ? 'VAT 12%' : focusedSO.taxType === 'Non-VAT' ? 'Non-VAT 0%' : `Custom ${focusedSO.customTaxRate || 12}%`}):</span>
                    <span>₱{focusedSO.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-400 italic">
                    <span>Philippine Tax:</span>
                    <span>No Tax Applied</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold text-gray-950">
                  <span>Grand Total (₱):</span>
                  <span>₱{focusedSO.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Notes */}
              {focusedSO.notes && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-left">
                  <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider font-mono">Special Delivery Instructions</span>
                  <p className="text-[11px] text-gray-600 leading-normal mt-0.5">{focusedSO.notes}</p>
                </div>
              )}

              {/* File Attachments display with post-creation upload capabilities */}
              <div className="space-y-2 text-left bg-slate-50/40 p-3.5 rounded-xl border border-gray-150">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-550 font-mono flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Documents & Attachments ({(focusedSO.attachments || []).length})</span>
                  </span>
                  
                  {/* Post-creation direct simulation upload */}
                  <label className="text-[10px] bg-indigo-50 hover:bg-slate-100 text-indigo-700 font-bold px-2 py-1 rounded cursor-pointer transition-colors block">
                    <span>+ Attach File</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (!e.target.files) return;
                        const filesArray = Array.from(e.target.files);
                        const newRecords = filesArray.map((f: any) => ({
                          id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                          name: f.name,
                          size: f.size,
                          type: f.type,
                          dataUrl: '#',
                          uploadedAt: new Date().toISOString()
                        }));
                        const updated = {
                          ...focusedSO,
                          attachments: [...(focusedSO.attachments || []), ...newRecords]
                        };
                        onEditSO(updated);
                        setFocusedSO(updated);
                      }}
                    />
                  </label>
                </div>

                {(!focusedSO.attachments || focusedSO.attachments.length === 0) ? (
                  <p className="text-[10px] text-gray-400 italic py-1 pl-1">No file attachments bound yet. Use the tool above to attach receipts or logistics documents.</p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {focusedSO.attachments.map((att: any) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg"
                      >
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); alert(`Downloading file: ${att.name}`); }}
                          className="flex items-center gap-2 min-w-0 flex-1 hover:underline cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold block truncate text-slate-800 text-left">{att.name}</span>
                            <span className="text-[9px] text-gray-400 font-mono font-medium block text-left">{(att.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </a>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete attachment: "${att.name}"?`)) {
                              const remaining = (focusedSO.attachments || []).filter(a => a.id !== att.id);
                              const updated = { ...focusedSO, attachments: remaining };
                              onEditSO(updated);
                              setFocusedSO(updated);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-rose-50 cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Interactive Status Transition timeline */}
              <div className="space-y-3 text-left bg-slate-50/40 p-3.5 rounded-xl border border-gray-150">
                <div className="flex justify-between items-center bg-slate-50/10 pb-1 border-b border-gray-100/50 mb-1">
                  <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider font-mono">Order History & Status Trail</span>
                  <button
                    type="button"
                    onClick={handleExportAuditSO}
                    className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-650 hover:text-indigo-805 bg-white hover:bg-slate-100 border border-gray-200 hover:border-indigo-200 px-2.2 py-1 rounded shadow-3xs cursor-pointer transition-all uppercase tracking-wider font-mono shrink-0"
                    title="Export status history logs to CSV"
                  >
                    <Download className="w-3 h-3 text-indigo-500" />
                    <span>Export Audit Log</span>
                  </button>
                </div>
                <div className="relative pl-3.5 border-l border-indigo-200 space-y-4 ml-1.5">
                  {(focusedSO.statusHistory && focusedSO.statusHistory.length > 0 ? focusedSO.statusHistory : [
                    { status: 'Draft', date: focusedSO.orderDate || new Date().toISOString().split('T')[0], note: 'Sales Order drafted by sales team.', user: 'Operations' }
                  ]).map((hist, hIdx) => (
                    <div key={hIdx} className="relative">
                      {/* Interactive indicator pin */}
                      <span className={`absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white ${
                        hist.status === 'Draft' ? 'bg-slate-500' :
                        hist.status === 'Confirmed' ? 'bg-amber-500' :
                        hist.status === 'On Going' || hist.status === 'Shipped' ? 'bg-indigo-500' :
                        hist.status === 'Received' ? 'bg-emerald-550' : 'bg-rose-550'
                      }`} />
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-800">{hist.status}</span>
                          <span className="font-mono text-[9px] text-slate-400 font-bold">{hist.date}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">{hist.note}</p>
                        {hist.user && (
                          <div className="flex justify-between items-center pt-0.5">
                            <span className="text-[9px] text-indigo-500 font-bold font-mono tracking-wide">Operator: {hist.user}</span>
                          </div>
                        )}

                        {/* Inline Quick Remark Textarea */}
                        <div className="mt-1.5 p-1.5 bg-white/80 rounded-md border border-gray-100 space-y-1">
                          <textarea
                            placeholder="Add instant remark to log note..."
                            value={soLogRemarks[hIdx] || ''}
                            onChange={(e) => setSoLogRemarks(prev => ({ ...prev, [hIdx]: e.target.value }))}
                            className="w-full text-[10px] p-1 bg-slate-50 border border-slate-200 rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-505 font-sans leading-relaxed resize-none"
                            rows={1}
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const val = soLogRemarks[hIdx];
                                if (val && val.trim()) {
                                  handleAppendSoLogRemark(hIdx, val);
                                  setSoLogRemarks(prev => ({ ...prev, [hIdx]: '' }));
                                }
                              }}
                              className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                            >
                              Append Remark
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-gray-400 font-semibold space-y-2">
              <Eye className="w-8 h-8 text-indigo-400 mx-auto" />
              <p>Select a retail sales order to inspect BIR billing logs, dispatch instructions, and inventory status.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT SO DRAWER MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h2 className="text-lg font-bold text-gray-900 font-mono">
                  {revisingSO ? 'Edit Sales Order Record' : 'Draft New Sales Order'}
                </h2>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitDraft} className="flex flex-col overflow-hidden flex-1">
              <div className="p-5 space-y-5 overflow-y-auto flex-1 bg-slate-50/10 min-h-0">
                {/* General Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-gray-600 font-mono">Sales Order Description / Purpose / Project Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. Davao Fleet Parts & Maintenance Servicing Campaign"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Sales Order Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SO-2026-003"
                      value={soNumber}
                      onChange={(e) => setSoNumber(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Reference No. (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-CUST-9902"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Select Client (CRM) *</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-indigo-900 bg-white"
                    >
                      {customers.filter(c => c.status === 'Active').map(c => (
                        <option key={c.id} value={c.id}>{c.name} (TIN: {c.tin})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Order Billing Purpose *</label>
                    <select
                      value={orderPurpose}
                      onChange={(e) => setOrderPurpose(e.target.value as 'Sales' | 'Warranty')}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-700 bg-white"
                    >
                      <option value="Sales">Standard Commercial Sale</option>
                      <option value="Warranty">Warranty Servicing & Parts Replacement</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Machinery Serial Number (Optional Fleet Assoc.)</label>
                    <div className="relative">
                      <input
                        type="text"
                        list="machine-serials"
                        placeholder="e.g. SN-HEX-Y9023, or search fleet..."
                        value={machineSerialNumber}
                        onChange={(e) => setMachineSerialNumber(e.target.value)}
                        className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-slate-900 bg-white"
                      />
                      <datalist id="machine-serials">
                        {machineLogs.map(m => m.serialNumber).filter((v, i, self) => self.indexOf(v) === i).map(sn => {
                          const mLog = machineLogs.find(m => m.serialNumber === sn);
                          return (
                            <option key={sn} value={sn}>{sn} {mLog ? `(${mLog.model})` : ''}</option>
                          );
                        })}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Expected Dispatch Date *</label>
                    <input
                      type="date"
                      required
                      value={shipmentDate}
                      onChange={(e) => setShipmentDate(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Source Dispatch Site *</label>
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-bold text-gray-800 bg-white"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Delivery Logistical Option (Optional)</label>
                    <select
                      value={deliveryOption}
                      onChange={(e) => setDeliveryOption(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white cursor-pointer"
                    >
                      <option value="">-- No delivery option (Undetermined) --</option>
                      <option value="Standard Cargo">Standard Cargo</option>
                      <option value="DHL Express">DHL Express</option>
                      <option value="FedEx Courier">FedEx Courier</option>
                      <option value="Air Freight">Air Freight</option>
                      <option value="Sea Cargo">Sea Cargo</option>
                      <option value="Land Logistics / Lalamove">Land Logistics / Lalamove</option>
                      <option value="Warehouse Pickup">Warehouse Pickup</option>
                      <option value="Standard Mail">Standard Mail</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  {deliveryOption === 'Others' && (
                    <div className="p-3 bg-amber-55/50 rounded-lg border border-amber-200/50 space-y-1.5 animate-in slide-in-from-top-1 duration-100">
                      <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">Forwarder / Courier Name *</label>
                      <input
                        type="text"
                        required={deliveryOption === 'Others'}
                        placeholder="e.g. LBC Express, J&T, etc."
                        value={forwarderName}
                        onChange={(e) => setForwarderName(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 bg-white border border-amber-250 rounded-md focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-semibold text-slate-800"
                      />
                    </div>
                  )}

                  {/* Sales Cluster select */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Sales Cluster *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={['Head Office', 'Homonhon', 'Davao', 'North Luzon', 'CODA', 'Freelance'].includes(region) ? region : 'Other'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Other') {
                            setRegion('Custom Cluster');
                          } else {
                            setRegion(val);
                          }
                        }}
                        required
                        className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800 bg-white"
                      >
                        <option value="Head Office">Head Office</option>
                        <option value="Homonhon">Homonhon</option>
                        <option value="Davao">Davao</option>
                        <option value="North Luzon">North Luzon</option>
                        <option value="CODA">CODA</option>
                        <option value="Freelance">Freelance</option>
                        <option value="Other">Others (Type custom)...</option>
                      </select>

                      {!['Head Office', 'Homonhon', 'Davao', 'North Luzon', 'CODA', 'Freelance'].includes(region) && (
                        <input
                          type="text"
                          required
                          value={region}
                          onChange={(e) => setRegion(e.target.value)}
                          placeholder="Type custom cluster name..."
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-bold text-slate-700 bg-white focus:outline-indigo-500"
                        />
                      )}
                    </div>
                  </div>

                  {/* Sales Category/Classification select */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600 font-mono">Sales Type / tracking *</label>
                    <select
                      value={salesCategory}
                      onChange={(e) => setSalesCategory(e.target.value as 'Parts' | 'Services' | 'Both')}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800 bg-white"
                    >
                      <option value="Parts">Parts Only</option>
                      <option value="Services">Services Only</option>
                      <option value="Both">Both (Parts & Services)</option>
                    </select>
                  </div>
                </div>

                {/* Line Items drafting */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">Lines ({draftedItems.length})</span>
                    <button
                      type="button"
                      onClick={handleAddItemToDraft}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      + Add Row Code
                    </button>
                  </div>

                  <div className="space-y-3 font-sans">
                    {draftedItems.map((row, idx) => {
                      const availableStock = checkStockLevel(row.itemId, warehouseId);
                      const isOverStock = row.quantity > availableStock;
                      const selectedItemObj = items.find(p => p.id === row.itemId);

                      return (
                        <div key={idx} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-left shadow-2xs">
                          {/* Row 1: SKU, Quantity, Unit Price, Total, Delete Button */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            {/* Select Dropdown (Expanded width to fill space) */}
                            <div className="md:col-span-6 text-left">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1 font-mono">
                                Select SKU Asset *
                              </label>
                              <select
                                value={row.itemId}
                                onChange={(e) => {
                                  handleUpdateDraftRow(idx, { itemId: e.target.value });
                                }}
                                className="w-full text-xs px-3 py-2 border border-slate-250 rounded-lg focus:outline-[#1F2937] focus:ring-1 focus:ring-indigo-500 font-bold bg-white text-indigo-900"
                              >
                                {items.map(p => (
                                  <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Quantity */}
                            <div className="md:col-span-2 text-left">
                              <label className="text-[10px] font-bold text-gray-400 uppercase font-mono block mb-1">Quantity</label>
                              <input
                                type="number"
                                min={1}
                                id={`so-quantity-input-form-${idx}`}
                                placeholder="Qty"
                                value={row.quantity}
                                onChange={(e) => handleUpdateDraftRow(idx, { quantity: Math.max(1, parseInt(e.target.value) || 0) })}
                                className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-center font-mono font-bold ${
                                  isOverStock ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-250 bg-white text-gray-900'
                                }`}
                              />
                            </div>

                            {/* Unit Price */}
                            <div className="md:col-span-2 font-mono text-left">
                              <label className="text-[10px] font-bold text-gray-400 uppercase font-mono block mb-1">Unit Price</label>
                              <input
                                type="number"
                                step="any"
                                min={0}
                                placeholder="Unit price"
                                value={row.unitPrice}
                                onChange={(e) => handleUpdateDraftRow(idx, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                                className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-right font-bold text-emerald-805 bg-white"
                              />
                            </div>

                            {/* Multiplied values UI */}
                            <div className="hidden sm:block md:col-span-1 text-right pr-2 text-xs font-mono font-bold text-gray-950 pb-2.5">
                              ₱{(row.quantity * row.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>

                            {/* Delete row */}
                            <div className="md:col-span-1 flex justify-end pb-1.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftRow(idx)}
                                disabled={draftedItems.length === 1}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* SKU and detailed description of product */}
                          {selectedItemObj && (
                            <div className="text-[11px] text-slate-700 bg-white border border-slate-200 p-2.5 rounded-lg flex flex-col sm:flex-row justify-between gap-1.5 font-sans">
                              <div>
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded mr-2 border border-slate-200">
                                  SKU: {selectedItemObj.sku}
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {selectedItemObj.name}
                                </span>
                                {selectedItemObj.description ? (
                                  <span className="text-slate-505 block sm:inline sm:ml-2 italic">
                                    - {selectedItemObj.description}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 block sm:inline sm:ml-2 italic">
                                    (No internal catalog description available)
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-500 font-mono text-[9px] shrink-0 font-medium">
                                Base Sell Price: ₱{selectedItemObj.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} &nbsp;|&nbsp;
                                Category Class: {selectedItemObj.category}
                              </div>
                            </div>
                          )}

                          {/* Row 2: Line Allocation, Inventory Lot Location, and Line Note grouped together */}
                          <div className="bg-slate-100/60 p-3.5 rounded-xl border border-slate-200 mt-2.5">
                            <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest font-mono block mb-2 text-left">
                              ⚙️ Line Allocation, Inventory Lot Location, &amp; Customize Info
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            {/* Select Category/Allocation per line item */}
                            <div className="md:col-span-3 text-left">
                              <label className="text-[10px] font-bold text-gray-450 uppercase font-mono block mb-1">Line Allocation</label>
                              <select
                                value={row.category || 'Parts'}
                                onChange={(e) => handleUpdateDraftRow(idx, { category: e.target.value as 'Parts' | 'Services' })}
                                className="w-full text-xs px-2.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold bg-white text-slate-800"
                              >
                                <option value="Parts">Parts</option>
                                <option value="Services text-slate-800">Services</option>
                              </select>
                            </div>

                            {/* Select Lot */}
                            <div className="md:col-span-4 text-left">
                              <label className="text-[10px] font-bold text-gray-455 uppercase font-mono block mb-1">Inventory Lot Location</label>
                              <select
                                value={row.lotId || ''}
                                onChange={(e) => {
                                  const selectedLotIdForLine = e.target.value || undefined;
                                  
                                  if (selectedLotIdForLine) {
                                    const violation = getFifoViolation(row.itemId, warehouseId, selectedLotIdForLine);
                                    if (violation.violated && violation.selected && violation.oldest) {
                                      const confirmOverride = window.confirm(
                                        `⚠️ FIFO STOCKING PRINCIPLE WARNING!\n\n` +
                                        `The lot "${violation.selected.lotNumber}" is NOT the oldest available lot for this product in the selected warehouse.\n\n` +
                                        `The oldest available lot is "${violation.oldest.lotNumber}" (received on ${new Date(violation.oldest.dateReceived).toLocaleDateString()}).\n\n` +
                                        `Dispensing the selected lot violates the FIFO (First In, First Out) principle.\n\n` +
                                        `Are you sure you want to select this lot?`
                                      );
                                      if (!confirmOverride) {
                                        return;
                                      }
                                    }
                                  }
                                  handleUpdateDraftRow(idx, { lotId: selectedLotIdForLine });
                                }}
                                className="w-full text-xs px-2.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium bg-white text-slate-800 font-sans"
                              >
                                <option value="">Auto-allocate (FIFO)</option>
                                {lots
                                  .filter(l => l.itemId === row.itemId && l.warehouseId === warehouseId && l.quantityRemaining > 0)
                                  .map(l => (
                                    <option key={l.id} value={l.id}>
                                      {l.lotNumber} ({l.quantityRemaining} remaining)
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Line Note */}
                            <div className="md:col-span-5 text-left font-sans">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1 font-mono">
                                ✍️ Line Note / customized instructions
                              </label>
                              <input
                                type="text"
                                value={row.note || ''}
                                onChange={(e) => handleUpdateDraftRow(idx, { note: e.target.value })}
                                placeholder="Add line item customized request..."
                                className="w-full text-xs px-3 py-2 bg-white border border-slate-250 rounded-lg text-slate-700 placeholder-slate-450 focus:outline-[#1F2937] focus:ring-1 focus:ring-indigo-500 font-medium"
                              />
                            </div>
                          </div>
                        </div>
                          
                          {/* Stock Notification indicator */}
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-[10px] text-gray-400 font-mono px-1 gap-1.5 pt-1.5">
                            <span>Site Stock Available: <strong className={availableStock === 0 ? 'text-red-500' : 'text-indigo-600'}>{availableStock} pcs</strong></span>
                            {row.lotId && getFifoViolation(row.itemId, warehouseId, row.lotId).violated && (
                              <span className="text-rose-600 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                FIFO Violation: Older Lot ({getFifoViolation(row.itemId, warehouseId, row.lotId).oldest?.lotNumber}) is available!
                              </span>
                            )}
                            {isOverStock && (
                              <span className="text-amber-600 font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                <AlertCircle className="w-3 h-3" /> Exceeds available depot supply!
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Taxes & Discounts policy selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-gray-150 text-left">
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">VAT/Tax Config</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">Option</label>
                        <select
                          value={taxType}
                          onChange={(e) => setTaxType(e.target.value as 'VAT' | 'Non-VAT' | 'Custom' | 'None')}
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg bg-white font-semibold text-slate-800 focus:outline-[1px] focus:outline-indigo-500"
                        >
                          <option value="VAT">VAT</option>
                          <option value="Non-VAT">Non-VAT</option>
                          <option value="None">Choose to not add any option</option>
                        </select>
                      </div>

                      {taxType === 'Custom' && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">Custom Rate (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={customTaxRate}
                            onChange={(e) => setCustomTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-mono font-bold focus:outline-[1px] focus:outline-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">Discount Policy</span>
                    <div className="grid grid-cols-2 gap-2">
                       <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">Type</label>
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'Percentage' | 'Fixed' | 'None')}
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg bg-white font-semibold text-slate-800 focus:outline-[1px] focus:outline-indigo-500"
                        >
                          <option value="None">None</option>
                          <option value="Percentage">Percentage (%)</option>
                          <option value="Fixed">Fixed Amount (₱)</option>
                        </select>
                      </div>

                      {discountType !== 'None' && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">Value</label>
                          <input
                            type="number"
                            min={0}
                            value={discountValue}
                            onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-mono font-bold focus:outline-[1px] focus:outline-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* File Upload zone with attachments listing */}
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-gray-150 text-left">
                  <span className="text-[11px] font-bold text-slate-700 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                    <span>Upload Documents / Attachments</span>
                  </span>

                  <div className="border-2 border-dashed border-indigo-250 hover:border-indigo-400 transition-colors p-4 rounded-xl bg-indigo-50/10 text-center relative">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <Paperclip className="w-5 h-5 mx-auto text-indigo-500 animate-bounce" />
                      <p className="text-xs font-semibold text-slate-700">Drag items here or click to select files</p>
                      <p className="text-[10px] text-gray-400 font-mono">PDF, XLS, DOCX, ZIP, JPG (max 10MB per file)</p>
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {attachments.map((file) => (
                        <div key={file.id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg shrink-0 text-left">
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-gray-950 truncate">{file.name}</div>
                            <div className="text-[9px] text-gray-400 font-mono">{(file.size / 1024).toFixed(0)} KB</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(file.id)}
                            className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer inputs panel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-150 text-left">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Dispatch Instructions / Shipping Conditions</label>
                    <textarea
                      rows={2.5}
                      placeholder="Special instructions for customer fulfillment..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full text-xs px-3.5 py-1.5 border border-gray-250 rounded-lg bg-white"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs font-mono text-gray-650 text-right pr-2">
                    <div className="flex justify-between max-w-xs ml-auto">
                      <span>Subtotal gross:</span>
                      <span>₱{totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    {discountType !== 'None' && (
                      <div className="flex justify-between max-w-xs ml-auto text-red-600 font-semibold">
                        <span>Discount ({discountType === 'Percentage' ? `${discountValue}%` : 'Fixed'}):</span>
                        <span>-₱{totals.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {discountType !== 'None' && (
                      <div className="flex justify-between max-w-xs ml-auto text-gray-400 font-bold border-t border-dashed border-gray-200 pt-1">
                        <span>Subtotal After Disc:</span>
                        <span>₱{totals.subtotalAfterDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {taxType !== 'None' && (
                      <div className="flex justify-between max-w-xs ml-auto text-indigo-800">
                        <span>
                          {taxType === 'VAT' ? 'Philippines VAT (12%):' : taxType === 'Non-VAT' ? 'Non-VAT (0%):' : `Custom Option Tax (${customTaxRate}%):`}
                        </span>
                        <span>₱{totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div className="flex justify-between max-w-xs ml-auto border-t border-gray-250 pt-1.5 text-sm font-bold text-gray-950 font-mono">
                      <span>Grand Total:</span>
                      <span>₱{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                {hasInadequateStock() && (
                  <span className="text-xs text-red-650 font-bold mr-auto flex items-center gap-1 pl-1">
                    <AlertCircle className="w-4 h-4 animate-ping" /> Cannot register order with insufficient stocking!
                  </span>
                )}
                
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={hasInadequateStock()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                >
                  Save Sales Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Machinery Explorer Modal - Dynamic */}
      {renderMachineSerialModal()}

      {/* COMPLIANT PHILIPPINES DELIVERY RECEIPT (DR) MODAL */}
      {isDeliveryReceiptOpen && focusedSO && (() => {
        const selectedCust = customers.find(c => c.id === focusedSO.customerId);
        const originWarehouse = warehouses.find(w => w.id === focusedSO.warehouseId);
        
        const drNumber = selectedDRForView ? selectedDRForView.drNumber : `DR-${focusedSO.soNumber.replace('SO-', '')}`;
        const dispatchDate = selectedDRForView ? selectedDRForView.dispatchDate : (focusedSO.actualDeliveryDate || focusedSO.shipmentDate || new Date().toISOString().split('T')[0]);
        const dispatchedBy = selectedDRForView ? selectedDRForView.dispatchedBy : 'Logistics Supervisor';
        const notesValue = selectedDRForView ? selectedDRForView.notes : 'Shipment dispatched in compliance with sales layout criteria and transit security. All custom logs preserved.';

        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 duration-150">
              {/* Header Controller Bar */}
              <div className="bg-slate-50 p-4 border-b border-gray-150 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-black text-slate-700 tracking-wide uppercase font-mono">
                    Delivery Receipt Document Generated Successfully
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      alert(`🖨️ Simulated Delivery Receipt Print triggered!\n\nStandard print layouts compiled for ${drNumber}.\n\n(A PDF generation pipeline has been simulated in this preview)`);
                    }}
                    className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-xs font-bold text-white rounded-md cursor-pointer transition-all duration-100"
                  >
                    Simulate Print DR
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeliveryReceiptOpen(false)}
                    className="p-1 hover:bg-gray-200 text-gray-500 rounded-md cursor-pointer transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable DR Payload Area */}
              <div className="p-8 overflow-y-auto space-y-6 text-left selection:bg-indigo-100">
                {/* Print Sheet Borders */}
                <div className="border border-slate-350 p-6 md:p-8 bg-slate-50/10 rounded-xl space-y-6 relative overflow-hidden font-sans">
                  {/* Visual Background Stamp */}
                  <div className="absolute right-[-30px] top-[140px] opacity-[0.02] text-[180px] font-black rotate-[-25deg] select-none tracking-widest pointer-events-none">
                    DELIVERY
                  </div>

                  {/* Top Company Metadata Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-slate-250 pb-6">
                    <div className="space-y-1.5">
                      <h4 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                        HEAVY FLEET DISTRIBUTORS INC.
                      </h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                        Heavy Machinery Parts, Supplies, Logistics & Field Services<br />
                        88 Pier 12, South Harbor, Port Area, Manila, Metro Manila, PH<br />
                        Tel: +63 (02) 8800-4560 | Tax Registration TIN: 005-985-712-000
                      </p>
                    </div>
                    <div className="text-left md:text-right space-y-1.5">
                      <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold text-[10px] tracking-widest uppercase font-mono">
                        Delivery Receipt (DR)
                      </span>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800 font-mono">DR No: {drNumber}</p>
                        <p className="text-[10px] text-slate-500">Date Issued: {dispatchDate}</p>
                        <p className="text-[10px] text-slate-500 font-mono">Order Ref: {focusedSO.soNumber}</p>
                      </div>
                    </div>
                  </div>

                  {/* Customer details and Delivery Depot Address Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-205 space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase block font-mono">
                        DELIVER & BILL TO CUSTOMER
                      </span>
                      <div className="font-bold text-slate-800 text-xs">
                        {selectedCust?.name || focusedSO.customerName}
                      </div>
                      <p className="text-slate-600 font-medium whitespace-pre-line">
                        {selectedCust?.address || 'No Registered TIN Account Address on File'}
                      </p>
                      <p className="text-slate-500">
                        Phone: {selectedCust?.phone || 'N/A'} | Email: {selectedCust?.email || 'N/A'}
                      </p>
                      {selectedCust?.tin && (
                        <p className="font-mono text-[9px] font-extrabold text-indigo-700">
                          REGISTERED TAX TIN: {selectedCust.tin}
                        </p>
                      )}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-205 space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase block font-mono">
                        LOGISTICAL RELEASE INFO
                      </span>
                      <div>
                        <span>Dispatch Origin: </span>
                        <b className="text-slate-700">
                          {originWarehouse?.name || 'Central Site'} ({originWarehouse?.code || 'MAIN'})
                        </b>
                      </div>
                      <div>
                        <span>Est. Shipment Date: </span>
                        <b className="text-slate-700 font-mono">{dispatchDate}</b>
                      </div>
                      <div>
                        <span>Logistics Option: </span>
                        <b className="text-indigo-700 font-bold tracking-tight">
                          {focusedSO.deliveryOption || 'Standard Cargo'}
                        </b>
                      </div>
                      <div className="p-2 bg-slate-100 rounded-md border border-slate-200 mt-1 flex justify-between gap-2 items-center">
                        <div className="space-y-0.5">
                          <span className="text-[8px] font-bold text-slate-400 font-mono block">PAYMENT:</span>
                          <span className={`text-[9px] font-black tracking-wide ${focusedSO.isPaid ? 'text-emerald-700' : 'text-red-700'}`}>
                            {focusedSO.isPaid ? 'PAID ✓' : 'PENDING PAYMENT ✗'}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[8px] font-bold text-slate-400 font-mono block">INVOICE ST:</span>
                          <span className={`text-[9px] font-black tracking-wide ${focusedSO.invoiceCreated ? 'text-blue-700' : 'text-amber-700'}`}>
                            {focusedSO.invoiceCreated ? 'INVOICED ✓' : 'NOT INVOICED ✗'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ordered items listing layout */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 font-mono text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                          <th className="px-4 py-2.5">SKU / Item</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5 text-center">Assigned Block Lot</th>
                          <th className="px-4 py-2.5 text-right">Qty Released</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-sans text-xs">
                        {(() => {
                          const drLines = selectedDRForView 
                            ? selectedDRForView.items 
                            : focusedSO.items.map(it => {
                                const originalItem = items.find(p => p.id === it.itemId);
                                return {
                                  itemId: it.itemId,
                                  sku: originalItem?.sku || 'SKU-N/A',
                                  name: originalItem?.name || 'Unknown Item Spec',
                                  quantity: it.quantity,
                                  unitPrice: it.unitPrice,
                                  category: it.category,
                                  lotId: it.lotId
                                };
                              });

                          return drLines.map((line, idx) => {
                            const matchedItem = items.find(p => p.id === line.itemId);
                            const associatedLot = lots.find(l => l.id === (line as any).lotId || l.itemId === line.itemId);
                            
                            return (
                              <tr key={idx} className="hover:bg-slate-50/60 font-medium whitespace-none">
                                <td className="px-4 py-3">
                                  <b className="text-slate-805 font-mono block">{line.sku}</b>
                                  <span className="text-slate-660 font-sans text-[10.5px] block">{line.name}</span>
                                </td>
                                <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
                                  {(line as any).category || 'Parts'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {associatedLot ? (
                                    <div className="space-y-0.5">
                                      <span className="font-mono text-[10px] bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-indigo-700 font-bold">
                                        {associatedLot.lotNumber}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px]">No batch lot allocated</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                  {line.quantity} pcs
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Terms Conditions (Without Pricing Totals Box) */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-2">
                    <div className="text-[10px] text-slate-450 leading-relaxed font-sans max-w-sm">
                      <b>TERMS & CONDITIONS:</b> All physical goods listed on this Delivery Receipt must be counted and cross-inspected. Any claim for missing stock or shipping defect must be filed formally within 48 hours of transit release. Signatories verify goods arrived complete and fit for service operations.
                    </div>
                  </div>

                  {/* Notes remark status from specific sheet */}
                  <div className="p-3 bg-red-50/20 border border-slate-200 rounded-lg text-left text-[11px] text-slate-700 italic">
                    <span className="font-mono text-[9px] block uppercase font-bold text-gray-500 mb-0.5 font-sans">DELIVERY DESPATCH OBSERVATIONS:</span>
                    {notesValue}
                  </div>

                  {/* Official Signatures Row */}
                  <div className="grid grid-cols-3 gap-6 pt-12 text-[10px] leading-snug">
                    <div className="space-y-8 text-center border-t border-slate-350 pt-2.5">
                      <span className="font-bold text-slate-750 block text-xs font-serif italic text-emerald-800">
                        {dispatchedBy}
                      </span>
                      <span className="text-slate-450 uppercase font-mono block">Released (Planning & Dispatch)</span>
                    </div>

                    <div className="space-y-8 text-center border-t border-slate-330 pt-2.5">
                      <div className="h-4"></div>
                      <span className="text-slate-450 uppercase font-mono block">Checked By (Warehouse Security)</span>
                    </div>

                    <div className="space-y-8 text-center border-t border-slate-350 pt-2.5 font-sans">
                      <div className="h-4"></div>
                      <span className="text-slate-450 uppercase font-mono block">Customer Seal & Signature</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close controls at bottom */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDeliveryReceiptOpen(false)}
                  className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors"
                >
                  Close Document Viewer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PRINTER-FRIENDLY WAREHOUSE FULFILLMENT PICK LIST MODAL */}
      {isPickListOpen && focusedSO && (() => {
        const selectedCust = customers.find(c => c.id === focusedSO.customerId);
        const originWarehouse = warehouses.find(w => w.id === focusedSO.warehouseId);
        
        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden transform transition-all animate-in zoom-in-95 duration-150">
              
              {/* Header Controller Bar */}
              <div className="bg-slate-50 p-4 border-b border-gray-150 flex items-center justify-between no-print">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-black text-slate-700 tracking-wide uppercase font-mono">
                    Fulfillment Operations - Warehouse Pick Slip
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white rounded-md cursor-pointer transition-all duration-100 flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPickListOpen(false)}
                    className="p-1.5 hover:bg-slate-200 text-gray-500 rounded-md cursor-pointer transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Area */}
              <div className="p-8 overflow-y-auto flex-1 bg-white print:p-0" id="printable-pick-list">
                {/* Visual design resembling a real warehouse printout sheet */}
                <div className="border-4 border-double border-slate-800 p-6 space-y-6 text-slate-800 text-left font-sans text-xs">
                  
                  {/* Top Ticket Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                    <div>
                      <h3 className="text-xl font-black font-sans tracking-wide uppercase">WAREHOUSE PICK LIST</h3>
                      <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mt-0.5">Physical Inventory Fulfillment Ticket</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block border-2 border-slate-800 px-3 py-1 text-base font-black font-mono">
                        {focusedSO.soNumber}
                      </span>
                      <p className="text-[9px] text-gray-400 font-mono mt-1">ISSUED DATE: {focusedSO.orderDate || new Date().toISOString().split('T')[0]}</p>
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border border-slate-300 rounded font-mono text-[11px]">
                    <div className="space-y-1">
                      <p><span className="text-gray-450 uppercase font-black text-[9px] block">Dispatcher Origin</span>
                        <strong className="text-slate-900">{originWarehouse?.name || 'Main Warehouse Depot'} ({originWarehouse?.code || 'MAIN'})</strong>
                      </p>
                      <p className="pt-1"><span className="text-gray-450 uppercase font-black text-[9px] block">Storage Location</span>
                        <span>{originWarehouse?.location || 'Central Depot Axis'}</span>
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <p><span className="text-gray-450 uppercase font-black text-[9px] block">Customer Assign</span>
                        <strong className="text-slate-900">{selectedCust?.name || focusedSO.customerName}</strong>
                      </p>
                      <p className="pt-1"><span className="text-gray-450 uppercase font-black text-[9px] block">Delivery Route Option</span>
                        <span className="font-bold text-slate-800">{focusedSO.deliveryOption || 'Standard Cargo'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Core checklist items */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono font-black tracking-widest text-slate-500 block">Fulfillment Lines Checklist</span>
                    
                    <div className="border border-slate-400 rounded overflow-hidden">
                      <table className="min-w-full divide-y divide-slate-300 text-left text-xs text-slate-800">
                        <thead>
                          <tr className="bg-slate-100 font-mono text-[9px] text-slate-600 font-black uppercase tracking-wider">
                            <th className="px-3 py-2 border-r border-slate-200">Checked</th>
                            <th className="px-3 py-2 border-r border-slate-200">SKU Code</th>
                            <th className="px-4 py-2 border-r border-slate-200">Item Name</th>
                            <th className="px-3 py-2 border-r border-slate-200 text-center">Fulfill Qty</th>
                            <th className="px-3 py-2">Assigned Lot / Shelf Reference</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-sans text-xs">
                          {focusedSO.items.map((line, idx) => {
                            const itemObj = items.find(p => p.id === line.itemId);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="px-3 py-3 border-r border-slate-200 text-center">
                                  <div className="w-5 h-5 border-2 border-slate-800 rounded mx-auto flex items-center justify-center font-bold text-slate-900 font-mono">
                                    [ ]
                                  </div>
                                </td>
                                <td className="px-3 py-3 border-r border-slate-200 font-mono text-[11px] font-bold text-slate-750">
                                  {itemObj?.sku || 'SKU-000'}
                                </td>
                                <td className="px-4 py-3 border-r border-slate-200 text-slate-900">
                                  <div className="font-bold">{itemObj?.name || 'Generic Item'}</div>
                                  <div className="text-[10px] text-gray-500 font-mono">{itemObj?.category}</div>
                                </td>
                                <td className="px-3 py-3 border-r border-slate-200 text-center font-mono font-black text-sm text-slate-950">
                                  {line.quantity.toLocaleString()} pcs
                                </td>
                                <td className="px-3 py-3 font-mono text-[10px] text-slate-600 space-y-0.5">
                                  {line.lotId ? (
                                    <>
                                      <span className="font-bold text-slate-800">LOT:</span> {(lots || []).find(l => l.id === line.lotId)?.lotNumber || 'FIFO MATCH'}
                                    </>
                                  ) : (
                                    <span className="text-gray-455 italic">System Auto-FIFO Selection</span>
                                  )}
                                  <div className="text-[9px] text-gray-450 font-bold uppercase">SEC: SHELF-D{idx+1}</div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Operational Notes / Sign-offs */}
                  <div className="grid grid-cols-2 gap-6 pt-10 text-center">
                    <div className="space-y-8">
                      <div className="h-4"></div>
                      <div className="border-t border-slate-400 pt-2 font-mono text-[10px] uppercase text-gray-500 font-black">
                        Picker Handover Signature & Date
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="h-4"></div>
                      <div className="border-t border-slate-400 pt-2 font-mono text-[10px] uppercase text-gray-500 font-black">
                        Warehouse Manager Verification
                      </div>
                    </div>
                  </div>

                  {/* Print barcode aesthetics */}
                  <div className="flex flex-col items-center pt-6 justify-center">
                    <div className="font-mono text-[9px] tracking-[4px] uppercase font-bold text-slate-700 border-x border-slate-800 px-6 py-1">
                      ||||| | | ||||| | |||| | ||| {focusedSO.soNumber} ||||| ||
                    </div>
                    <span className="text-[8px] text-gray-400 font-mono tracking-widest font-bold mt-1">AUTOMATED WORKFLOW WAREHOUSE SLIP V1.0</span>
                  </div>

                </div>
              </div>

              {/* Close controls at bottom */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end no-print">
                <button
                  type="button"
                  onClick={() => setIsPickListOpen(false)}
                  className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors"
                >
                  Close Document View
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ZOHO STYLE DELIVERY RECEIPT CREATOR MODAL */}
      {isCreateReceiptOpen && focusedSO && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-250 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-750 to-indigo-850 bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-left">
                <Truck className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold font-mono leading-none">NEW DELIVERY RECEIPT</h3>
                  <p className="text-[10px] text-indigo-200 font-sans mt-1">For Sales Order: {focusedSO.soNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateReceiptOpen(false)}
                className="text-indigo-200 hover:text-white p-1 rounded hover:bg-indigo-900/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Scrollable Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();

                // Validate at least one item quantity is received/shipped > 0
                const hasSelectedItems = Object.entries(receiptForm.shippedAmounts).some(([itemId, qty]) => Number(qty) > 0);
                if (!hasSelectedItems) {
                  alert("⚠️ Warning: You must input a dispatch quantity (> 0) for at least one item to log a delivery.");
                  return;
                }

                // Call onShipSOBatch prop
                if (onShipSOBatch) {
                  onShipSOBatch(
                    focusedSO.id,
                    receiptForm.receiptNumber,
                    receiptForm.dispatchedBy,
                    receiptForm.dispatchDate,
                    receiptForm.notes,
                    receiptForm.shippedAmounts
                  );
                }

                setIsCreateReceiptOpen(false);
              }}
              className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-left bg-slate-50/50"
            >
              {/* Metadata Fields Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-gray-150">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Delivery Receipt Number *</label>
                  <input
                    type="text"
                    required
                    value={receiptForm.receiptNumber}
                    onChange={(e) => setReceiptForm({ ...receiptForm, receiptNumber: e.target.value })}
                    className="w-full text-xs font-mono font-bold text-gray-900 border border-gray-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Dispatch Date *</label>
                  <input
                    type="date"
                    required
                    value={receiptForm.dispatchDate}
                    onChange={(e) => setReceiptForm({ ...receiptForm, dispatchDate: e.target.value })}
                    className="w-full text-xs font-mono font-medium text-gray-950 border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Dispatched By / Logistics *</label>
                  <input
                    type="text"
                    required
                    value={receiptForm.dispatchedBy}
                    onChange={(e) => setReceiptForm({ ...receiptForm, dispatchedBy: e.target.value })}
                    className="w-full text-xs font-medium text-gray-950 border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Items Despatch Matrix Grid */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] uppercase font-extrabold text-gray-400 tracking-wider font-mono block">
                  Items Shipment Despatch matrix
                </span>
                
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-2xs">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-50 border-b border-gray-200 text-slate-700 text-[10px] uppercase tracking-wider font-mono">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">SKU / Item Details</th>
                        <th className="px-4 py-3 text-right font-semibold">Ordered</th>
                        <th className="px-4 py-3 text-right font-semibold">Already Shipped</th>
                        <th className="px-4 py-3 text-right font-semibold">Balance to Ship</th>
                        <th className="px-4 py-3 text-center font-semibold w-32 font-mono">Qty Dispatched Now</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-slate-800">
                      {focusedSO.items.map((it) => {
                        const originalItem = items.find(p => p.id === it.itemId);
                        const alreadyShipped = it.shippedQuantity || 0;
                        const balance = Math.max(0, it.quantity - alreadyShipped);
                        const shippingNowValue = receiptForm.shippedAmounts[it.itemId] ?? 0;

                        return (
                          <tr key={it.itemId} className="hover:bg-slate-50/50 animate-in fade-in">
                            <td className="px-4 py-3">
                              <span className="font-bold text-slate-900 block">{originalItem?.name || 'Linked SKU Spec'}</span>
                              <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-mono mt-0.5 font-bold">
                                <span className="text-indigo-650 font-extrabold">{originalItem?.sku || 'N/A'}</span>
                                {originalItem?.unit && <span>({originalItem.unit})</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-slate-600">
                              {it.quantity}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600">
                              {alreadyShipped}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">
                              {balance}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {balance <= 0 ? (
                                <span className="inline-block px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded-full font-sans">
                                  Fully Despatched
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max={balance}
                                  value={shippingNowValue === 0 ? '' : shippingNowValue}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const parsedVal = parseInt(e.target.value) || 0;
                                    const constrained = Math.min(Math.max(0, parsedVal), balance);
                                    setReceiptForm({
                                      ...receiptForm,
                                      shippedAmounts: {
                                        ...receiptForm.shippedAmounts,
                                        [it.itemId]: constrained
                                      }
                                    });
                                  }}
                                  className="w-24 text-center font-mono font-bold text-xs text-slate-950 border border-gray-300 rounded-lg p-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:border-indigo-600 bg-indigo-50/10 focus:bg-white"
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Observations, Shipment Notes & Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Record carrier tracking references, driver info, custom plate numbers, or package weight checks..."
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  className="w-full text-xs font-medium text-gray-950 border border-gray-300 rounded-lg p-2.5 bg-white focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none focus:border-indigo-505 transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-200 shrink-0 font-sans">
                <button
                  type="button"
                  onClick={() => setIsCreateReceiptOpen(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-mono font-bold rounded-lg border border-slate-200 cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-mono font-bold rounded-lg shadow-xs hover:shadow-sm cursor-pointer transition-all"
                >
                  ✔ Commit Delivery Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rapid SO QR Scanner Modal removed */}
    </div>
  );
}
