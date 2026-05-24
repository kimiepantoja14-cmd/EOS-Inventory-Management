/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import {
  PurchaseOrder,
  Item,
  Warehouse,
  POItem,
  Supplier,
  AttachmentRecord,
  UserRecord,
  StockLot,
  ExplicitGoodsReceipt,
} from "../types";
import { LogisticsBarcodeCard } from "./BarcodeQRGenerator";
import {
  Search,
  Plus,
  Calendar,
  Clock,
  Landmark,
  Eye,
  Truck,
  CheckCircle,
  Ban,
  X,
  Trash2,
  ShieldCheck,
  ShoppingCart,
  Pencil,
  Mail,
  Phone,
  User,
  FileText,
  MapPin,
  Paperclip,
  ShieldAlert,
  AlertCircle,
  Printer,
  FileCheck,
} from "lucide-react";

interface PurchaseOrdersProps {
  purchaseOrders: PurchaseOrder[];
  items: Item[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  onCreatePO: (po: Omit<PurchaseOrder, "id">) => void;
  onUpdatePOStatus: (
    poId: string,
    status: PurchaseOrder["status"],
    changeReason?: string,
    operatorName?: string,
  ) => void;
  onEditPO?: (po: PurchaseOrder, isRemarkOnly?: boolean) => void;
  currentUser?: UserRecord | null;
  users?: UserRecord[];
  lots?: StockLot[];
  onReceivePOBatch?: (
    poId: string,
    receiptNumber: string,
    receivedBy: string,
    receivedDate: string,
    notes: string,
    receivedAmounts: Record<string, number>,
    lotNumbers?: Record<string, string>,
    lotSplits?: Array<{ itemId: string; lotNumber: string; quantity: number; expiryDate?: string }>
  ) => void;
  explicitGoodsReceipts?: any[];
  onDeletePO?: (poId: string) => void;
  onDeleteGoodsReceipt?: (grId: string) => void;
}

export default function PurchaseOrders({
  purchaseOrders,
  items,
  warehouses,
  suppliers,
  onCreatePO,
  onUpdatePOStatus,
  onEditPO,
  currentUser,
  users,
  lots = [],
  onReceivePOBatch,
  explicitGoodsReceipts = [],
  onDeletePO,
  onDeleteGoodsReceipt,
}: PurchaseOrdersProps) {
  const getCurrencySymbol = (curr?: string) => {
    if (!curr) return "$";
    switch (curr.toUpperCase()) {
      case "PHP": return "₱";
      case "JPY": return "¥";
      case "USD": return "$";
      case "EUR": return "€";
      case "GBP": return "£";
      default: return `${curr} `;
    }
  };

  // UI states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState("All");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState("All");
  const [focusedPO, setFocusedPO] = useState<PurchaseOrder | null>(null);

  // Bulk selected lists & local persistence archiving state
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [archivedPoIds, setArchivedPoIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("archived_purchase_order_ids") || "[]");
    } catch (e) {
      return [];
    }
  });
  const [showArchived, setShowArchived] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const canEditPurchaseOrders = currentUser?.role === 'Admin' || (currentUser?.permissions?.canEditPurchaseOrders ?? false);

  const handleArchiveSelectedPOs = () => {
    if (selectedPoIds.length === 0) return;
    const newArchived = Array.from(new Set([...archivedPoIds, ...selectedPoIds]));
    setArchivedPoIds(newArchived);
    localStorage.setItem("archived_purchase_order_ids", JSON.stringify(newArchived));
    setFeedbackMessage(`Batch Operation: Archived ${selectedPoIds.length} purchase orders successfully.`);
    setSelectedPoIds([]);
    setTimeout(() => setFeedbackMessage(""), 4000);
  };

  const handleUnarchiveSelectedPOs = () => {
    if (selectedPoIds.length === 0) return;
    const newArchived = archivedPoIds.filter(id => !selectedPoIds.includes(id));
    setArchivedPoIds(newArchived);
    localStorage.setItem("archived_purchase_order_ids", JSON.stringify(newArchived));
    setFeedbackMessage(`Batch Operation: Unarchived ${selectedPoIds.length} purchase orders successfully.`);
    setSelectedPoIds([]);
    setTimeout(() => setFeedbackMessage(""), 4000);
  };

  const handleBulkStatusChange = (newStatus: PurchaseOrder["status"]) => {
    if (selectedPoIds.length === 0) return;
    selectedPoIds.forEach(id => {
      onUpdatePOStatus(
        id, 
        newStatus, 
        "Bulk status transformation event.", 
        currentUser?.name || "Staff Member"
      );
    });
    setFeedbackMessage(`Batch Operation: Set status of ${selectedPoIds.length} purchase orders to [${newStatus}] successfully.`);
    setSelectedPoIds([]);
    setTimeout(() => setFeedbackMessage(""), 4000);
  };

  // Synchronize focusedPO with updated props when purchaseOrders changes
  useEffect(() => {
    if (focusedPO) {
      const currentPO = purchaseOrders.find(p => p.id === focusedPO.id);
      if (currentPO && JSON.stringify(currentPO) !== JSON.stringify(focusedPO)) {
        setFocusedPO(currentPO);
      }
    }
  }, [purchaseOrders, focusedPO]);

  const getOldestLotInfo = (itemId: string, currentWarehouseId: string) => {
    const activeLots = (lots || []).filter(
      (l) => l.itemId === itemId && l.warehouseId === currentWarehouseId && l.quantityRemaining > 0
    );
    if (activeLots.length === 0) return null;
    const sorted = [...activeLots].sort(
      (a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime()
    );
    return sorted[0];
  };

  const getFifoViolation = (itemId: string, currentWarehouseId: string, selectedLotId?: string) => {
    if (!selectedLotId) return { violated: false };
    const oldest = getOldestLotInfo(itemId, currentWarehouseId);
    if (!oldest) return { violated: false };
    if (oldest.id !== selectedLotId) {
      const selected = (lots || []).find((l) => l.id === selectedLotId);
      return { violated: true, oldest, selected };
    }
    return { violated: false };
  };
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isGoodsReceiptOpen, setIsGoodsReceiptOpen] = useState(false);
  const [isCreateReceiptOpen, setIsCreateReceiptOpen] = useState(false);
  const [selectedGRForView, setSelectedGRForView] = useState<ExplicitGoodsReceipt | null>(null);
  const [lotSplitsState, setLotSplitsState] = useState<Record<string, Array<{ id: string; lotNumber: string; quantity: number; expiryDate?: string }>>>({});
  const [receiptForm, setReceiptForm] = useState({
    receiptNumber: '',
    receivedBy: currentUser?.name || 'Staff Member',
    receivedDate: new Date().toISOString().split('T')[0],
    notes: '',
    receivedAmounts: {} as Record<string, number>,
    lotNumbers: {} as Record<string, string>
  });

  const handleOpenCreateReceipt = () => {
    if (!focusedPO) return;
    const generatedNo = `GR-${focusedPO.poNumber.substring(3)}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Calculate remaining quantities for each item in the PO
    const initialAmounts: Record<string, number> = {};
    const initialLots: Record<string, string> = {};
    const initialSplits: Record<string, Array<{ id: string; lotNumber: string; quantity: number; expiryDate?: string }>> = {};

    focusedPO.items.forEach(it => {
      const remaining = it.quantity - (it.receivedQuantity || 0);
      const qtyStr = remaining > 0 ? remaining : 0;
      initialAmounts[it.itemId] = qtyStr;
      
      // Build a clean default lot ID/number value
      const randValue = Math.floor(1000 + Math.random() * 9000);
      const itemObj = items.find(p => p.id === it.itemId);
      const defaultLotNo = `LOT-${focusedPO.poNumber.substring(3)}-${itemObj?.sku || 'SKU'}-${randValue}`;
      initialLots[it.itemId] = defaultLotNo;

      // Establish initial lot splits list with 1 entry of full remaining qty
      initialSplits[it.itemId] = [
        { id: Math.random().toString(36).substring(7), lotNumber: defaultLotNo, quantity: qtyStr, expiryDate: '' }
      ];
    });

    setLotSplitsState(initialSplits);
    setReceiptForm({
      receiptNumber: generatedNo,
      receivedBy: currentUser?.name || 'Staff Member',
      receivedDate: new Date().toISOString().split('T')[0],
      notes: '',
      receivedAmounts: initialAmounts,
      lotNumbers: initialLots
    });
    setIsCreateReceiptOpen(true);
  };

  // Status transition states
  const [poStatusTarget, setPoStatusTarget] =
    useState<PurchaseOrder["status"]>("Draft");
  const [poStatusChangeReason, setPoStatusChangeReason] = useState("");
  const [poStatusChangeUser, setPoStatusChangeUser] = useState("");

  // Edit PO State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPOId, setEditingPOId] = useState<string | null>(null);
  const [editVendorName, setEditVendorName] = useState("");
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editOrderDate, setEditOrderDate] = useState("");
  const [editDeliveryDate, setEditDeliveryDate] = useState("");
  const [editWarehouseId, setEditWarehouseId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDraftedItems, setEditDraftedItems] = useState<POItem[]>([]);
  const editSupplierCurrency = suppliers.find((s) => s.id === editSupplierId)?.currency || "USD";

  // Form states for Create PO
  const [vendorName, setVendorName] = useState(suppliers[0]?.name || "");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [orderDate, setOrderDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || "");
  const [deliveryOption, setDeliveryOption] = useState("");
  const [notes, setNotes] = useState("");

  // Editable purchase order number, custom tax, discounts, and attachments
  const [poNumber, setPoNumber] = useState("");
  const [taxType, setTaxType] = useState<"VAT" | "Non-VAT" | "Custom" | "None">(
    "None",
  );
  const [customTaxRate, setCustomTaxRate] = useState<number>(12);
  const [discountType, setDiscountType] = useState<
    "Percentage" | "Fixed" | "None"
  >("None");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([]);

  // Editing custom states
  const [editPoNumber, setEditPoNumber] = useState("");
  const [editTaxType, setEditTaxType] = useState<
    "VAT" | "Non-VAT" | "Custom" | "None"
  >("None");
  const [editCustomTaxRate, setEditCustomTaxRate] = useState<number>(12);
  const [editDiscountType, setEditDiscountType] = useState<
    "Percentage" | "Fixed" | "None"
  >("None");
  const [editDiscountValue, setEditDiscountValue] = useState<number>(0);
  const [editAttachments, setEditAttachments] = useState<AttachmentRecord[]>(
    [],
  );
  const [editDeliveryOption, setEditDeliveryOption] = useState("");

  const [poLogRemarks, setPoLogRemarks] = useState<Record<number, string>>({});

  const handleAppendPoLogRemark = (logIdx: number, text: string) => {
    if (!focusedPO || !text.trim() || !onEditPO) return;
    
    const fallbackHistory = focusedPO.statusHistory && focusedPO.statusHistory.length > 0
      ? [...focusedPO.statusHistory]
      : [...getInitialHistoryFallback(focusedPO)];
      
    if (logIdx >= 0 && logIdx < fallbackHistory.length) {
      const entry = { ...fallbackHistory[logIdx] };
      entry.note = `${entry.note} (${text.trim()})`;
      fallbackHistory[logIdx] = entry;
      
      const updatedPO: PurchaseOrder = {
        ...focusedPO,
        statusHistory: fallbackHistory
      };
      
      onEditPO(updatedPO, true);
      setFocusedPO(updatedPO);
    }
  };

  // File upload and size parser helpers
  const handleFileUpload = (
    e: ChangeEvent<HTMLInputElement>,
    isEdit: boolean,
  ) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const record: AttachmentRecord = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: reader.result as string,
          uploadedAt: new Date().toISOString().split("T")[0],
        };
        if (isEdit) {
          setEditAttachments((prev) => [...prev, record]);
        } else {
          setAttachments((prev) => [...prev, record]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAttachment = (id: string, isEdit: boolean) => {
    if (isEdit) {
      setEditAttachments((prev) => prev.filter((att) => att.id !== id));
    } else {
      setAttachments((prev) => prev.filter((att) => att.id !== id));
    }
  };

  // Custom items currently drafted inside PO
  const [draftedItems, setDraftedItems] = useState<POItem[]>([
    {
      itemId: items[0]?.id || "",
      quantity: 10,
      unitCost: items[0]?.purchasePrice || 0,
    },
  ]);

  // Keep focused PO updated when parent list transitions (such as state updates or edits)
  useEffect(() => {
    if (focusedPO) {
      const freshest = purchaseOrders.find((po) => po.id === focusedPO.id);
      if (freshest) {
        setFocusedPO(freshest);
      }
    }
  }, [purchaseOrders]);

  // Sync state transitions and prefill defaults
  useEffect(() => {
    if (focusedPO) {
      setPoStatusTarget(focusedPO.status);
      setPoStatusChangeUser(currentUser?.name || "");
      setPoStatusChangeReason("");
    }
  }, [focusedPO?.id, currentUser]);

  // Sync state targets whenever focused PO changes
  useEffect(() => {
    if (focusedPO) {
      setPoStatusTarget(focusedPO.status);
      setPoStatusChangeReason("");
    } else {
      setPoStatusTarget("Draft");
      setPoStatusChangeReason("");
    }
  }, [focusedPO?.id]);

  // Sync operator user whenever currentUser or focusedPO changes
  useEffect(() => {
    if (currentUser) {
      setPoStatusChangeUser(currentUser.name);
    } else {
      setPoStatusChangeUser("Staff Member");
    }
  }, [currentUser, focusedPO?.id]);

  const getInitialHistoryFallback = (po: PurchaseOrder) => {
    const list: {
      status: PurchaseOrder["status"];
      date: string;
      note: string;
      user: string;
    }[] = [];
    list.push({
      status: "Draft",
      date: po.orderDate,
      note: "Purchase Order drafted with custom item configs.",
      user: "System Admin",
    });
    if (po.status === "Issued" || po.status === "Received") {
      list.push({
        status: "Issued",
        date: po.orderDate,
        note: `Purchase Order status issued and dispatched to supplier brand: ${po.vendorName}.`,
        user: "System Admin",
      });
    }
    if (po.status === "Received") {
      list.push({
        status: "Received",
        date: po.actualDeliveryDate || po.deliveryDate,
        note: "All items received in full. Dynamic warehouse inventory updated successfully.",
        user: "Warehouse Mgr",
      });
    }
    if (po.status === "Cancelled") {
      list.push({
        status: "Cancelled",
        date: po.orderDate,
        note: "Purchase Order cancelled. Operations logs locked.",
        user: "System Admin",
      });
    }
    return list;
  };

  // Selected supplier details for draft
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const poCurrency = selectedSupplier?.currency || "USD";
  const poExchangeRate = selectedSupplier?.exchangeRate || 1.0;

  // Filtering list
  const filteredPOs = purchaseOrders.filter((po) => {
    const isArchived = archivedPoIds.includes(po.id);
    if (isArchived && !showArchived) return false;

    const matchSearch =
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      selectedStatus === "All" || po.status === selectedStatus;
    const matchSupplier =
      selectedSupplierFilter === "All" || po.supplierId === selectedSupplierFilter;
    const matchWarehouse =
      selectedWarehouseFilter === "All" || po.warehouseId === selectedWarehouseFilter;
    return matchSearch && matchStatus && matchSupplier && matchWarehouse;
  });

  const getRowTotal = (row: POItem) => {
    return row.quantity * (row.unitCost ?? 0);
  };

  // Calculate Draft Summary
  const calculateDraftTotals = () => {
    const subtotal = draftedItems.reduce(
      (acc, row) => acc + row.quantity * (row.unitCost ?? 0),
      0,
    );
    let discountAmount = 0;
    if (discountType === "Percentage") {
      discountAmount = subtotal * (discountValue / 100);
    } else if (discountType === "Fixed") {
      discountAmount = discountValue;
    }
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

    let taxRate = 0.12; // default: 12% standard Ph VAT
    if (taxType === "Non-VAT" || taxType === "None") {
      taxRate = 0;
    } else if (taxType === "Custom") {
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
      {
        itemId: defaultProduct.id,
        quantity: 5,
        unitCost: defaultProduct.purchasePrice,
      },
    ]);
  };

  const handleUpdateDraftRow = (index: number, fields: Partial<POItem>) => {
    setDraftedItems(
      draftedItems.map((row, idx) => {
        if (idx !== index) return row;
        const updatedRow = { ...row, ...fields };
        // Auto-populate unit cost when switching itemId
        if (fields.itemId) {
          const found = items.find((p) => p.id === fields.itemId);
          if (found) {
            updatedRow.unitCost = found.purchasePrice;
          }
        }
        return updatedRow;
      }),
    );
  };

  const handleRemoveDraftRow = (index: number) => {
    if (draftedItems.length === 1) return; // Must have at least one slot
    setDraftedItems(draftedItems.filter((_, idx) => idx !== index));
  };

  const handleOpenDrafting = () => {
    const defaultSup = suppliers[0];
    setSupplierId(defaultSup?.id || "");
    setVendorName(defaultSup?.name || "");
    setOrderDate(new Date().toISOString().split("T")[0]); // Initial Order Date is today
    setDeliveryDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    ); // 7 days from now
    setWarehouseId(warehouses[0]?.id || "");
    setDeliveryOption("DHL Express");
    setNotes("");

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setPoNumber(`PO-${new Date().getFullYear()}-${randomSuffix}`);
    setTaxType("VAT");
    setCustomTaxRate(12);
    setDiscountType("None");
    setDiscountValue(0);
    setAttachments([]);

    setDraftedItems([
      {
        itemId: items[0]?.id || "",
        quantity: 10,
        unitCost: items[0]?.purchasePrice || 0,
      },
    ]);
    setIsCreateOpen(true);
  };

  const handleSubmitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!vendorName || draftedItems.length === 0) return;

    const t = calculateDraftTotals();

    // Package currency conversion lock variables
    onCreatePO({
      poNumber:
        poNumber ||
        `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      vendorName,
      supplierId,
      currency: poCurrency,
      exchangeRate: poExchangeRate,
      leadTimeDays: selectedSupplier?.leadTimeDays || 7,
      orderDate: orderDate || new Date().toISOString().split("T")[0],
      deliveryDate,
      status: "Draft",
      warehouseId,
      deliveryOption,
      items: draftedItems,
      notes,
      taxType,
      customTaxRate,
      discountType,
      discountValue,
      attachments,
      subtotal: t.subtotal,
      tax: t.tax,
      total: t.total,
    });

    setIsCreateOpen(false);
  };

  const handleOpenEditing = (po: PurchaseOrder) => {
    setEditingPOId(po.id);
    setEditPoNumber(po.poNumber);
    setEditSupplierId(po.supplierId || "");
    setEditVendorName(po.vendorName);
    setEditOrderDate(po.orderDate);
    setEditDeliveryDate(po.deliveryDate);
    setEditWarehouseId(po.warehouseId);
    setEditDeliveryOption(po.deliveryOption || "DHL Express");
    setEditNotes(po.notes || "");
    setEditTaxType(po.taxType || "VAT");
    setEditCustomTaxRate(
      po.customTaxRate !== undefined ? po.customTaxRate : 12,
    );
    setEditDiscountType(po.discountType || "None");
    setEditDiscountValue(po.discountValue !== undefined ? po.discountValue : 0);
    setEditAttachments(po.attachments || []);
    setEditDraftedItems(po.items.map((it) => ({ ...it })));
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingPOId || !editVendorName || editDraftedItems.length === 0)
      return;

    const existingPO = purchaseOrders.find((po) => po.id === editingPOId);
    if (!existingPO) return;

    const subtotal = editDraftedItems.reduce(
      (acc, row) => acc + row.quantity * (row.unitCost ?? 0),
      0,
    );
    let discountAmount = 0;
    if (editDiscountType === "Percentage") {
      discountAmount = subtotal * (editDiscountValue / 100);
    } else if (editDiscountType === "Fixed") {
      discountAmount = editDiscountValue;
    }
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);

    let taxRate = 0.12;
    if (editTaxType === "Non-VAT" || editTaxType === "None") {
      taxRate = 0;
    } else if (editTaxType === "Custom") {
      taxRate = editCustomTaxRate / 100;
    }

    const tax = subtotalAfterDiscount * taxRate;
    const total = subtotalAfterDiscount + tax;

    const currentSup = suppliers.find((s) => s.id === editSupplierId);
    const currency = currentSup?.currency || "USD";
    const exchangeRate = currentSup?.exchangeRate || 1.0;

    const updatedPO: PurchaseOrder = {
      ...existingPO,
      poNumber: editPoNumber,
      vendorName: editVendorName,
      supplierId: editSupplierId,
      currency,
      exchangeRate,
      leadTimeDays: currentSup?.leadTimeDays || 7,
      orderDate: editOrderDate || existingPO.orderDate,
      deliveryDate: editDeliveryDate,
      warehouseId: editWarehouseId,
      deliveryOption: editDeliveryOption,
      items: editDraftedItems,
      notes: editNotes,
      taxType: editTaxType,
      customTaxRate: editCustomTaxRate,
      discountType: editDiscountType,
      discountValue: editDiscountValue,
      attachments: editAttachments,
      subtotal,
      tax,
      total,
    };

    if (onEditPO) {
      onEditPO(updatedPO);
    }
    setFocusedPO(updatedPO);

    setIsEditOpen(false);
    setEditingPOId(null);
  };

  const handleAddEditRow = () => {
    const defaultProduct = items[0];
    if (!defaultProduct) return;
    setEditDraftedItems([
      ...editDraftedItems,
      {
        itemId: defaultProduct.id,
        quantity: 5,
        unitCost: defaultProduct.purchasePrice,
      },
    ]);
  };

  const handleUpdateEditRow = (index: number, fields: Partial<POItem>) => {
    setEditDraftedItems(
      editDraftedItems.map((row, idx) => {
        if (idx !== index) return row;
        const updatedRow = { ...row, ...fields };
        if (fields.itemId) {
          const found = items.find((p) => p.id === fields.itemId);
          if (found) {
            updatedRow.unitCost = found.purchasePrice;
          }
        }
        return updatedRow;
      }),
    );
  };

  const handleRemoveEditRow = (index: number) => {
    if (editDraftedItems.length === 1) return;
    setEditDraftedItems(editDraftedItems.filter((_, idx) => idx !== index));
  };

  const getStatusStyle = (status: PurchaseOrder["status"]) => {
    switch (status) {
      case "Draft":
        return "bg-slate-150 text-slate-800 border border-slate-300 font-semibold";
      case "Issued":
        return "bg-blue-600 text-white border border-blue-700 font-black animate-[pulse_2s_infinite] uppercase tracking-wider text-[9px] px-2.5 shadow-xs";
      case "In Transit":
        return "bg-amber-500 text-slate-950 border border-amber-600 font-black animate-[pulse_1.7s_infinite] uppercase tracking-wider text-[9px] px-2.5 shadow-xs";
      case "Received":
        return "bg-emerald-600 text-white border border-emerald-700 font-black uppercase tracking-wider text-[9px] px-2.5 shadow-xs";
      case "Cancelled":
        return "bg-rose-600 text-white border border-rose-700 font-bold uppercase tracking-wider text-[9px] px-2.5 shadow-xs";
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Purchase Orders (PO)
          </h1>
          <p className="text-sm text-gray-500">
            Procure inventory from certified vendors, approve drafts, and
            receive incoming items securely.
          </p>
        </div>
        {canEditPurchaseOrders && (
          <button
            onClick={handleOpenDrafting}
            className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-sm font-semibold text-white rounded-lg transition-colors shadow-xs hover:shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Order</span>
          </button>
        )}
      </div>

      {/* Filtering PO Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO Number, or Vendor name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm pl-10 pr-4 py-2 bg-gray-50 text-gray-800 rounded-lg border border-gray-100/80 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/55 focus:bg-white placeholder-gray-400 font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100/80 rounded-lg px-3 py-2 text-gray-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Transactions</option>
              <option value="Draft">Draft</option>
              <option value="Issued">Issued (Dispatched)</option>
              <option value="In Transit">In Transit</option>
              <option value="Received">Received (In Stock)</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">Supplier:</span>
            <select
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100/80 rounded-lg px-3 py-2 text-gray-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">Warehouse:</span>
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-100/80 rounded-lg px-3 py-2 text-gray-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pl-3 md:border-l md:border-gray-200">
            <input
              type="checkbox"
              id="show-archived-po-toggle"
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked);
                setSelectedPoIds([]); // Clear selections to prevent mismatches
              }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
            />
            <label htmlFor="show-archived-po-toggle" className="text-xs text-gray-600 font-bold cursor-pointer select-none">
              Show Archived
            </label>
          </div>
        </div>
      </div>

      {/* OPERATIONAL ALERT TOAST FEEDBACK BANNER */}
      {feedbackMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 text-xs font-semibold font-mono animate-fade-in flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>✓ {feedbackMessage}</span>
        </div>
      )}

      {/* BULK SELECTION ACTION CONTROL PORTAL */}
      {selectedPoIds.length > 0 && (
        <div className="bg-indigo-50/85 border border-indigo-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-600 text-white rounded-lg font-mono text-xs font-bold shrink-0">
              {selectedPoIds.length} Selected
            </span>
            <div>
              <p className="text-xs font-bold text-gray-950">Active Batch Operations Console</p>
              <p className="text-[10px] text-indigo-700 font-medium">Trigger life-cycle state changes or archive records on the chosen entries.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Status updates select */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusChange(e.target.value as any);
                  e.target.value = "";
                }
              }}
              defaultValue=""
              className="text-xs bg-white text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-bold"
            >
              <option value="" disabled>-- Update Status of All ({selectedPoIds.length}) --</option>
              <option value="Draft">Set status: Draft</option>
              <option value="Issued">Set status: Issued</option>
              <option value="In Transit">Set status: In Transit</option>
              <option value="Received">Set status: Received</option>
              <option value="Cancelled">Set status: Cancelled</option>
            </select>

            {showArchived ? (
              <button
                type="button"
                onClick={handleUnarchiveSelectedPOs}
                className="text-xs bg-slate-800 hover:bg-slate-950 text-white rounded-lg px-3.5 py-1.5 transition-colors cursor-pointer font-bold"
              >
                Unarchive Selected ({selectedPoIds.length})
              </button>
            ) : (
              <button
                type="button"
                onClick={handleArchiveSelectedPOs}
                className="text-xs bg-slate-800 hover:bg-slate-950 text-white rounded-lg px-3.5 py-1.5 transition-colors cursor-pointer font-bold"
              >
                Archive Selected ({selectedPoIds.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedPoIds([])}
              className="text-xs bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors cursor-pointer font-semibold"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Splits PO Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* PO Table list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden lg:col-span-2">
          <div className="overflow-x-auto">
            {filteredPOs.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-400">
                No matching supplier Purchase Orders detected.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-150">
                <thead>
                  <tr className="bg-gray-50/50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider font-mono">
                    <th className="px-4 py-4 text-center w-12">
                      <input
                        type="checkbox"
                        checked={filteredPOs.length > 0 && filteredPOs.every(p => selectedPoIds.includes(p.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSelected = Array.from(new Set([...selectedPoIds, ...filteredPOs.map(p => p.id)]));
                            setSelectedPoIds(newSelected);
                          } else {
                            const remaining = selectedPoIds.filter(id => !filteredPOs.map(p => p.id).includes(id));
                            setSelectedPoIds(remaining);
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                        title="Toggle selection of all matching entries"
                      />
                    </th>
                    <th className="px-6 py-4">PO Number</th>
                    <th className="px-6 py-4">Vendor & Site</th>
                    <th className="px-6 py-4 font-mono">Order Value</th>
                    <th className="px-6 py-4">Delivery Date</th>
                    <th className="px-6 py-4 text-center">Lifecycle</th>
                    <th className="px-6 py-4 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                  {filteredPOs.map((po) => {
                    const destWarehouse =
                      warehouses.find((w) => w.id === po.warehouseId)?.name ||
                      "Central Site";
                    const isSelected = selectedPoIds.includes(po.id);
                    return (
                      <tr
                        key={po.id}
                        onClick={() => setFocusedPO(po)}
                        className={`hover:bg-indigo-50/15 cursor-pointer transition-colors ${focusedPO?.id === po.id ? "bg-indigo-50/30" : ""} ${isSelected ? "bg-indigo-50/10" : ""}`}
                      >
                        <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPoIds([...selectedPoIds, po.id]);
                              } else {
                                setSelectedPoIds(selectedPoIds.filter(id => id !== po.id));
                              }
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-gray-900">
                          {po.poNumber}
                        </td>
                        <td className="px-6 py-4 space-y-0.5">
                          <div className="font-semibold text-gray-800 text-sm leading-tight">
                            {po.vendorName}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            To: {destWarehouse}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm font-semibold text-slate-800 font-mono">
                          {getCurrencySymbol(po.currency)}
                          {po.total.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-6 py-4 font-mono text-left">
                          <div className="text-gray-850 font-medium">Expect: {po.deliveryDate}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Created: {po.orderDate}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${getStatusStyle(po.status)}`}
                          >
                            {po.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center items-center gap-1.5">
                            {onEditPO && canEditPurchaseOrders && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditing(po)}
                                className="p-1 text-slate-600 hover:text-indigo-650 hover:bg-indigo-50 rounded transition-all cursor-pointer border border-transparent hover:border-indigo-150 animate-duration-150"
                                title={`Edit PO ${po.poNumber}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(currentUser?.role === 'Admin' || canEditPurchaseOrders) && onDeletePO && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`⚠️ CRITICAL ACTION: Are you sure you want to permanently delete Purchase Order ${po.poNumber}? This cannot be undone.`)) {
                                    onDeletePO(po.id);
                                    if (focusedPO?.id === po.id) {
                                      setFocusedPO(null);
                                    }
                                  }
                                }}
                                className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 rounded transition-all cursor-pointer border border-transparent hover:border-rose-150 animate-duration-150"
                                title={`Delete PO ${po.poNumber}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* PO inspector Side */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs p-6 space-y-6">
          {focusedPO ? (
            <div className="space-y-6">
              {/* Header and visual status */}
              <div className="flex justify-between items-start gap-3 border-b border-gray-50 pb-4">
                <div className="space-y-0.5 text-left">
                  <span className="text-[10px] font-mono text-gray-400">
                    PURCHASE ORDER
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-950 font-mono">
                    {focusedPO.poNumber}
                  </h3>
                  {onEditPO && canEditPurchaseOrders && (
                    <button
                      onClick={() => handleOpenEditing(focusedPO)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold tracking-wide transition-colors cursor-pointer flex items-center gap-1 mt-1 uppercase"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit Details & Notes
                    </button>
                  )}
                  {(currentUser?.role === 'Admin' || canEditPurchaseOrders) && onDeletePO && (
                    <button
                      onClick={() => {
                        if (window.confirm(`⚠️ CRITICAL ACTION: Are you sure you want to permanently delete Purchase Order ${focusedPO.poNumber}? This cannot be undone.`)) {
                          onDeletePO(focusedPO.id);
                          setFocusedPO(null);
                        }
                      }}
                      className="text-[10px] text-rose-700 hover:text-rose-900 font-extrabold tracking-wide transition-colors cursor-pointer flex items-center gap-1 mt-2.5 uppercase bg-rose-50 hover:bg-rose-100/80 p-1.5 px-3 rounded-md border border-rose-200"
                    >
                      <Trash2 className="w-3 h-3 text-rose-600" />
                      Delete Purchase Order
                    </button>
                  )}
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-bold rounded-full ${getStatusStyle(focusedPO.status)}`}
                >
                  {focusedPO.status}
                </span>
              </div>

              {/* Auto Generated Barcode/QR Passport */}
              <LogisticsBarcodeCard
                orderNumber={focusedPO.poNumber}
                type="Purchase Order"
                dateStr={focusedPO.orderDate}
                sourceHub={warehouses.find((w) => w.id === focusedPO.warehouseId)?.name}
              />

              {/* Vendor & Dest */}
              <div className="grid grid-cols-2 gap-4 text-xs font-sans text-left bg-slate-50/50 p-3 rounded-xl border border-gray-100">
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-extrabold text-[9px] mb-1">
                    Contract Dates
                  </span>
                  <div className="space-y-1">
                    <div className="flex justify-between pr-2 text-gray-600">
                      <span>PO Creation Date (Ordered):</span>
                      <span className="font-mono text-gray-800 font-semibold">
                        {focusedPO.orderDate}
                      </span>
                    </div>
                    <div className="flex justify-between pr-2 text-gray-600">
                      <span>Expected:</span>
                      <span className="font-mono text-gray-800 font-semibold">
                        {focusedPO.deliveryDate}
                      </span>
                    </div>
                    {focusedPO.actualDeliveryDate && (
                      <div className="flex justify-between pr-2 text-gray-600">
                        <span>Delivered:</span>
                        <span className="font-mono text-emerald-700 font-bold">
                          {focusedPO.actualDeliveryDate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 uppercase tracking-wider block font-extrabold text-[9px] mb-1">
                    Fulfillment Target
                  </span>
                  <span className="text-slate-850 font-bold block text-sm mt-0.5">
                    {warehouses.find((w) => w.id === focusedPO.warehouseId)
                      ?.name || "Default Hub"}
                  </span>
                  <span className="text-[10px] text-gray-400 block font-mono">
                    Code:{" "}
                    {warehouses.find((w) => w.id === focusedPO.warehouseId)
                      ?.code || "N/A"}
                  </span>
                  <div className="mt-2 pt-2 border-t border-gray-100/60">
                    <span className="text-gray-400 uppercase tracking-wider block font-extrabold text-[9px] mb-0.5">
                      Logistical Courier
                    </span>
                    <span className="text-indigo-700 font-bold block text-xs">
                      {focusedPO.deliveryOption || "DHL Express"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Supplier Information Panel */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-left flex items-center gap-1.5 font-mono">
                  <Landmark className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Supplier Profile & Partner Details</span>
                </h4>
                <div className="bg-gradient-to-tr from-slate-50 to-indigo-50/10 p-4 rounded-xl border border-indigo-100/40 text-left text-xs space-y-3 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-800 text-sm leading-tight">
                      {focusedPO.vendorName}
                    </span>
                    {focusedPO.currency && focusedPO.currency !== "USD" && (
                      <span className="bg-indigo-150/50 text-indigo-805 text-[10px] font-extrabold px-2 py-0.5 rounded-md font-mono">
                        {focusedPO.currency} Rate:{" "}
                        {focusedPO.exchangeRate || 1.0}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const currentSupProfile = suppliers.find(
                      (s) => s.id === focusedPO.supplierId,
                    );
                    if (currentSupProfile) {
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 text-[11px] text-gray-600 border-t border-indigo-100/20">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="truncate">
                              <span className="text-[9px] text-gray-400 uppercase font-mono block">
                                Contact Person
                              </span>
                              <span className="font-semibold text-slate-700">
                                {currentSupProfile.contactPerson}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div>
                              <span className="text-[9px] text-gray-400 uppercase font-mono block">
                                Average Lead-Time
                              </span>
                              <span className="font-semibold text-slate-700">
                                {currentSupProfile.leadTimeDays || 7} Working
                                Days
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="truncate">
                              <span className="text-[9px] text-gray-400 uppercase font-mono block">
                                Corporate Email
                              </span>
                              <a
                                href={`mailto:${currentSupProfile.email}`}
                                className="font-medium text-indigo-600 hover:underline"
                              >
                                {currentSupProfile.email}
                              </a>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div>
                              <span className="text-[9px] text-gray-400 uppercase font-mono block">
                                Active Line
                              </span>
                              <span className="font-semibold text-slate-700">
                                {currentSupProfile.phone}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="text-[11px] text-gray-400 italic pt-1 text-center">
                        Supplier Profile metadata not loaded.
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Order lifecycle steps */}
              <div
                id="po-status-change-segment"
                className="p-4 bg-indigo-50/45 rounded-xl border border-indigo-100/50 space-y-3"
              >
                <div className="flex gap-2 items-center">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    Life Cycle Status (Reversible)
                  </span>
                </div>
                <p className="text-[11px] text-indigo-850 leading-relaxed text-left">
                  You can transition or reverse the state of this purchase
                  order. Reverting receipt automatically backs stock out of
                  inventory safely.
                </p>
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                      Select Target Status
                    </label>
                    <select
                      disabled={!canEditPurchaseOrders}
                      value={poStatusTarget}
                      onChange={(e) => {
                        setPoStatusTarget(e.target.value as any);
                      }}
                      className="w-full text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-2 font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Issued">Issued (Dispatched)</option>
                      <option value="In Transit">In Transit</option>
                      <option value="Received">Received (In Stock / Receipted)</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  {poStatusTarget !== focusedPO.status && (
                    <div className="space-y-2.5 pt-1 border-t border-indigo-150">
                      {/* Operator selection/input */}
                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                          Operator / Authorized By *
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                            <User className="h-3.5 w-3.5 text-gray-400" />
                          </span>
                          <input
                            type="text"
                            required
                            placeholder="Enter operator name..."
                            value={poStatusChangeUser}
                            onChange={(e) => setPoStatusChangeUser(e.target.value)}
                            className="w-full text-xs bg-white border border-gray-300 rounded-lg pl-8 pr-2.5 py-2 font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        {currentUser && (
                          <span className="text-[9px] text-gray-400 italic">
                            Defaults to current session: <span className="font-bold text-slate-500">{currentUser.name}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 text-left">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                          Reason for Status Change *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Provide a brief reason/note..."
                          value={poStatusChangeReason}
                          onChange={(e) =>
                            setPoStatusChangeReason(e.target.value)
                          }
                          className="w-full text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!poStatusChangeUser.trim()) {
                            alert(
                              "Please enter the name of the operator/user making this change.",
                            );
                            return;
                          }
                          if (!poStatusChangeReason.trim()) {
                            alert(
                              "Please enter a brief reason/note for this status transition.",
                            );
                            return;
                          }
                          onUpdatePOStatus(
                            focusedPO.id,
                            poStatusTarget,
                            poStatusChangeReason,
                            poStatusChangeUser,
                          );
                          setPoStatusChangeReason("");
                        }}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Confirm Status Transition</span>
                      </button>
                    </div>
                  )}

                  {/* Zoho Style Receipts Section */}
                  <div className="mt-4 pt-4 border-t border-gray-150 space-y-3 font-sans">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Goods Received Sheets</span>
                      </h4>
                      {/* Allow receiving if there are items remaining to receipt */}
                      {focusedPO.status !== "Cancelled" && focusedPO.status !== "Draft" && focusedPO.items.some(line => (line.receivedQuantity || 0) < line.quantity) && onReceivePOBatch && canEditPurchaseOrders && (
                        <button
                          type="button"
                          onClick={handleOpenCreateReceipt}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                          title="Generate a new partial or full Goods Receipt"
                        >
                          <Plus className="w-3 h-3" />
                          <span>New Receipt</span>
                        </button>
                      )}
                    </div>

                    {/* Compile specific Goods Receipts for this PO */}
                    {(() => {
                      const matchedGRs = (explicitGoodsReceipts || []).filter(gr => gr.poId === focusedPO.id);
                      if (matchedGRs.length > 0) {
                        return (
                          <div className="space-y-2">
                            {matchedGRs.map(gr => (
                              <div
                                key={gr.id}
                                onClick={() => {
                                  setSelectedGRForView(gr);
                                  setIsGoodsReceiptOpen(true);
                                }}
                                className="group/gr flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 hover:border-emerald-250 hover:bg-emerald-50/10 rounded-lg cursor-pointer transition-all"
                              >
                                <div className="space-y-0.5 text-left">
                                  <div className="font-mono text-xs font-bold text-slate-850 group-hover/gr:text-emerald-700 flex items-center gap-1.5">
                                    <span>{gr.grNumber}</span>
                                    <span className="text-[8px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded font-mono font-extrabold">Received</span>
                                  </div>
                                  <div className="text-[10px] text-gray-450 leading-none mt-1">
                                    Date: {gr.receivedDate} • Checked: {gr.receivedBy}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right font-mono text-[10px] text-slate-650 font-bold bg-white px-2 py-1 rounded border border-gray-100 shadow-3xs">
                                    {gr.items.reduce((sum: number, line: any) => sum + line.quantity, 0)} Items
                                  </div>
                                  {onDeleteGoodsReceipt && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteGoodsReceipt(gr.id);
                                      }}
                                      title="Delete Goods Receipt"
                                      className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      } else {
                        return (
                          <div className="text-center py-4 bg-slate-50/55 rounded-lg border border-dashed border-gray-150 text-gray-400 text-[10px]">
                            {focusedPO.status === "Received" && false ? (
                              <button
                                onClick={() => {
                                  setSelectedGRForView(null);
                                  setIsGoodsReceiptOpen(true);
                                }}
                                className="text-indigo-600 hover:underline font-bold"
                              >
                                View legacy complete Goods Receipt (GR-{focusedPO.poNumber.replace('PO-', '')})
                              </button>
                            ) : (
                              <span>No Goods Receipts have been checked-in yet.</span>
                            )}
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>

              {/* Items in focused PO */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-left font-mono">
                  Items Procured
                </h4>
                <div className="border border-gray-150 rounded-lg overflow-hidden text-xs">
                  <table className="min-w-full divide-y divide-gray-150">
                    <thead className="bg-gray-50/50">
                      <tr className="text-left font-semibold text-gray-500 font-mono text-[10px]">
                        <th className="px-3 py-2.5">Item Details</th>
                        <th className="px-3 py-2.5 text-right">Qty</th>
                        <th className="px-3 py-2.5 text-right">Cost</th>
                        <th className="px-3 py-2.5 text-right font-bold">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-750 bg-white">
                      {focusedPO.items.map((it, idx) => {
                        const originalItem = items.find(
                          (p) => p.id === it.itemId,
                        );
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 font-medium text-left">
                              <span className="text-slate-900 font-semibold">
                                {originalItem?.name || "Unidentified Item"}
                              </span>
                              <div className="flex gap-1.5 text-[9px] text-gray-400 font-mono mt-0.5">
                                <span className="text-indigo-600 font-bold">
                                  {originalItem?.sku || "SKU"}
                                </span>
                                {originalItem?.brand && (
                                  <span className="text-gray-500">
                                    • {originalItem?.brand}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-700">
                              {it.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-650">
                              {it.unitCost !== undefined && it.unitCost !== null
                                ? `${getCurrencySymbol(focusedPO.currency || "USD")}${it.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                              {getCurrencySymbol(focusedPO.currency || "USD")}
                              {(
                                it.quantity * (it.unitCost ?? 0)
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Price Calculations */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl text-xs font-mono text-gray-700 border border-gray-150">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>
                    {getCurrencySymbol(focusedPO.currency || "USD")}
                    {focusedPO.subtotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {focusedPO.discountType &&
                  focusedPO.discountType !== "None" && (
                    <div className="flex justify-between text-red-650 font-semibold font-mono">
                      <span>
                        Discount (
                        {focusedPO.discountType === "Percentage"
                          ? `${focusedPO.discountValue}%`
                          : "Fixed"}
                        ):
                      </span>
                      <span>
                        -{getCurrencySymbol(focusedPO.currency || "USD")}
                        {(focusedPO.discountType === "Percentage"
                          ? (focusedPO.subtotal *
                              (focusedPO.discountValue || 0)) /
                            100
                          : focusedPO.discountValue || 0
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                {focusedPO.taxType !== "None" ? (
                  <div className="flex justify-between text-gray-600">
                    <span>
                      {focusedPO.taxType === "Non-VAT" && "Tax (Non-VAT 0%):"}
                      {focusedPO.taxType === "Custom" &&
                        `Tax (Custom ${focusedPO.customTaxRate}%):`}
                      {(!focusedPO.taxType || focusedPO.taxType === "VAT") &&
                        "Tax (VAT 12%):"}
                    </span>
                    <span>
                      {getCurrencySymbol(focusedPO.currency || "USD")}
                      {focusedPO.tax.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-400 italic">
                    <span>Tax Policy:</span>
                    <span>No Tax Applied</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold text-gray-900">
                  <span>Grand Total ({focusedPO.currency || "USD"}):</span>
                  <span>
                    {getCurrencySymbol(focusedPO.currency || "USD")}
                    {focusedPO.total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Attachments Section with Post-Creation simulation upload functionality */}
              <div className="space-y-2 text-xs text-left bg-slate-50/40 p-3 rounded-lg border border-gray-150">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      Attachments ({focusedPO.attachments?.length || 0})
                    </span>
                  </h4>

                  {/* Append post-creation uploader button */}
                  <label className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded cursor-pointer transition-colors block">
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
                          dataUrl: "#",
                          uploadedAt: new Date().toISOString(),
                        }));
                        const updated = {
                          ...focusedPO,
                          attachments: [
                            ...(focusedPO.attachments || []),
                            ...newRecords,
                          ],
                        };
                        onEditPO(updated);
                        setFocusedPO(updated);
                      }}
                    />
                  </label>
                </div>

                {focusedPO.attachments && focusedPO.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {focusedPO.attachments.map((att: any) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg"
                      >
                        <a
                          href={att.dataUrl || "#"}
                          download={att.name}
                          onClick={(e) => {
                            if (!att.dataUrl || att.dataUrl === "#") {
                              e.preventDefault();
                              alert(`Downloading file: ${att.name}`);
                            }
                          }}
                          title={`Download ${att.name}`}
                          className="flex items-center gap-2 min-w-0 flex-1 hover:underline cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-bold text-gray-800 truncate text-[11px] text-left">
                              {att.name}
                            </div>
                            <div className="text-[9px] text-gray-400 font-mono mt-0.5 text-left">
                              {(att.size / 1024).toFixed(1)} KB •{" "}
                              {att.uploadedAt}
                            </div>
                          </div>
                        </a>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete attachment: "${att.name}"?`,
                              )
                            ) {
                              const remaining = (
                                focusedPO.attachments || []
                              ).filter((a) => a.id !== att.id);
                              const updated = {
                                ...focusedPO,
                                attachments: remaining,
                              };
                              onEditPO(updated);
                              setFocusedPO(updated);
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
                ) : (
                  <div className="text-[10px] text-gray-400 italic bg-gray-50/50 p-3 text-center rounded border border-dashed border-gray-150">
                    No documents attached to this purchase order. Use the button
                    above to upload.
                  </div>
                )}
              </div>

              {/* Notes */}
              {focusedPO.notes && (
                <div className="bg-amber-50/45 p-3 rounded-xl border border-amber-100/50">
                  <span className="text-[9px] font-bold text-amber-800 block uppercase tracking-wider font-mono">
                    Fulfillment Notes & Vendor instructions
                  </span>
                  <p className="text-[11px] text-amber-900 leading-relaxed text-left mt-0.5">
                    {focusedPO.notes}
                  </p>
                </div>
              )}

              {/* Enhanced Progress Status History Timeline */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-left flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Interactive Status History (Audit Trial)</span>
                </h4>
                <div className="relative pl-4 border-l border-indigo-100 text-left space-y-4 ml-1 pt-1">
                  {(focusedPO.statusHistory &&
                  focusedPO.statusHistory.length > 0
                    ? focusedPO.statusHistory
                    : getInitialHistoryFallback(focusedPO)
                  ).map((log, idx) => {
                    let dotColor = "bg-gray-300 ring-gray-100";
                    let badgeColor = "bg-gray-50 text-gray-650";
                    if (log.status === "Draft") {
                      dotColor = "bg-gray-400 ring-gray-100";
                      badgeColor = "bg-gray-100 text-gray-700";
                    } else if (log.status === "Issued") {
                      dotColor = "bg-blue-500 ring-blue-100";
                      badgeColor = "bg-blue-55 text-blue-700";
                    } else if (log.status === "In Transit") {
                      dotColor = "bg-amber-500 ring-amber-100";
                      badgeColor = "bg-amber-55 text-amber-700";
                    } else if (log.status === "Received") {
                      dotColor = "bg-emerald-500 ring-emerald-100";
                      badgeColor = "bg-emerald-55 text-emerald-700";
                    } else if (log.status === "Cancelled") {
                      dotColor = "bg-rose-500 ring-rose-100";
                      badgeColor = "bg-rose-55 text-rose-700";
                    }

                    return (
                      <div key={idx} className="relative group text-xs">
                        {/* Dot */}
                        <div
                          className={`absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${dotColor}`}
                        />

                        <div className="p-3 bg-slate-50/50 hover:bg-slate-50 rounded-xl border border-gray-150 transition-colors space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded-md ${badgeColor}`}
                            >
                              {log.status}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {log.date}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                            {log.note}
                          </p>

                          <div className="flex justify-between items-center pt-0.5 border-t border-dashed border-gray-100">
                            <span className="text-[9px] text-gray-400 font-mono">
                              By:{" "}
                              <strong className="text-indigo-500">
                                {log.user || "System Agent"}
                              </strong>
                            </span>
                          </div>

                          {/* Inline Quick Remark Textarea */}
                          <div className="mt-1 p-1 bg-white rounded-md border border-gray-100 space-y-1">
                            <textarea
                              placeholder="Add instant remark to log note..."
                              value={poLogRemarks[idx] || ''}
                              onChange={(e) => setPoLogRemarks(prev => ({ ...prev, [idx]: e.target.value }))}
                              className="w-full text-[10px] p-1 bg-slate-50 border border-slate-200 rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-550 font-sans leading-relaxed resize-none"
                              rows={1}
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const val = poLogRemarks[idx];
                                  if (val && val.trim()) {
                                    handleAppendPoLogRemark(idx, val);
                                    setPoLogRemarks(prev => ({ ...prev, [idx]: '' }));
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
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-gray-400">
              <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              Select customer purchase sequence to manage state parameters,
              financial totals and item configurations.
            </div>
          )}
        </div>
      </div>

      {/* CREATE PO DRAWER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">
                  Draft New Purchase Order
                </h2>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitDraft}>
              <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2 border-b border-gray-100">
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-650">
                      PO Number (Editable) *
                    </label>
                    <input
                      type="text"
                      required
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      placeholder="e.g. PO-2026-0001"
                      className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-650">
                      Supplier Partner *
                    </label>
                    <select
                      value={supplierId}
                      onChange={(e) => {
                        const sId = e.target.value;
                        setSupplierId(sId);
                        const sup = suppliers.find((s) => s.id === sId);
                        if (sup) {
                          setVendorName(sup.name);
                        }
                      }}
                      required
                      className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg text-slate-800 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} ({sup.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-650">
                      Order Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-650">
                      Estimated Delivery Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-650">
                      Fulfillment Target *
                    </label>
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-650">
                      Delivery Logistical Option (Optional)
                    </label>
                    <select
                      value={deliveryOption}
                      onChange={(e) => setDeliveryOption(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white"
                    >
                      <option value="">Select Option (Optional)</option>
                      <option value="DHL Express">DHL Express</option>
                      <option value="FedEx Courier">FedEx Courier</option>
                      <option value="Air Freight">Air Freight</option>
                      <option value="Sea Cargo">Sea Cargo</option>
                      <option value="Land Logistics / Lalamove">
                        Land Logistics / Lalamove
                      </option>
                      <option value="Warehouse Pickup">Warehouse Pickup</option>
                      <option value="Standard Mail">Standard Mail</option>
                    </select>
                  </div>
                </div>

                {/* Line Items drafting */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">
                      Lines ({draftedItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItemToDraft}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      + Add Row Code
                    </button>
                  </div>

                  <div className="space-y-3">
                    {draftedItems.map((row, idx) => (
                      <div key={idx} className="flex flex-col p-3 bg-slate-50 border border-gray-200 rounded-lg space-y-2.5">
                        <div className="flex gap-3 items-center">
                          {/* Select SKU/Name */}
                          <div className="flex-1 min-w-0">
                            <select
                              value={row.itemId}
                              onChange={(e) =>
                                handleUpdateDraftRow(idx, {
                                  itemId: e.target.value,
                                })
                              }
                              className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold bg-white"
                            >
                              {items.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div className="w-24">
                            <input
                              type="number"
                              min={1}
                              placeholder="Qty"
                              value={row.quantity}
                              onChange={(e) =>
                                handleUpdateDraftRow(idx, {
                                  quantity: Math.max(
                                    1,
                                    parseInt(e.target.value) || 0,
                                  ),
                                })
                              }
                              className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-center font-mono font-bold bg-white"
                            />
                          </div>

                          {/* Unit Cost */}
                          <div className="w-28 font-mono">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="Optional cost"
                              value={row.unitCost !== undefined ? row.unitCost : ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateDraftRow(idx, {
                                  unitCost:
                                    val === ""
                                      ? undefined
                                      : Math.max(0, parseFloat(val) || 0),
                                });
                              }}
                              className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-right font-bold text-red-755 bg-white"
                            />
                          </div>

                          {/* Multiplied values UI */}
                          <div className="w-24 text-right pr-2 text-xs font-mono font-bold text-gray-900 font-mono">
                            {getCurrencySymbol(poCurrency)}
                            {getRowTotal(row).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </div>

                          {/* Delete row */}
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftRow(idx)}
                            disabled={draftedItems.length === 1}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg cursor-pointer animate-none"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Lot Assignment option */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-2 pt-1.5 border-t border-gray-150">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Stock Lot Assignment:</span>
                            <select
                              value={row.lotId || ""}
                              onChange={(e) => {
                                const val = e.target.value || undefined;
                                if (val) {
                                  const violation = getFifoViolation(row.itemId, warehouseId, val);
                                  if (violation.violated && violation.selected && violation.oldest) {
                                    alert(
                                      `⚠️ FIFO STOCKING PRINCIPLE WARNING!\n\n` +
                                      `The lot "${violation.selected.lotNumber}" was received LATER than "${violation.oldest.lotNumber}" (received on ${new Date(violation.oldest.dateReceived).toLocaleDateString()}).\n\n` +
                                      `Dispensing this lot violates the FIFO (First In, First Out) principle.`
                                    );
                                  }
                                }
                                handleUpdateDraftRow(idx, { lotId: val });
                              }}
                              className="text-xs px-2.5 py-1 border border-gray-250 rounded-lg bg-white font-medium text-slate-800"
                            >
                              <option value="">No Lot Assigned</option>
                              {lots
                                .filter(l => l.itemId === row.itemId && l.warehouseId === warehouseId && l.quantityRemaining > 0)
                                .map(l => (
                                  <option key={l.id} value={l.id}>
                                    {l.lotNumber} ({l.quantityRemaining} left, rec. {new Date(l.dateReceived).toLocaleDateString()})
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Highlighting oldest lot and mechanism to apply */}
                          {(() => {
                            const oldestLot = getOldestLotInfo(row.itemId, warehouseId);
                            const violation = getFifoViolation(row.itemId, warehouseId, row.lotId);

                            if (oldestLot) {
                              if (violation.violated) {
                                return (
                                  <span className="text-rose-600 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 px-2.5 py-1 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                        onClick={() => handleUpdateDraftRow(idx, { lotId: oldestLot.id })}
                                        title="Click to automatically apply the FIFO-compliant lot">
                                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                                    <span>FIFO violation! <u>Apply Compliant Lot: {oldestLot.lotNumber}</u></span>
                                  </span>
                                );
                              } else if (!row.lotId) {
                                return (
                                  <span className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-150 px-2.5 py-1 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                        onClick={() => handleUpdateDraftRow(idx, { lotId: oldestLot.id })}
                                        title="Click to automatically apply the FIFO-compliant lot">
                                    <AlertCircle className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Oldest Lot available: <u>Apply {oldestLot.lotNumber}</u></span>
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-150 flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>✓ FIFO compliant (oldest lot selected)</span>
                                  </span>
                                );
                              }
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Taxes & Discounts policy selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-gray-150 text-left">
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">
                      VAT/Tax Config
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">
                          Option
                        </label>
                        <select
                          value={taxType}
                          onChange={(e) =>
                            setTaxType(
                              e.target.value as
                                | "VAT"
                                | "Non-VAT"
                                | "Custom"
                                | "None",
                            )
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg bg-white font-medium text-slate-800"
                        >
                          <option value="VAT">VAT</option>
                          <option value="Non-VAT">Non-VAT</option>
                          <option value="None">
                            Choose to not add any option
                          </option>
                        </select>
                      </div>

                      {taxType === "Custom" && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">
                            Rate (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={customTaxRate}
                            onChange={(e) =>
                              setCustomTaxRate(
                                Math.max(0, parseFloat(e.target.value) || 0),
                              )
                            }
                            className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-mono font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">
                      Discount Policy
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">
                          Type
                        </label>
                        <select
                          value={discountType}
                          onChange={(e) =>
                            setDiscountType(
                              e.target.value as "Percentage" | "Fixed" | "None",
                            )
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg bg-white font-medium text-slate-800 font-sans"
                        >
                          <option value="None">None</option>
                          <option value="Percentage">Percentage (%)</option>
                          <option value="Fixed">Fixed Amount ({poCurrency})</option>
                        </select>
                      </div>

                      {discountType !== "None" && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">
                            Value
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={discountValue}
                            onChange={(e) =>
                              setDiscountValue(
                                Math.max(0, parseFloat(e.target.value) || 0),
                              )
                            }
                            className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-mono font-bold"
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

                  <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors p-4 rounded-xl bg-indigo-50/10 text-center relative">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileUpload(e, false)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <Paperclip className="w-5 h-5 mx-auto text-indigo-500 animate-bounce" />
                      <p className="text-xs font-semibold text-slate-700">
                        Drag items here or click to select files
                      </p>
                      <p className="text-[10px] text-gray-400">
                        PDF, XLS, DOCX, ZIP, JPG (max 10MB per file)
                      </p>
                    </div>
                  </div>

                  {attachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg shrink-0"
                        >
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-gray-950 truncate">
                              {file.name}
                            </div>
                            <div className="text-[9px] text-gray-400 font-mono">
                              {(file.size / 1024).toFixed(0)} KB
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveAttachment(file.id, false)
                            }
                            className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <div className="space-y-1 text-left col-span-1">
                    <label className="text-xs font-semibold text-gray-600">
                      Purchasing Notes/Warranty Instruction
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Special instructions for the vendor..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full text-xs px-3.5 py-1.5 border border-gray-250 rounded-lg bg-white"
                    />
                  </div>

                  <div className="space-y-1.5 text-xs font-mono text-gray-655 text-right pr-2 col-span-1">
                    <div className="flex justify-between max-w-xs ml-auto">
                      <span>Subtotal ({poCurrency}):</span>
                      <span>
                        {getCurrencySymbol(poCurrency)}
                        {totals.subtotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {discountType !== "None" && (
                      <div className="flex justify-between max-w-xs ml-auto text-red-600">
                        <span>
                          Discount (
                          {discountType === "Percentage"
                            ? `${discountValue}%`
                            : "Fixed"}
                          ):
                        </span>
                        <span>
                          -{getCurrencySymbol(poCurrency)}
                          {totals.discountAmount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}
                    {discountType !== "None" && (
                      <div className="flex justify-between max-w-xs ml-auto text-gray-400 font-bold border-t border-dashed border-gray-200 pt-1">
                        <span>Subtotal After Disc:</span>
                        <span>
                          {getCurrencySymbol(poCurrency)}
                          {totals.subtotalAfterDiscount.toLocaleString(
                            undefined,
                            { minimumFractionDigits: 2 },
                          )}
                        </span>
                      </div>
                    )}
                    {taxType !== "None" && (
                      <div className="flex justify-between max-w-xs ml-auto">
                        <span>
                          Estimated Tax (
                          {taxType === "VAT"
                            ? "VAT 12%"
                            : taxType === "Non-VAT"
                              ? "Non-VAT 0%"
                              : `Custom ${customTaxRate}%`}
                          ):
                        </span>
                        <span>
                          {taxType === "None"
                            ? `${getCurrencySymbol(poCurrency)}0.00`
                            : `${getCurrencySymbol(poCurrency)}${totals.tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between max-w-xs ml-auto border-t border-gray-250 pt-1.5 text-sm font-bold text-gray-900">
                      <span>Grand Total ({poCurrency}):</span>
                      <span>
                        {getCurrencySymbol(poCurrency)}
                        {totals.total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
                >
                  Submit Order Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PO DRAWER MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 text-left">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">
                  Edit Purchase Order
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingPOId(null);
                }}
                className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2 border-b border-gray-100">
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-655">
                      PO Number (Editable) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editPoNumber}
                      onChange={(e) => setEditPoNumber(e.target.value)}
                      placeholder="e.g. PO-2026-0001"
                      className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-600">
                      Supplier Partner *
                    </label>
                    <select
                      value={editSupplierId}
                      onChange={(e) => {
                        const sId = e.target.value;
                        setEditSupplierId(sId);
                        const sup = suppliers.find((s) => s.id === sId);
                        if (sup) {
                          setEditVendorName(sup.name);
                        }
                      }}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg text-slate-800 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} ({sup.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-600">
                      Order Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={editOrderDate}
                      onChange={(e) => setEditOrderDate(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-600">
                      Estimated Delivery Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={editDeliveryDate}
                      onChange={(e) => setEditDeliveryDate(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-600">
                      Fulfillment Target *
                    </label>
                    <select
                      value={editWarehouseId}
                      onChange={(e) => setEditWarehouseId(e.target.value)}
                      required
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-semibold text-gray-600">
                      Delivery Logistical Option (Optional)
                    </label>
                    <select
                      value={editDeliveryOption}
                      onChange={(e) => setEditDeliveryOption(e.target.value)}
                      className="w-full text-xs px-3.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white"
                    >
                      <option value="">Select Option (Optional)</option>
                      <option value="DHL Express">DHL Express</option>
                      <option value="FedEx Courier">FedEx Courier</option>
                      <option value="Air Freight">Air Freight</option>
                      <option value="Sea Cargo">Sea Cargo</option>
                      <option value="Land Logistics / Lalamove text">
                        Land Logistics / Lalamove
                      </option>
                      <option value="Warehouse Pickup">Warehouse Pickup</option>
                      <option value="Standard Mail">Standard Mail</option>
                    </select>
                  </div>
                </div>

                {/* Line Items drafting */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">
                      Lines ({editDraftedItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddEditRow}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      + Add Row Code
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editDraftedItems.map((row, idx) => (
                      <div key={idx} className="flex flex-col p-3 bg-slate-50 border border-gray-200 rounded-lg space-y-2.5">
                        <div className="flex gap-3 items-center">
                          {/* Select SKU/Name */}
                          <div className="flex-1 min-w-0">
                            <select
                              value={row.itemId}
                              onChange={(e) =>
                                handleUpdateEditRow(idx, {
                                  itemId: e.target.value,
                                })
                              }
                              className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold bg-white"
                            >
                              {items.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div className="w-24">
                            <input
                              type="number"
                              min={1}
                              placeholder="Qty"
                              value={row.quantity}
                              onChange={(e) =>
                                handleUpdateEditRow(idx, {
                                  quantity: Math.max(
                                    1,
                                    parseInt(e.target.value) || 0,
                                  ),
                                })
                              }
                              className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-center font-mono font-bold bg-white"
                            />
                          </div>

                          {/* Unit Cost */}
                          <div className="w-28 font-mono">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="Optional cost"
                              value={row.unitCost !== undefined ? row.unitCost : ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateEditRow(idx, {
                                  unitCost:
                                    val === ""
                                      ? undefined
                                      : Math.max(0, parseFloat(val) || 0),
                                });
                              }}
                              className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-right font-bold text-red-755 bg-white"
                            />
                          </div>

                          {/* Multiplied values UI */}
                          <div className="w-24 text-right pr-2 text-xs font-mono font-bold text-gray-900 font-mono">
                            {getCurrencySymbol(suppliers.find((s) => s.id === editSupplierId)?.currency || "USD")}
                            {getRowTotal(row).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </div>

                          {/* Delete row */}
                          <button
                            type="button"
                            onClick={() => handleRemoveEditRow(idx)}
                            disabled={editDraftedItems.length === 1}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Lot Assignment option */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs gap-2 pt-1.5 border-t border-gray-150">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Stock Lot Assignment:</span>
                            <select
                              value={row.lotId || ""}
                              onChange={(e) => {
                                const val = e.target.value || undefined;
                                if (val) {
                                  const violation = getFifoViolation(row.itemId, editWarehouseId, val);
                                  if (violation.violated && violation.selected && violation.oldest) {
                                    alert(
                                      `⚠️ FIFO STOCKING PRINCIPLE WARNING!\n\n` +
                                      `The lot "${violation.selected.lotNumber}" was received LATER than "${violation.oldest.lotNumber}" (received on ${new Date(violation.oldest.dateReceived).toLocaleDateString()}).\n\n` +
                                      `Dispensing this lot violates the FIFO (First In, First Out) principle.`
                                    );
                                  }
                                }
                                handleUpdateEditRow(idx, { lotId: val });
                              }}
                              className="text-xs px-2.5 py-1 border border-gray-250 rounded-lg bg-white font-medium text-slate-800"
                            >
                              <option value="">No Lot Assigned</option>
                              {lots
                                .filter(l => l.itemId === row.itemId && l.warehouseId === editWarehouseId && l.quantityRemaining > 0)
                                .map(l => (
                                  <option key={l.id} value={l.id}>
                                    {l.lotNumber} ({l.quantityRemaining} left, rec. {new Date(l.dateReceived).toLocaleDateString()})
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Highlighting oldest lot and mechanism to apply */}
                          {(() => {
                            const oldestLot = getOldestLotInfo(row.itemId, editWarehouseId);
                            const violation = getFifoViolation(row.itemId, editWarehouseId, row.lotId);

                            if (oldestLot) {
                              if (violation.violated) {
                                return (
                                  <span className="text-rose-600 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 px-2.5 py-1 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                        onClick={() => handleUpdateEditRow(idx, { lotId: oldestLot.id })}
                                        title="Click to automatically apply the FIFO-compliant lot">
                                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                                    <span>FIFO violation! <u>Apply Compliant Lot: {oldestLot.lotNumber}</u></span>
                                  </span>
                                );
                              } else if (!row.lotId) {
                                return (
                                  <span className="text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-150 px-2.5 py-1 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                        onClick={() => handleUpdateEditRow(idx, { lotId: oldestLot.id })}
                                        title="Click to automatically apply the FIFO-compliant lot">
                                    <AlertCircle className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Oldest Lot available: <u>Apply {oldestLot.lotNumber}</u></span>
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-150 flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>✓ FIFO compliant (oldest lot selected)</span>
                                  </span>
                                );
                              }
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Taxes & Discounts policy selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-gray-150 text-left">
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">
                      VAT/Tax Config
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">
                          Option
                        </label>
                        <select
                          value={editTaxType}
                          onChange={(e) =>
                            setEditTaxType(
                              e.target.value as
                                | "VAT"
                                | "Non-VAT"
                                | "Custom"
                                | "None",
                            )
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg bg-white font-medium text-slate-800"
                        >
                          <option value="VAT">VAT</option>
                          <option value="Non-VAT">Non-VAT</option>
                          <option value="None">
                            Choose to not add any option
                          </option>
                        </select>
                      </div>

                      {editTaxType === "Custom" && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">
                            Rate (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={editCustomTaxRate}
                            onChange={(e) =>
                              setEditCustomTaxRate(
                                Math.max(0, parseFloat(e.target.value) || 0),
                              )
                            }
                            className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-mono font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">
                      Discount Policy
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">
                          Type
                        </label>
                        <select
                          value={editDiscountType}
                          onChange={(e) =>
                            setEditDiscountType(
                              e.target.value as "Percentage" | "Fixed" | "None",
                            )
                          }
                          className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg bg-white font-medium text-slate-800 font-sans"
                        >
                          <option value="None">None</option>
                          <option value="Percentage">Percentage (%)</option>
                          <option value="Fixed">Fixed Amount ({editSupplierCurrency})</option>
                        </select>
                      </div>

                      {editDiscountType !== "None" && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">
                            Value
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editDiscountValue}
                            onChange={(e) =>
                              setEditDiscountValue(
                                Math.max(0, parseFloat(e.target.value) || 0),
                              )
                            }
                            className="w-full text-xs px-3 py-2 border border-gray-250 rounded-lg font-mono font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* File Upload zone with editAttachments listing */}
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-gray-150 text-left">
                  <span className="text-[11px] font-bold text-slate-700 uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                    <span>Upload Documents / Attachments</span>
                  </span>

                  <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors p-4 rounded-xl bg-indigo-50/10 text-center relative">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleFileUpload(e, true)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <Paperclip className="w-5 h-5 mx-auto text-indigo-500 animate-bounce" />
                      <p className="text-xs font-semibold text-slate-700">
                        Drag items here or click to select files
                      </p>
                      <p className="text-[10px] text-gray-400">
                        PDF, XLS, DOCX, ZIP, JPG (max 10MB per file)
                      </p>
                    </div>
                  </div>

                  {editAttachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {editAttachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg shrink-0"
                        >
                          <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold text-gray-950 truncate">
                              {file.name}
                            </div>
                            <div className="text-[9px] text-gray-400 font-mono">
                              {(file.size / 1024).toFixed(0)} KB
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveAttachment(file.id, true)
                            }
                            className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  <div className="space-y-1 text-left col-span-1">
                    <label className="text-xs font-semibold text-gray-600">
                      Purchasing Notes/Warranty Instruction
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Special instructions for the vendor..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full text-xs px-3.5 py-1.5 border border-gray-250 rounded-lg bg-white"
                    />
                  </div>

                  <div className="col-span-1">
                    {(() => {
                      const subtotal = editDraftedItems.reduce(
                        (acc, row) =>
                          acc + row.quantity * (row.unitCost ?? 0),
                        0,
                      );
                      let discountAmount = 0;
                      if (editDiscountType === "Percentage") {
                        discountAmount = subtotal * (editDiscountValue / 100);
                      } else if (editDiscountType === "Fixed") {
                        discountAmount = editDiscountValue;
                      }
                      const subtotalAfterDiscount = Math.max(
                        0,
                        subtotal - discountAmount,
                      );

                      let taxRate = 0.12;
                      if (editTaxType === "Non-VAT") {
                        taxRate = 0;
                      } else if (editTaxType === "Custom") {
                        taxRate = editCustomTaxRate / 100;
                      }

                      const tax = subtotalAfterDiscount * taxRate;
                      const total = subtotalAfterDiscount + tax;

                      const selectedCurrency =
                        suppliers.find((s) => s.id === editSupplierId)
                          ?.currency || "USD";
                      const selectedExRate =
                        suppliers.find((s) => s.id === editSupplierId)
                          ?.exchangeRate || 1.0;

                      return (
                        <div className="space-y-1.5 text-xs font-mono text-gray-655 text-right pr-2">
                          <div className="flex justify-between max-w-xs ml-auto">
                            <span>Subtotal ({selectedCurrency}):</span>
                            <span>
                              {getCurrencySymbol(selectedCurrency)}
                              {subtotal.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          {editDiscountType !== "None" && (
                            <div className="flex justify-between max-w-xs ml-auto text-red-605">
                              <span>
                                Discount (
                                {editDiscountType === "Percentage"
                                  ? `${editDiscountValue}%`
                                  : "Fixed"}
                                ):
                              </span>
                              <span>
                                -{getCurrencySymbol(selectedCurrency)}
                                {discountAmount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          )}
                          {editDiscountType !== "None" && (
                            <div className="flex justify-between max-w-xs ml-auto text-gray-400 font-bold border-t border-dashed border-gray-200 pt-1">
                              <span>Subtotal After Disc:</span>
                              <span>
                                {getCurrencySymbol(selectedCurrency)}
                                {subtotalAfterDiscount.toLocaleString(
                                  undefined,
                                  { minimumFractionDigits: 2 },
                                )}
                              </span>
                            </div>
                          )}
                          {editTaxType !== "None" && (
                            <div className="flex justify-between max-w-xs ml-auto">
                              <span>
                                Estimated Tax (
                                {editTaxType === "VAT"
                                  ? "VAT 12%"
                                  : editTaxType === "Non-VAT"
                                    ? "Non-VAT 0%"
                                    : `Custom ${editCustomTaxRate}%`}
                                ):
                              </span>
                              <span>
                                {editTaxType === "None"
                                  ? `${getCurrencySymbol(selectedCurrency)}0.00`
                                  : `${getCurrencySymbol(selectedCurrency)}${tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between max-w-xs ml-auto border-t border-gray-250 pt-1.5 text-sm font-bold text-gray-900">
                            <span>Grand Total ({selectedCurrency}):</span>
                            <span>
                              {getCurrencySymbol(selectedCurrency)}
                              {total.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setEditingPOId(null);
                  }}
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

      {/* GOODS RECEIPT COMPLIANCE PDF FORM VIEWER MODAL */}
      {isGoodsReceiptOpen && focusedPO && (() => {
        const grNumber = selectedGRForView ? selectedGRForView.grNumber : `GR-${focusedPO.poNumber.replace('PO-', '')}`;
        const receivedDate = selectedGRForView ? selectedGRForView.receivedDate : (focusedPO.actualDeliveryDate || focusedPO.deliveryDate);
        const receivedBy = selectedGRForView ? selectedGRForView.receivedBy : (focusedPO.statusHistory?.[focusedPO.statusHistory.length - 1]?.user || 'Warehouse checker');
        const notesValue = selectedGRForView ? selectedGRForView.notes : (focusedPO.notes || 'Verified in compliance with purchase specifications and delivered in pristine hardware state.');

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl border border-gray-150 w-full max-w-3xl overflow-hidden animate-in fade-in duration-150">
              {/* Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold font-mono uppercase tracking-wider">
                    Goods Receipt (GR) Ledger Sheet
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGoodsReceiptOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Receipt Inner Document Structure */}
              <div id="goods-receipt-document" className="p-8 space-y-6 text-left text-xs bg-white text-slate-800">
                {/* Document Header */}
                <div className="flex justify-between items-start border-b border-gray-200 pb-5">
                  <div>
                    <h1 className="text-lg font-bold uppercase tracking-tight text-slate-900">
                      PHILIPPINE CODA INDUSTRIES
                    </h1>
                    <p className="text-[10px] text-gray-500 font-mono">
                      Warehouse Hub Location & Logistics Distribution Center
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                      TIN Registration No: 405-192-385-000 • VAT Registered
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="p-1 px-2 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold uppercase block w-max ml-auto mb-1.5">
                      Goods Receipt Received
                    </span>
                    <div className="text-slate-900 text-xs font-bold">
                      GR NUMBER: <span className="font-bold font-mono text-slate-950">{grNumber}</span>
                    </div>
                    <div className="text-gray-500 mt-1 font-sans">
                      Date Received: <span className="font-bold">{receivedDate}</span>
                    </div>
                    <div className="text-gray-400 text-[10px] mt-0.5">
                      Related PO Reference: {focusedPO.poNumber}
                    </div>
                  </div>
                </div>

              {/* Contracting Parties */}
              <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50/70 border border-slate-100 rounded-lg">
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 font-mono tracking-wider block mb-1">
                    SUPPLIER VENDOR BRAND / ORIGIN:
                  </span>
                  <div className="space-y-0.5 font-medium text-slate-850">
                    <strong className="text-indigo-950 font-bold text-xs">{focusedPO.vendorName}</strong>
                    {(() => {
                      const matchedSup = suppliers.find(s => s.id === focusedPO.supplierId);
                      if (matchedSup) {
                        return (
                          <>
                            <p className="font-mono text-[10px] text-gray-500">TIN: {matchedSup.tin || '402-911-385-000'}</p>
                            <p className="text-gray-500">{matchedSup.contactPerson} ({matchedSup.contactPhone || 'No direct phone'})</p>
                            <p className="text-gray-400 block text-[10px]">{matchedSup.address || 'Address on file'}</p>
                          </>
                        );
                      }
                      return <p className="text-gray-400">Supplier contact profiles linked in workspace catalog.</p>;
                    })()}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 font-mono tracking-wider block mb-1">
                    DESTINATION RECEIVING SITE:
                  </span>
                  <div className="space-y-0.5 font-medium text-slate-850">
                    {(() => {
                      const matchedWh = warehouses.find(w => w.id === focusedPO.warehouseId);
                      if (matchedWh) {
                        return (
                          <>
                            <strong className="text-slate-950 font-bold block">{matchedWh.name}</strong>
                            <p className="font-mono text-[10px] text-gray-500">Site Code: {matchedWh.code}</p>
                            <p className="text-gray-500">Logistics address: {matchedWh.location}</p>
                          </>
                        );
                      }
                      return <strong className="text-slate-950">Central Receiving Hub</strong>;
                    })()}
                    <p className="text-[10px] text-indigo-600 font-medium mt-1">Forwarder/Shipment Option: {focusedPO.deliveryOption || 'Standard Carrier Service'}</p>
                  </div>
                </div>
              </div>

              {/* Received Items table sheet */}
              <div className="space-y-2 text-left">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
                  RECEIPT LINE ITEMS VERIFIED LEDGER
                </span>
                <table className="min-w-full divide-y divide-gray-200 border border-slate-100 rounded-lg text-xs">
                  <thead className="bg-slate-50 font-mono text-[10px]">
                    <tr className="text-left font-bold text-gray-500">
                      <th className="px-3 py-2">No.</th>
                      <th className="px-3 py-2">Product SKU</th>
                      <th className="px-3 py-2">Item Description / Specs</th>
                      <th className="px-3 py-2 text-center">Batch Lots Created</th>
                      <th className="px-3 py-2 text-right">Qty Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-slate-705">
                    {(() => {
                      const grLines = selectedGRForView 
                        ? selectedGRForView.items 
                        : focusedPO.items.map(it => {
                            const itemObj = items.find(p => p.id === it.itemId);
                            return {
                              itemId: it.itemId,
                              sku: itemObj?.sku || 'N/A',
                              name: itemObj?.name || 'Unidentified Item',
                              quantity: it.quantity
                            };
                          });

                      return grLines.map((it, idx) => {
                        const itemObj = items.find(p => p.id === it.itemId);
                        const poLine = focusedPO.items.find(l => l.itemId === it.itemId);

                        // Seek specific stock lots matching this PO, item and Goods Receipt filter
                        const relatedLots = (lots || []).filter(l => 
                          l.itemId === it.itemId && 
                          (l.poId === focusedPO.id || l.poNumber === focusedPO.poNumber || l.lotNumber.includes(focusedPO.poNumber.slice(-5))) &&
                          (!selectedGRForView || l.grNumber === selectedGRForView.grNumber || l.grId === selectedGRForView.id)
                        );
                        const lotStr = relatedLots.length > 0 
                          ? relatedLots.map(l => l.lotNumber).join(', ')
                          : `LOT-${focusedPO.poNumber.substring(3)}-${it.sku || idx}`;

                        return (
                          <tr key={it.itemId} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 font-mono text-gray-450">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{it.sku}</td>
                            <td className="px-3 py-2.5">
                              <span className="font-semibold text-slate-800">{it.name}</span>
                              {itemObj?.brand && <span className="block text-[9px] text-gray-400 font-mono">Brand: {itemObj.brand}</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-[10px] text-indigo-650 font-semibold">{lotStr}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{it.quantity} {itemObj?.unit || 'pcs'}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Status note remarks */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-slate-600">
                <span className="font-mono text-[9px] block uppercase font-bold text-slate-500 mb-0.5">RECEIVING OBSERVATIONS & NOTES:</span>
                <p className="italic leading-normal text-left text-[11px]">
                  {notesValue}
                </p>
              </div>

              {/* Signatures checklist */}
              <div className="grid grid-cols-3 gap-8 pt-8 border-t border-dashed border-gray-200 text-center text-[10px]">
                <div className="space-y-4">
                  <span className="text-gray-400 uppercase tracking-widest block font-mono text-[8px]">LOGISTICS RECEIVER OFFICER</span>
                  <div className="border-b border-slate-350 mx-4 h-6 pt-1">
                    <span className="font-serif font-semibold italic text-slate-700">{receivedBy}</span>
                  </div>
                  <span className="text-gray-500 block font-bold font-mono font-sans mt-1">Sign-off / Date Verified</span>
                </div>

                <div className="space-y-4">
                  <span className="text-gray-400 uppercase tracking-widest block font-mono text-[8px]">QUALITY CONTROL CHECKED BY</span>
                  <div className="border-b border-slate-350 mx-4 h-6 pt-1">
                    <span className="text-[11px] text-gray-300 italic flex justify-center items-center">Signature on terminal</span>
                  </div>
                  <span className="text-gray-500 block font-bold font-mono font-sans mt-1">QC Officer</span>
                </div>

                <div className="space-y-4">
                  <span className="text-gray-400 uppercase tracking-widest block font-mono text-[8px]">APPROVED SUPPLY CHAIN HD</span>
                  <div className="border-b border-slate-350 mx-4 h-6 pt-1">
                    <span className="text-[11px] font-sans font-extrabold text-slate-800">John Silverio</span>
                  </div>
                  <span className="text-gray-500 block font-bold font-mono font-sans mt-1">Authorized Operations Manager</span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="bg-slate-50 p-3.5 border-t border-gray-150 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 block font-mono">
                Logistics sheet generated under central compliance guidelines.
              </span>
              <div className="flex items-center gap-2">
                {selectedGRForView && onDeleteGoodsReceipt && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteGoodsReceipt(selectedGRForView.id);
                      setIsGoodsReceiptOpen(false);
                    }}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition-colors cursor-pointer flex items-center gap-1.5 uppercase"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete GR</span>
                  </button>
                )}
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
                  onClick={() => setIsGoodsReceiptOpen(false)}
                  className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded transition-colors cursor-pointer uppercase"
                >
                  Close View
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {isCreateReceiptOpen && focusedPO && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl border border-gray-250 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-left">
              <FileCheck className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-base font-bold font-mono leading-none">NEW GOODS RECEIPT</h3>
                <p className="text-[10px] text-indigo-200 font-sans mt-0.5">For Purchase Order: {focusedPO.poNumber}</p>
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

              // Validate at least one item quantity is received > 0
              const hasSelectedItems = Object.entries(receiptForm.receivedAmounts).some(([itemId, qty]) => Number(qty) > 0);
              if (!hasSelectedItems) {
                alert("⚠️ Warning: You must input a received quantity (> 0) for at least one item to log a goods receipt.");
                return;
              }

              // Verify that the sum of splits exactly matches the checked-in quantity
              let validationFailed = false;
              let alertMsg = "";

              Object.entries(receiptForm.receivedAmounts).forEach(([itemId, qty]) => {
                const checkedQty = Number(qty);
                if (checkedQty > 0) {
                  const splits = lotSplitsState[itemId] || [];
                  const splitSum = splits.reduce((sum, s) => sum + Number(s.quantity), 0);
                  if (splitSum !== checkedQty) {
                    const itemObj = items.find(p => p.id === itemId);
                    validationFailed = true;
                    alertMsg += `⚠️ ${itemObj?.name || 'Item'}: Designated check-in amount is ${checkedQty} units, but your custom batch lot splits sum to ${splitSum} units.\nSplit quantities must exactly match the overall checked-in amount.\n\n`;
                  }
                  
                  // Validate lot numbers are filled
                  const hasEmptyLotNum = splits.some(s => !s.lotNumber || !s.lotNumber.trim());
                  if (hasEmptyLotNum) {
                    const itemObj = items.find(p => p.id === itemId);
                    validationFailed = true;
                    alertMsg += `⚠️ ${itemObj?.name || 'Item'}: You have left some Lot ID fields blank. All batch splits require a valid Lot Number.\n\n`;
                  }
                }
              });

              if (validationFailed) {
                alert(alertMsg);
                return;
              }

              // Build lot splits payload
              const lotSplitsToSend: Array<{ itemId: string; lotNumber: string; quantity: number; expiryDate?: string }> = [];
              Object.entries(lotSplitsState).forEach(([itemId, splits]) => {
                const isSelected = (receiptForm.receivedAmounts[itemId] ?? 0) > 0;
                if (isSelected && splits) {
                  (splits as any[]).forEach(s => {
                    if (s.quantity > 0) {
                      lotSplitsToSend.push({
                        itemId,
                        lotNumber: s.lotNumber.trim(),
                        quantity: s.quantity,
                        expiryDate: s.expiryDate
                      });
                    }
                  });
                }
              });

              // Call onReceivePOBatch prop with lotSplitsToSend
              if (onReceivePOBatch) {
                onReceivePOBatch(
                  focusedPO.id,
                  receiptForm.receiptNumber,
                  receiptForm.receivedBy,
                  receiptForm.receivedDate,
                  receiptForm.notes,
                  receiptForm.receivedAmounts,
                  receiptForm.lotNumbers,
                  lotSplitsToSend
                );
              }

              setIsCreateReceiptOpen(false);
            }}
            className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-left bg-slate-50/50"
          >
            {/* Metadata Fields Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-gray-150">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Goods Receipt Number *</label>
                <input
                  type="text"
                  required
                  value={receiptForm.receiptNumber}
                  onChange={(e) => setReceiptForm({ ...receiptForm, receiptNumber: e.target.value })}
                  className="w-full text-xs font-mono font-bold text-gray-900 border border-gray-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Received Date *</label>
                <input
                  type="date"
                  required
                  value={receiptForm.receivedDate}
                  onChange={(e) => setReceiptForm({ ...receiptForm, receivedDate: e.target.value })}
                  className="w-full text-xs font-mono font-medium text-gray-950 border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Received By / Checker *</label>
                <input
                  type="text"
                  required
                  value={receiptForm.receivedBy}
                  onChange={(e) => setReceiptForm({ ...receiptForm, receivedBy: e.target.value })}
                  className="w-full text-xs font-medium text-slate-950 border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-505 transition-colors"
                />
              </div>
            </div>

            {/* Items Table selection */}
            <div className="bg-white p-4 rounded-xl border border-gray-150 space-y-3">
              <span className="text-[10px] uppercase font-mono font-extrabold text-gray-400 block tracking-wider">Select Quantities to Check-In (Received)</span>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                {focusedPO.items.map((line) => {
                  const itemObj = items.find((p) => p.id === line.itemId);
                  const qtyRemaining = line.quantity - (line.receivedQuantity || 0);
                  const activeReceivedValue = receiptForm.receivedAmounts[line.itemId] ?? 0;
                  const isChecked = activeReceivedValue > 0;

                  return (
                    <div key={line.itemId} className={`p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center transition-colors ${isChecked ? 'bg-indigo-50/20' : 'bg-white'}`}>
                      <div className="md:col-span-1 flex justify-center">
                        <input
                          type="checkbox"
                          disabled={qtyRemaining <= 0}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setReceiptForm({
                                ...receiptForm,
                                receivedAmounts: {
                                  ...receiptForm.receivedAmounts,
                                  [line.itemId]: qtyRemaining
                                }
                              });
                            } else {
                              setReceiptForm({
                                ...receiptForm,
                                receivedAmounts: {
                                  ...receiptForm.receivedAmounts,
                                  [line.itemId]: 0
                                }
                              });
                            }
                          }}
                          className="w-4 h-4 text-indigo-650 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="md:col-span-5 text-left">
                        <span className={`font-bold text-xs block ${isChecked ? 'text-indigo-950' : 'text-slate-800'}`}>{itemObj?.name || 'Product Unit'}</span>
                        <span className="font-mono text-[9px] text-gray-400 block mt-0.5">
                          SKU: {itemObj?.sku} — Ordered: {line.quantity} | Checked: {line.receivedQuantity || 0} | Remaining: {qtyRemaining}
                        </span>
                      </div>
                      <div className="md:col-span-3 text-right">
                        {qtyRemaining <= 0 ? (
                          <span className="text-[9px] font-bold text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded">✓ FULLY RECEIVED</span>
                        ) : isChecked ? (
                          <span className="text-[9px] font-bold text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded animate-pulse">⚡ TO RECEIVE</span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">⏹️ SKIPPED</span>
                        )}
                      </div>
                      <div className="md:col-span-3">
                        <input
                          type="number"
                          min={0}
                          max={Math.max(0, qtyRemaining)}
                          disabled={qtyRemaining <= 0 || !isChecked}
                          value={activeReceivedValue}
                          onChange={(e) => {
                            const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), qtyRemaining);
                            setReceiptForm({
                              ...receiptForm,
                              receivedAmounts: {
                                ...receiptForm.receivedAmounts,
                                [line.itemId]: val
                              }
                            });
                          }}
                          className="w-full text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-gray-300 rounded-lg p-2 text-center focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:opacity-45"
                        />
                      </div>

                      {/* Interactive FIFO Multi-Entry Splits Manager */}
                      {isChecked && (() => {
                        const splits = lotSplitsState[line.itemId] || [];
                        const totalSplitSum = splits.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
                        const isMatched = totalSplitSum === activeReceivedValue;

                        return (
                          <div className="md:col-span-12 bg-indigo-50/30 p-4 border-t border-indigo-100/50 space-y-3.5 text-xs text-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold text-indigo-900 font-mono uppercase tracking-widest flex items-center gap-1">
                                <span>📦 FIFO Barcodes / Multi-Entry Lots Splits</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const splitsCopy = [...splits];
                                  const randValue = Math.floor(1000 + Math.random() * 9000);
                                  splitsCopy.push({
                                    id: Math.random().toString(36).substring(7),
                                    lotNumber: `LOT-${focusedPO.poNumber.substring(3)}-${itemObj?.sku || 'SKU'}-${randValue}`,
                                    quantity: 0,
                                    expiryDate: ''
                                  });
                                  setLotSplitsState({
                                    ...lotSplitsState,
                                    [line.itemId]: splitsCopy
                                  });
                                }}
                                className="px-2 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300 text-indigo-700 font-bold font-mono text-[9px] rounded-md transition-all flex items-center gap-1 shadow-2xs hover:shadow-xs cursor-pointer"
                              >
                                <Plus className="w-3 h-3 text-indigo-500" />
                                <span>Add Split Batch / Multi-Entry</span>
                              </button>
                            </div>

                            {/* Splits List */}
                            <div className="space-y-2">
                              {splits.map((s, sIdx) => (
                                <div key={s.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-white/70 p-2.5 rounded-lg border border-slate-205/65 items-center">
                                  <div className="md:col-span-1 text-center font-mono text-[10px] text-gray-400 font-extrabold">
                                    #{sIdx + 1}
                                  </div>
                                  <div className="md:col-span-5">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 uppercase text-[9px] font-mono text-indigo-400 font-extrabold">Lot:</span>
                                      <input
                                        type="text"
                                        required
                                        placeholder="Lot ID or custom barcode..."
                                        value={s.lotNumber}
                                        onChange={(e) => {
                                          const splitsCopy = splits.map(item => item.id === s.id ? { ...item, lotNumber: e.target.value } : item);
                                          setLotSplitsState({ ...lotSplitsState, [line.itemId]: splitsCopy });
                                        }}
                                        className="w-full text-[11px] font-mono font-bold text-indigo-950 bg-white border border-slate-250 rounded-md p-1.5 pl-10 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                                      />
                                    </div>
                                  </div>
                                  <div className="md:col-span-3">
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-gray-400 font-extrabold">Qty:</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={activeReceivedValue}
                                        required
                                        value={s.quantity}
                                        onChange={(e) => {
                                          const enteredQty = Math.max(0, parseInt(e.target.value) || 0);
                                          const splitsCopy = splits.map(item => item.id === s.id ? { ...item, quantity: enteredQty } : item);
                                          setLotSplitsState({ ...lotSplitsState, [line.itemId]: splitsCopy });
                                        }}
                                        className="w-full text-[11px] font-mono font-bold text-center text-slate-900 bg-white border border-slate-250 rounded-md p-1.5 pl-8 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                                      />
                                    </div>
                                  </div>
                                  <div className="md:col-span-2">
                                    <input
                                      type="date"
                                      title="Optional Expiry Date"
                                      value={s.expiryDate}
                                      onChange={(e) => {
                                        const splitsCopy = splits.map(item => item.id === s.id ? { ...item, expiryDate: e.target.value } : item);
                                        setLotSplitsState({ ...lotSplitsState, [line.itemId]: splitsCopy });
                                      }}
                                      className="w-full text-[10px] font-mono text-gray-700 bg-white border border-slate-250 rounded-md p-1 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                                    />
                                  </div>
                                  <div className="md:col-span-1 text-right">
                                    {splits.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const splitsCopy = splits.filter(item => item.id !== s.id);
                                          setLotSplitsState({ ...lotSplitsState, [line.itemId]: splitsCopy });
                                        }}
                                        className="p-1 px-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded border border-rose-100 transition-colors cursor-pointer"
                                        title="Remove split batch entry"
                                      >
                                        <X className="w-3.5 h-3.5 mx-auto" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Verification Summary for splits */}
                            <div className="flex items-center justify-between pt-1 border-t border-indigo-100/30">
                              <span className="text-[10px] text-gray-500">
                                Allocated check-in sum: <strong className="font-mono">{totalSplitSum}</strong> of <strong className="font-mono">{activeReceivedValue}</strong>
                              </span>
                              {isMatched ? (
                                <span className="text-[10px] text-emerald-600 font-bold font-mono">
                                  ✔ Splits sum matches check-in quantity!
                                </span>
                              ) : (
                                <span className={`text-[10px] font-bold font-mono ${totalSplitSum > activeReceivedValue ? 'text-rose-600 animation-pulse' : 'text-amber-600 animate-pulse'}`}>
                                  ⚠ Splits mismatch! Change splits content by {activeReceivedValue - totalSplitSum} units.
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Remarks/Notes */}
            <div className="bg-white p-4 rounded-xl border border-gray-150 space-y-1.5 font-sans">
              <label className="text-[10px] uppercase font-extrabold text-gray-400 font-mono block">Receipt Handling Remarks</label>
              <textarea
                value={receiptForm.notes}
                onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                placeholder="e.g. Items counted, verified pristine condition under checklist guidelines..."
                className="w-full text-xs font-medium text-slate-900 border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 hover:border-gray-400 transition-colors h-16 resize-none"
              />
            </div>

            {/* Submit Buttons */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateReceiptOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
              >
                ✔ Commit Goods Receipt
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </div>
  );
}
