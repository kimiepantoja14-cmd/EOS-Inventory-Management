/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Warehouse, Item, PurchaseOrder, SalesOrder, StockTransfer, InventoryTransaction, Supplier, Customer, UserRecord, StockLot, MachineLog } from './types';

// Philippine tax standard VAT is 12%
export const PH_VAT_RATE = 0.12;

export const INITIAL_USERS: UserRecord[] = [
  {
    id: 'user-01',
    name: 'Kimberly Pantoja (Admin)',
    email: 'kimberly.pantoja@equiprime.ph',
    role: 'Admin',
    status: 'Active',
    password: '1234',
    isApproved: true,
    permissions: {
      canEditItems: true,
      canEditSuppliers: true,
      canEditPurchaseOrders: true,
      canEditSalesOrders: true,
      canManageUsers: true,
      canAdjustStock: true,
      canRevertLifecycle: true,
      canSeePricing: true,
      allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'tracking-hub', 'user-security', 'reports', 'machine-logs']
    }
  },
  {
    id: 'user-02',
    name: 'Maria Santos (Manager)',
    email: 'm.santos@enterprise.ph',
    role: 'Manager',
    status: 'Active',
    password: '1234',
    isApproved: true,
    permissions: {
      canEditItems: true,
      canEditSuppliers: true,
      canEditPurchaseOrders: true,
      canEditSalesOrders: true,
      canManageUsers: false,
      canAdjustStock: true,
      canRevertLifecycle: true,
      canSeePricing: true,
      allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'tracking-hub', 'user-security', 'reports', 'machine-logs']
    }
  },
  {
    id: 'user-03',
    name: 'Juan dela Cruz (Staff)',
    email: 'j.delacruz@enterprise.ph',
    role: 'Staff',
    status: 'Active',
    password: '1234',
    isApproved: true,
    permissions: {
      canEditItems: false,
      canEditSuppliers: false,
      canEditPurchaseOrders: false,
      canEditSalesOrders: false,
      canManageUsers: false,
      canAdjustStock: false,
      canRevertLifecycle: false,
      canSeePricing: false,
      allowedTabs: ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'tracking-hub', 'reports', 'machine-logs']
    }
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-01',
    name: 'SGV & Co. Digital Services',
    email: 'contact@sgv.ph',
    phone: '+63-2-8891-0307',
    address: '6760 Ayala Avenue, Makati City, Metro Manila',
    tin: '102-349-582-000',
    status: 'Active'
  },
  {
    id: 'cust-02',
    name: 'SM Retail Logistics Division',
    email: 'procurement@smretail.ph',
    phone: '+63-2-8831-1000',
    address: 'JW Diokno Boulevard, Pasay City, Metro Manila',
    tin: '004-984-121-000',
    status: 'Active'
  },
  {
    id: 'cust-03',
    name: 'Cebu Pacific Air Corp',
    email: 'cargo@cebupacific.ph',
    phone: '+63-32-342-8888',
    address: 'Mactan-Cebu International Airport, Lapu-Lapu City, Cebu',
    tin: '300-472-841-000',
    status: 'Active'
  },
  {
    id: 'cust-04',
    name: 'Davao Agribusiness Holdings',
    email: 'info@davaoagri.ph',
    phone: '+63-82-221-5555',
    address: 'Damosa Complex, Lanang, Davao City',
    tin: '201-998-314-000',
    status: 'Inactive'
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-01',
    name: 'Apex Electronics Japan',
    currency: 'JPY',
    exchangeRate: 0.3636, // 1 JPY = 0.3636 PHP
    contactPerson: 'Yuki Tanaka',
    email: 'tanaka@apexelectronics.co.jp',
    phone: '+81-3-5555-0192',
    leadTimeDays: 8,
    exchangeRateHistory: [
      { rate: 0.3817, timestamp: '2026-03-10T09:00:00Z', source: 'Manual' },
      { rate: 0.3731, timestamp: '2026-04-15T10:30:00Z', source: 'Auto-Fetched' },
      { rate: 0.3636, timestamp: '2026-05-01T14:45:00Z', source: 'Auto-Fetched' }
    ]
  },
  {
    id: 'sup-02',
    name: 'Paper & Bind Co. Europe',
    currency: 'EUR',
    exchangeRate: 62.5, // 1 EUR = 62.50 PHP
    contactPerson: 'Marco Rossi',
    email: 'm.rossi@paperbind.it',
    phone: '+39-02-555-5678',
    leadTimeDays: 7,
    exchangeRateHistory: [
      { rate: 60.6, timestamp: '2026-03-15T08:00:00Z', source: 'Manual' },
      { rate: 61.35, timestamp: '2026-04-18T11:20:00Z', source: 'Auto-Fetched' },
      { rate: 62.5, timestamp: '2026-05-18T10:12:00Z', source: 'Auto-Fetched' }
    ]
  },
  {
    id: 'sup-03',
    name: 'Standard Apparel US Partner',
    currency: 'USD',
    exchangeRate: 58.82, // 1 USD = 58.82 PHP
    contactPerson: 'Sarah Jenkins',
    email: 's.jenkins@stdapparel.com',
    phone: '+1-555-321-7654',
    leadTimeDays: 5,
    exchangeRateHistory: [
      { rate: 55.56, timestamp: '2026-01-01T00:00:00Z', source: 'Manual' },
      { rate: 58.82, timestamp: '2026-05-19T00:00:00Z', source: 'Auto-Fetched' }
    ]
  },
  {
    id: 'sup-04',
    name: 'Manila Local Stationery Supplier',
    currency: 'PHP',
    exchangeRate: 1.0, // Base PHP
    contactPerson: 'Eliza Santos',
    email: 'eliza@stationerywholesaler.ph',
    phone: '+63-2-8234-5678',
    leadTimeDays: 2,
    exchangeRateHistory: [
      { rate: 1.0, timestamp: '2026-01-01T00:00:00Z', source: 'Manual' }
    ]
  }
];

export const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 'wh-01',
    name: 'Manila Central Logistics Hub',
    code: 'MNL-01',
    location: 'Tondo, Metro Manila',
    contactEmail: 'manila@centralinv.com.ph',
    status: 'Active',
    maxCapacity: 1500
  },
  {
    id: 'wh-02',
    name: 'Metro Cebu Logistics Hub',
    code: 'CEB-02',
    location: 'Mandaue City, Cebu',
    contactEmail: 'cebu@centralinv.com.ph',
    status: 'Active',
    maxCapacity: 800
  },
  {
    id: 'wh-03',
    name: 'Davao Distribution Hub',
    code: 'DVO-03',
    location: 'Lanang, Davao City',
    contactEmail: 'davao@centralinv.com.ph',
    status: 'Active',
    maxCapacity: 1200
  }
];

export const INITIAL_ITEMS: Item[] = [
  {
    id: 'item-1',
    sku: 'EL-MBP14',
    name: 'MacBook Pro 14" M3',
    description: 'Apple MacBook Pro 14-inch with M3 chip, 16GB RAM, 512GB SSD.',
    unit: 'pcs',
    purchasePrice: 178768, // JPY (Approx 65,000 PHP)
    sellingPrice: 94990,
    reorderPoint: 10,
    category: 'Electronics',
    brand: 'Apple',
    applicableUnits: 'IT Dept, Sales Agents, Tech Staff',
    alternatePartNumbers: 'APL-MBP-14M3, MBP14-2024',
    status: 'Active',
    stockByWarehouse: {
      'wh-01': 15,
      'wh-02': 8,
      'wh-03': 4
    },
    supplierId: 'sup-01'
  },
  {
    id: 'item-2',
    sku: 'EL-IPH15',
    name: 'iPhone 15 Pro Max',
    description: 'Titanium grey, 256GB storage, triple-lens pro camera system.',
    unit: 'pcs',
    purchasePrice: 132000, // JPY (Approx 48,000 PHP)
    sellingPrice: 71990,
    reorderPoint: 15,
    category: 'Electronics',
    brand: 'Apple',
    applicableUnits: 'Executive Staff Team, Field Crew',
    alternatePartNumbers: 'APL-IP15PM-256',
    status: 'Active',
    stockByWarehouse: {
      'wh-01': 22,
      'wh-02': 11,
      'wh-03': 3
    },
    supplierId: 'sup-01'
  },
  {
    id: 'item-3',
    sku: 'ST-MND80',
    name: 'Premium Moleskine Journal',
    description: 'A5 dotted notebook, hardcover, 120gsm acid-free paper.',
    unit: 'pcs',
    purchasePrice: 450, // PHP
    sellingPrice: 990,
    reorderPoint: 50,
    category: 'Stationery',
    brand: 'Moleskine',
    applicableUnits: 'Corporate Gifts, Admin Desk Cabinets',
    alternatePartNumbers: 'MSK-JRN-A5D',
    status: 'Active',
    stockByWarehouse: {
      'wh-01': 120,
      'wh-02': 45,
      'wh-03': 60
    },
    supplierId: 'sup-04'
  },
  {
    id: 'item-4',
    sku: 'AP-HOOD02',
    name: 'Minimalist Fleece Hoodie',
    description: 'Enzyme-washed cotton fleece pull-over hoodie, charcoal color.',
    unit: 'pcs',
    purchasePrice: 20.50, // USD (Approx 1200 PHP)
    sellingPrice: 2450,
    reorderPoint: 25,
    category: 'Apparel',
    brand: 'Loom & Thread',
    applicableUnits: 'Staff Swag, Co-working Uniform',
    alternatePartNumbers: 'LMT-HD-MFF',
    status: 'Active',
    stockByWarehouse: {
      'wh-01': 40,
      'wh-02': 12,
      'wh-03': 0
    },
    supplierId: 'sup-03'
  },
  {
    id: 'item-5',
    sku: 'ST-PBL10',
    name: 'Ergonomic Gel Pens (10-pack)',
    description: 'Fine point black gel pens with comfortable rubber grip.',
    unit: 'box',
    purchasePrice: 150, // PHP
    sellingPrice: 395,
    reorderPoint: 30,
    category: 'Stationery',
    brand: 'Pilot',
    applicableUnits: 'All Office Desks, Meeting Rooms',
    alternatePartNumbers: 'PLT-GEL-EXP, EL-993-XP',
    status: 'Active',
    stockByWarehouse: {
      'wh-01': 8,
      'wh-02': 100,
      'wh-03': 15
    },
    supplierId: 'sup-04'
  },
  {
    id: 'item-8',
    sku: 'HE-EXC320',
    name: 'Caterpillar 320 Hydraulic Excavator',
    description: '20-ton hydraulic excavator with high-efficiency Cat C4.4 engine, advanced cabin control, and dynamic scales.',
    unit: 'pcs',
    purchasePrice: 11551155, // JPY (Approx 4.2M PHP)
    sellingPrice: 5800000,
    reorderPoint: 2,
    category: 'Heavy Equipment',
    brand: 'Caterpillar',
    applicableUnits: 'Mine Sites, Construction Sites, Civil Works',
    alternatePartNumbers: 'CAT-320HEX, 320-HYD-01',
    status: 'Active',
    stockByWarehouse: {
      'wh-01': 2,
      'wh-02': 1,
      'wh-03': 0
    },
    supplierId: 'sup-01'
  },
  {
    id: 'item-9',
    sku: 'HE-BUL6D',
    name: 'Komatsu D65EX Bulldozer',
    description: '22-ton powerful dozer with crawler undercarriage, hydrostatic steering system, and SigmaDozer blade.',
    unit: 'pcs',
    purchasePrice: 17876788, // JPY (Approx 6.5M PHP)
    sellingPrice: 8200000,
    reorderPoint: 2,
    category: 'Heavy Equipment',
    brand: 'Komatsu',
    applicableUnits: 'Earthmoving, Site Clearing, Forest Operations',
    alternatePartNumbers: 'KOM-D65EX, D65-Crawler',
    status: 'Active',
    stockByWarehouse: {
      'wh-01': 1,
      'wh-02': 0,
      'wh-03': 0
    },
    supplierId: 'sup-01'
  },
  {
    id: 'item-10',
    sku: 'HE-FORK3T',
    name: 'Toyota 3-Ton Diesel Forklift',
    description: '3000kg load capacity industrial high-reach diesel forklift with SAS safety controls and active mast feature.',
    unit: 'pcs',
    purchasePrice: 2062706, // JPY (Approx 750,000 PHP)
    sellingPrice: 1100000,
    reorderPoint: 4,
    category: 'Heavy Equipment',
    brand: 'Toyota',
    applicableUnits: 'Warehouse Storage, Loading Yards, Material Handling Hubs',
    alternatePartNumbers: 'TOY-FORK-3T, TOY-8F-30',
    status: 'Active',
    stockByWarehouse: {
      'wh-01': 4,
      'wh-02': 2,
      'wh-03': 1
    },
    supplierId: 'sup-01'
  }
];

export const INITIAL_LOTS: StockLot[] = [
  // item-1 MacBook Pro Lots (FIFO queued: oldest received first)
  {
    id: 'lot-101',
    itemId: 'item-1',
    lotNumber: 'MNL-LOT-202604-001',
    warehouseId: 'wh-01',
    quantityReceived: 10,
    quantityRemaining: 5,
    dateReceived: '2026-04-10T08:00:00Z',
    expiryDate: '2028-04-10T00:00:00Z',
    barcodeValue: 'ITM1-MNL-L101-FIFO'
  },
  {
    id: 'lot-102',
    itemId: 'item-1',
    lotNumber: 'MNL-LOT-202605-002',
    warehouseId: 'wh-01',
    quantityReceived: 10,
    quantityRemaining: 10,
    dateReceived: '2026-05-10T14:30:00Z',
    barcodeValue: 'ITM1-MNL-L102-FIFO'
  },
  // item-2 iPhone Lots
  {
    id: 'lot-201',
    itemId: 'item-2',
    lotNumber: 'MNL-LOT-202603-01',
    warehouseId: 'wh-01',
    quantityReceived: 15,
    quantityRemaining: 2,
    dateReceived: '2026-03-12T09:00:00Z',
    barcodeValue: 'ITM2-MNL-L201-FIFO'
  },
  {
    id: 'lot-202',
    itemId: 'item-2',
    lotNumber: 'MNL-LOT-202605-02',
    warehouseId: 'wh-01',
    quantityReceived: 20,
    quantityRemaining: 20,
    dateReceived: '2026-05-10T14:30:00Z',
    barcodeValue: 'ITM2-MNL-L202-FIFO'
  },
  // item-3 Premium Moleskine Lots
  {
    id: 'lot-301',
    itemId: 'item-3',
    lotNumber: 'CEB-LOT-202602-05',
    warehouseId: 'wh-02',
    quantityReceived: 100,
    quantityRemaining: 45,
    dateReceived: '2026-02-18T10:00:00Z',
    barcodeValue: 'ITM3-CEB-L301-FIFO'
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-01',
    poNumber: 'PO-2026-0001',
    vendorName: 'Apex Electronics Japan',
    supplierId: 'sup-01',
    orderDate: '2026-05-01',
    deliveryDate: '2026-05-10',
    actualDeliveryDate: '2026-05-09',
    leadTimeDays: 8,
    status: 'Received',
    warehouseId: 'wh-01',
    items: [
      { itemId: 'item-1', quantity: 20, unitCost: 65000 },
      { itemId: 'item-2', quantity: 30, unitCost: 48005 }
    ],
    subtotal: 2740000,
    tax: 328800, // 12% standard PH VAT
    total: 3068805, 
    currency: 'JPY',
    exchangeRate: 0.3636,
    notes: 'Q2 Initial hardware replacement stock for major logistics hubs.',
    statusHistory: [
      { status: 'Draft', date: '2026-05-01', note: 'Purchase Order created as draft.', user: 'System Admin' },
      { status: 'Issued', date: '2026-05-01', note: 'Purchase Order sent to supplier Apex Electronics Japan.', user: 'System Admin' },
      { status: 'Received', date: '2026-05-09', note: 'Received all items at Central Site (Manila Hub). Checked and verified.', user: 'Warehouse Mgr' }
    ]
  },
  {
    id: 'po-02',
    poNumber: 'PO-2026-0002',
    vendorName: 'Paper & Bind Co. Europe',
    supplierId: 'sup-02',
    orderDate: '2026-05-18',
    deliveryDate: '2026-05-25',
    leadTimeDays: 7,
    status: 'Issued',
    warehouseId: 'wh-03',
    items: [
      { itemId: 'item-3', quantity: 100, unitCost: 450 },
      { itemId: 'item-5', quantity: 150, unitCost: 150 }
    ],
    subtotal: 67500,
    tax: 8100, // 12% PH VAT
    total: 75600,
    currency: 'EUR',
    exchangeRate: 62.5,
    notes: 'Urgent paper & writing accessories backorder sequence.',
    statusHistory: [
      { status: 'Draft', date: '2026-05-18', note: 'Draft purchase order created with standard VAT calculations.', user: 'System Admin' },
      { status: 'Issued', date: '2026-05-18', note: 'Dispatched to supplier Paper & Bind Co. Europe for processing.', user: 'System Admin' }
    ]
  }
];

export const INITIAL_SALES_ORDERS: SalesOrder[] = [
  {
    id: 'so-01',
    soNumber: 'SO-2026-0001',
    customerName: 'SGV & Co. Digital Services',
    customerId: 'cust-01',
    orderDate: '2026-05-12',
    shipmentDate: '2026-05-14',
    status: 'Shipped',
    warehouseId: 'wh-01',
    items: [
      { itemId: 'item-1', quantity: 5, unitPrice: 94990 },
      { itemId: 'item-2', quantity: 8, unitPrice: 71990 }
    ],
    subtotal: 1050870,
    tax: 126104.4, // 12% PH VAT
    total: 1176974.4,
    notes: 'Full dispatch complete. Billed with standard SGV Tax registration records.'
  },
  {
    id: 'so-02',
    soNumber: 'SO-2026-0002',
    customerName: 'SM Retail Logistics Division',
    customerId: 'cust-02',
    orderDate: '2026-05-19',
    shipmentDate: '2026-05-22',
    status: 'Confirmed',
    warehouseId: 'wh-02',
    items: [
      { itemId: 'item-1', quantity: 2, unitPrice: 94990 },
      { itemId: 'item-3', quantity: 10, unitPrice: 990 }
    ],
    subtotal: 199880,
    tax: 23985.6, // 12% PH VAT
    total: 223865.6,
    notes: 'Fragile handling required. Deliver to Pasay Headquarters.'
  }
];

export const INITIAL_TRANSFERS: StockTransfer[] = [
  {
    id: 'tr-01',
    transferNumber: 'TR-2026-0001',
    sourceWarehouseId: 'wh-01',
    destinationWarehouseId: 'wh-02',
    transferDate: '2026-05-15',
    status: 'Completed',
    items: [
      { itemId: 'item-3', quantity: 25 },
      { itemId: 'item-5', quantity: 40 }
    ],
    notes: 'Rebalancing inventory hubs to support region 7 corporate requirements.'
  }
];

export const INITIAL_TRANSACTIONS: InventoryTransaction[] = [
  {
    id: 'tx-01',
    itemId: 'item-1',
    itemName: 'MacBook Pro 14" M3',
    sku: 'EL-MBP14',
    quantity: 20,
    type: 'Purchase',
    referenceNumber: 'PO-2026-0001',
    warehouseId: 'wh-01',
    warehouseName: 'Manila Central Logistics Hub',
    date: '2026-05-10',
    description: 'Inventory received and cataloged from Purchase Order PO-2026-0001'
  },
  {
    id: 'tx-02',
    itemId: 'item-2',
    itemName: 'iPhone 15 Pro Max',
    sku: 'EL-IPH15',
    quantity: 30,
    type: 'Purchase',
    referenceNumber: 'PO-2026-0001',
    warehouseId: 'wh-01',
    warehouseName: 'Manila Central Logistics Hub',
    date: '2026-05-10',
    description: 'Inventory received and cataloged from Purchase Order PO-2026-0001'
  },
  {
    id: 'tx-03',
    itemId: 'item-1',
    itemName: 'MacBook Pro 14" M3',
    sku: 'EL-MBP14',
    quantity: -5,
    type: 'Sales',
    referenceNumber: 'SO-2026-0001',
    warehouseId: 'wh-01',
    warehouseName: 'Manila Central Logistics Hub',
    date: '2026-05-14',
    description: 'Inventory loaded and dispatched for Sales Order SO-2026-0001'
  },
  {
    id: 'tx-04',
    itemId: 'item-2',
    itemName: 'iPhone 15 Pro Max',
    sku: 'EL-IPH15',
    quantity: -8,
    type: 'Sales',
    referenceNumber: 'SO-2026-0001',
    warehouseId: 'wh-01',
    warehouseName: 'Manila Central Logistics Hub',
    date: '2026-05-14',
    description: 'Inventory loaded and dispatched for Sales Order SO-2026-0001'
  },
  {
    id: 'tx-05',
    itemId: 'item-3',
    itemName: 'Premium Moleskine Journal',
    sku: 'ST-MND80',
    quantity: -25,
    type: 'Transfer Out',
    referenceNumber: 'TR-2026-0001',
    warehouseId: 'wh-01',
    warehouseName: 'Manila Central Logistics Hub',
    date: '2026-05-15',
    description: 'Stock transfer issued to Metro Cebu Logistics Hub via TR-2026-0001'
  },
  {
    id: 'tx-06',
    itemId: 'item-3',
    itemName: 'Premium Moleskine Journal',
    sku: 'ST-MND80',
    quantity: 25,
    type: 'Transfer In',
    referenceNumber: 'TR-2026-0001',
    warehouseId: 'wh-02',
    warehouseName: 'Metro Cebu Logistics Hub',
    date: '2026-05-15',
    description: 'Stock transfer received from Manila Central Logistics Hub via TR-2026-0001'
  },
  {
    id: 'tx-07',
    itemId: 'item-5',
    itemName: 'Ergonomic Gel Pens (10-pack)',
    sku: 'ST-PBL10',
    quantity: -40,
    type: 'Transfer Out',
    referenceNumber: 'TR-2026-0001',
    warehouseId: 'wh-01',
    warehouseName: 'Manila Central Logistics Hub',
    date: '2026-05-15',
    description: 'Stock transfer issued to Metro Cebu Logistics Hub via TR-2026-0001'
  },
  {
    id: 'tx-08',
    itemId: 'item-5',
    itemName: 'Ergonomic Gel Pens (10-pack)',
    sku: 'ST-PBL10',
    quantity: 40,
    type: 'Transfer In',
    referenceNumber: 'TR-2026-0001',
    warehouseId: 'wh-02',
    warehouseName: 'Metro Cebu Logistics Hub',
    date: '2026-05-15',
    description: 'Stock transfer received from Manila Central Logistics Hub via TR-2026-0001'
  }
];

export const INITIAL_MACHINE_LOGS: MachineLog[] = [
  {
    id: 'mch-preseed-01',
    serialNumber: 'HE-EXC320-883921',
    model: 'Caterpillar 320 Hydraulic Excavator',
    deliveryDate: '2026-04-12',
    warrantyStart: '2026-04-12',
    warrantyEnd: '2028-04-12',
    customerId: 'cust-1',
    customerName: 'JG Summit Petrochemical',
    salesOrderId: 'so-preseed-01',
    soNumber: 'SO-2026-0001',
    status: 'Deployed',
    warrantyStatus: 'warranty/primecare',
    machineLocation: 'Batangas Petrochemical Complex, Block 4',
    notes: 'Unit deployed at Batangas plant site. Baseline testing completed successfully.'
  },
  {
    id: 'mch-preseed-02',
    serialNumber: 'HE-BUL6D-293817',
    model: 'Komatsu D65EX Bulldozer',
    deliveryDate: '2026-05-02',
    warrantyStart: '2026-05-02',
    warrantyEnd: '2028-05-02',
    customerId: 'cust-2',
    customerName: 'Megawide Construction Corp',
    salesOrderId: 'so-preseed-02',
    soNumber: 'SO-2026-0002',
    status: 'Deployed',
    warrantyStatus: 'non-warranty/primecare',
    machineLocation: 'Cebu Mactan Airport Expansion Project Yard',
    notes: 'Fitted with advanced scraper blades. Customer reports standard load runs.'
  },
  {
    id: 'mch-preseed-03',
    serialNumber: 'HE-FORK3T-904812',
    model: 'Toyota 3-Ton Diesel Forklift',
    deliveryDate: '2026-05-10',
    warrantyStart: '2026-05-10',
    warrantyEnd: '2028-05-10',
    customerId: 'cust-3',
    customerName: 'SM Prime Holdings',
    salesOrderId: 'so-preseed-03',
    soNumber: 'SO-2026-0003',
    status: 'Active Maintenance',
    warrantyStatus: 'non-warranty/non-primecacre',
    machineLocation: 'Pasay Central Depository & Logistics Terminal Floor 2',
    notes: 'Scheduled 50-hour initial fluid filter replacement check.'
  }
];
