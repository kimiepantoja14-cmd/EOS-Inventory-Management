/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StockLot {
  id: string;
  itemId: string;
  lotNumber: string;
  warehouseId: string;
  quantityReceived: number;
  quantityRemaining: number;
  dateReceived: string; // ISO date for FIFO calculation
  expiryDate?: string;
  barcodeValue: string; // Text to be rendered as visual QR/Barcode
  poId?: string;         // explicit link to Purchase Order
  poNumber?: string;     // explicit link PO Number
  grId?: string;         // explicit link to Goods Receipt Record
  grNumber?: string;     // explicit link Goods Receipt Number
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  tin: string; // Tax Identification Number, standard in PH
  status: 'Active' | 'Inactive';
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Staff';
  status: 'Active' | 'Inactive';
  password?: string;
  isApproved?: boolean;
  mustChangePassword?: boolean;
  permissions: {
    canEditItems: boolean;
    canEditSuppliers: boolean;
    canEditPurchaseOrders: boolean;
    canEditSalesOrders: boolean;
    canManageUsers: boolean;
    canAdjustStock: boolean;
    canRevertLifecycle?: boolean;
    canSeePricing?: boolean; // admin can select which user can see cost/selling price of items
    canViewAuditHistories?: boolean; // admin can select who can see audit histories
    allowedTabs?: string[]; // admin can select which component can be viewed by the user
  };
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location: string;
  contactEmail: string;
  status: 'Active' | 'Inactive';
  maxCapacity?: number; // defined maximum capacity attribute
}

export interface ExchangeRateRecord {
  rate: number;
  timestamp: string; // ISO date/time string e.g. '2026-05-20T12:00:00Z'
  source: 'Manual' | 'Auto-Fetched';
}

export interface Supplier {
  id: string;
  name: string;
  currency: string; // "USD", "EUR", "GBP", "JPY", "AUD", etc.
  exchangeRate: number; // 1 Base (USD) = exchangeRate Supplier units (e.g. 0.92 EUR)
  contactPerson: string;
  email: string;
  phone: string;
  leadTimeDays: number; // typical supplier order fulfillment window in days
  exchangeRateHistory?: ExchangeRateRecord[];
  supplierType?: 'Local' | 'International'; // local vs international option
  tin?: string;
  address?: string;
  contactPhone?: string;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  purchasePrice: number; // in supplier currency!
  sellingPrice: number; // in base currency (PHP)
  reorderPoint: number; // also referred to as Reorder Level
  category: string;
  brand: string; // brand of the product
  applicableUnits?: string; // compatible or applicable other units/models
  alternatePartNumbers?: string; // alternate part numbers
  status: 'Active' | 'Inactive';
  stockByWarehouse: Record<string, number>; // warehouseId -> quantity
  imageUrl?: string;
  supplierId?: string; // preferred supplier for this item
}

export interface AttachmentRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string; // BASE64 or mockup URL representing file data
  uploadedAt: string;
}

export interface POItem {
  itemId: string;
  quantity: number;
  unitCost?: number; // recorded in base currency
  lotId?: string;
  receivedQuantity?: number; // explicitly tracked received quantity for partial receipts
}

export interface POStatusHistoryEntry {
  status: 'Draft' | 'Issued' | 'In Transit' | 'Received' | 'Cancelled';
  date: string;
  note: string;
  user?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string; // retained for backwards compatibility
  supplierId?: string; // pointer to Supplier profile
  orderDate: string;
  deliveryDate: string; // expected delivery date
  actualDeliveryDate?: string; // when received
  leadTimeDays?: number; // active elapsed leadtime days track
  status: 'Draft' | 'Issued' | 'In Transit' | 'Received' | 'Cancelled';
  warehouseId: string; // destination warehouse
  items: POItem[];
  subtotal: number; // in base currency
  tax: number; // in base currency
  total: number; // in base currency
  currency?: string; // supplier currency at time of PO
  exchangeRate?: number; // supplier exchange rate at time of PO
  notes: string;
  statusHistory?: POStatusHistoryEntry[];
  taxType?: 'VAT' | 'Non-VAT' | 'Custom' | 'None';
  customTaxRate?: number; // custom percentage (e.g. 15 for 15%)
  discountType?: 'Percentage' | 'Fixed' | 'None';
  discountValue?: number; // discount amount or rate
  attachments?: AttachmentRecord[];
  deliveryOption?: string; // delivery option selected by planner
  goodsReceipt?: {
    receiptNumber: string;
    receivedBy: string;
    receivedDate: string;
    remarks: string;
  };
}

export interface SOItem {
  itemId: string;
  quantity: number;
  unitPrice: number;
  lotId?: string;
  category?: 'Parts' | 'Services'; // Allow per-item category allocation (Parts vs. Services)
  note?: string; // custom line-item note/remark
  shippedQuantity?: number; // tracked shipped quantity for partial deliveries
}

export interface SOStatusHistoryEntry {
  status: 'Draft' | 'Confirmed' | 'On Going' | 'Received' | 'Cancelled' | 'Shipped';
  date: string;
  note: string;
  user?: string;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customerName: string;
  customerId?: string; // pointer to Customer
  orderDate: string;
  shipmentDate: string;
  status: 'Draft' | 'Confirmed' | 'On Going' | 'Received' | 'Cancelled' | 'Shipped';
  warehouseId: string; // source warehouse
  items: SOItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  referenceNo?: string;
  orderPurpose?: 'Sales' | 'Warranty'; // sales order can be for warranty or sales
  machineSerialNumber?: string; // associated machine serial number
  description?: string; // sales order description header level entry
  salesCluster?: string; // sales cluster Head Office, Davao, Coda, Homonhon, North Luzon, Other etc.
  taxType?: 'VAT' | 'Non-VAT' | 'Custom' | 'None';
  customTaxRate?: number; // custom percentage (e.g. 5 for 5%)
  discountType?: 'Percentage' | 'Fixed' | 'None';
  discountValue?: number; // discount amount or rate
  attachments?: AttachmentRecord[];
  region?: string; // dynamic selection
  salesCategory?: 'Parts' | 'Services' | 'Both'; // overall indicator - retained for backwards compatibility
  statusHistory?: SOStatusHistoryEntry[]; // interactive status history trail
  deliveryOption?: string; // delivery option select
  isPaid?: boolean;
  paymentStatus?: 'Paid' | 'Unpaid' | 'Partial';
  isInvoiced?: boolean;
  invoiceStatus?: 'Invoiced' | 'Uninvoiced' | 'Draft';
  subject?: string; // Subject of the Sales Order
  partsRequired?: string; // Parts required (if any)
}

export interface MachineLog {
  id: string;
  serialNumber: string;
  model: string;
  deliveryDate: string;
  warrantyStart: string;
  warrantyEnd: string;
  customerId: string;
  customerName: string;
  salesOrderId: string;
  soNumber: string;
  status: 'Operational' | 'Breakdown' | 'Operational with Problem' | 'Other' | 'Deployed' | 'Active Maintenance' | 'Warranty Claim' | 'Retired';
  notes?: string;
  description?: string;
  machineLocation?: string; // current active location of machinery
  warrantyStatus?: 'warranty/primecare' | 'non-warranty/primecare' | 'non-warranty/non-primecacre' | 'warranty/non-primecare';
  classification?: 'Service Campaign' | 'Core Product'; // option for service campaign or core products
  // NEW Heavy Machinery Fields
  warrantyPeriod?: string; // e.g. "24 Months"
  unitWarranty?: string; // e.g. "Active", "Expired"
  unitPrimecare?: string; // e.g. "Active", "Expired"
  currentSmr?: number; // e.g. 1540 (Service Meter Reading)
  updateDate?: string; // date of last hour meter update
  lastPmsAndHourMeter?: string; // e.g. "PMS 250 Hrs @ 245 Hrs"
  region?: string; // REGION
  remarks?: string; // REMARKS
  contactPerson?: string; // CONTACT PERSON
  contactNo?: string; // CONTACT NO
  updatedCustomerContact?: string; // UPDATED CUSTOMER CONTACT
}

export interface TransferItem {
  itemId: string;
  quantity: number;
  lotId?: string;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  transferDate: string;
  status: 'Draft' | 'In Transit' | 'Completed' | 'Cancelled';
  items: TransferItem[];
  notes: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number; // positive or negative
  type: 'Purchase' | 'Sales' | 'Transfer Out' | 'Transfer In' | 'Adjustment';
  referenceNumber: string; // PO / SO / TR Number
  warehouseId: string;
  warehouseName: string;
  date: string;
  description: string;
  lotId?: string;
}

export interface StockAdjustment {
  itemId: string;
  warehouseId: string;
  adjustmentType: 'add' | 'remove' | 'set';
  quantity: number;
  reason: string;
}

export interface LoginSessionLog {
  id: string;
  userName: string;
  userEmail: string;
  userRole: string;
  timestamp: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILED';
  reason?: string;
}

export interface ExplicitGoodsReceipt {
  id: string;
  grNumber: string;
  poId: string;
  poNumber: string;
  receivedDate: string;
  receivedBy: string;
  notes: string;
  warehouseId: string;
  items: {
    itemId: string;
    sku: string;
    name: string;
    quantity: number; // quantity checked in during this specific GR
    lotId?: string;
    lotNumber?: string;
  }[];
}

export interface ExplicitDeliveryReceipt {
  id: string;
  drNumber: string;
  soId: string;
  soNumber: string;
  dispatchDate: string;
  dispatchedBy: string;
  notes: string;
  warehouseId: string;
  items: {
    itemId: string;
    sku: string;
    name: string;
    quantity: number; // quantity dispatched in this specific DR
  }[];
}
