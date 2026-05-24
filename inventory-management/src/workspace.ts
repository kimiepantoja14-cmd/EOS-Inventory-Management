/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import type { 
  SalesOrder, 
  PurchaseOrder, 
  InventoryTransaction, 
  Warehouse, 
  Item,
  Supplier,
  MachineLog,
  Customer
} from './types';

// Read Firebase configurations from the provisioned workspace file
import firebaseConfig from '../firebase-applet-config.json';

// Initialize core Firebase App instance
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use Google OAuth Provider with Sheets write scope
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// Memory storage for safety - as requested by SKILL.md
let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Initializes the authentication listener and updates React callbacks.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // Clear tokens if no memory session exists to avoid mismatches
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Initiates the Google login flow. Creates access token on success.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const apiToken = credential?.accessToken;
    
    if (!apiToken) {
      throw new Error('Failed to retrieve Sheets API Access Token from user authorization.');
    }
    
    cachedAccessToken = apiToken;
    return { user: result.user, accessToken: apiToken };
  } catch (error: any) {
    console.error('Core authentication error: ', error);
    if (
      error && 
      (error.code === 'auth/popup-closed-by-user' || 
       String(error).includes('popup-closed-by-user') || 
       String(error).includes('popup_closed_by_user'))
    ) {
      throw new Error(
        "Google Sign-In Pop-up was closed or blocked by your browser.\n\n" +
        "💡 QUICK FIXES:\n" +
        "1. Open this app in a separate browser tab by clicking the 'Open in new tab' ↗ button at the top-right corner of the screen (next to the Share button).\n" +
        "2. Make sure pop-ups and redirects are allowed for this site in your browser's address bar settings."
      );
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieve current active cached access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Disposes active auth session. Clears memory token safety buffer.
 */
export const logoutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// --- DATA SHEETS EXPORTER PIPELINES ---

interface ExportReportDataPayload {
  selectedYear: string;
  selectedMonth: string;
  totalSales: number;
  totalPurchases: number;
  potentialMargin: number;
  avgLeadTime: number;
  taxSummary: {
    totalVatExclusive: number;
    totalVatInclusive: number;
    totalTaxCollected: number;
    vatSalesCount: number;
    exemptSalesCount: number;
  };
  categorySalesSummary: { category: string; amount: number; qty: number }[];
  clustersData: { name: string; totalSales: number; partsSales: number; servicesSales: number; count: number }[];
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  transactions: InventoryTransaction[];
  warehouses: Warehouse[];
  items: Item[];
  suppliers: Supplier[];
}

/**
 * Creates a google spreadsheet containing multiple tabs mapping the dynamic dashboard data.
 * @returns {Promise<string>} spreadsheet link to provide to target click events.
 */
export const exportReportToGoogleSheets = async (
  payload: ExportReportDataPayload
): Promise<string> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Unauthorized active Google Sheets session. Please authenticate first.');
  }

  const {
    selectedYear,
    selectedMonth,
    totalSales,
    totalPurchases,
    potentialMargin,
    avgLeadTime,
    taxSummary,
    categorySalesSummary,
    clustersData,
    salesOrders,
    purchaseOrders,
    transactions,
    warehouses,
    items,
    suppliers
  } = payload;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthLabel = selectedMonth === 'ALL' ? 'All Months' : monthNames[Number(selectedMonth)];
  const yearLabel = selectedYear === 'ALL' ? 'All Years' : `Year ${selectedYear}`;
  const spreadsheetTitle = `BI Inventory & Financials Report (${monthLabel} - ${yearLabel})`;

  // 1. Create Spreadsheet with metadata properties and required worksheets
  const createSpreadsheetResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: spreadsheetTitle
      },
      sheets: [
        { properties: { title: 'KPI Dashboard & Financials', index: 0 } },
        { properties: { title: 'Sales Orders Log', index: 1 } },
        { properties: { title: 'Purchase Orders Log', index: 2 } },
        { properties: { title: 'Inventory Transactions Ledger', index: 3 } }
      ]
    })
  });

  if (!createSpreadsheetResponse.ok) {
    const errorDetails = await createSpreadsheetResponse.text();
    console.error('Spreadsheet instantiation failed:', errorDetails);
    throw new Error(`Failed to instantiate spreadsheet: ${createSpreadsheetResponse.statusText}`);
  }

  const spreadsheetInfo = await createSpreadsheetResponse.json();
  const spreadsheetId = spreadsheetInfo.spreadsheetId;
  const spreadsheetUrl = spreadsheetInfo.spreadsheetUrl;

  // 2. Prepare grid-sheets payload
  
  // Sheet 1: Dashboard Results
  const overviewValues: any[][] = [
    ['BUSINESS INTELLIGENCE & PROCUREMENT KPI OVERVIEW', '', ''],
    ['Generated Timestamp:', new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC', ''],
    ['Active Fiscal Year Filter:', yearLabel, ''],
    ['Active Sourcing Month Filter:', monthLabel, ''],
    [],
    ['CORE FINANCIAL METRICS', 'VALUE (PHP)', 'VOLUME TRACKED'],
    ['Total Sales Revenues Ledger', totalSales, `${salesOrders.length} Sales Bookings`],
    ['Total Procurement Expense', totalPurchases, `${purchaseOrders.length} Supply Shipments`],
    ['Expected Gross Profit Margin', totalSales - totalPurchases, 'Revenues minus Expenses'],
    ['Potential Average Assets Markup', `${potentialMargin.toFixed(1)}%`, 'Markup rate on base inventory price'],
    ['Average Logistics Lead Time', avgLeadTime === 0 ? 'N/A' : `${avgLeadTime.toFixed(1)} Days`, 'Computed from delivered PO cycles'],
    [],
    ['TAX AUDIT & VAT SUMMARY', 'METRIC DATA', 'VALUE'],
    ['Sales Tax Category (Ex-VAT Totals)', 'Sum total sales without VAT applied', taxSummary.totalVatExclusive],
    ['Sales Tax Category (In-VAT Totals)', 'Sum total sales with VAT taxation applied', taxSummary.totalVatInclusive],
    ['Total Estimated VAT Tax Revenue Collected', 'VAT collected in currency value', taxSummary.totalTaxCollected],
    ['Standard VAT Sales Transactions Count', 'Receipts containing VAT', taxSummary.vatSalesCount],
    ['Exempt/Non-VAT Sales Transactions Count', 'Receipts matching Exempt status', taxSummary.exemptSalesCount],
    [],
    ['ITEM CATEGORIES ALLOCATIONS', 'TOTAL REVENUE (PHP)', 'UNITS VOLUME OUTFLOWN'],
  ];

  categorySalesSummary.forEach(c => {
    overviewValues.push([c.category, c.amount, c.qty]);
  });

  overviewValues.push([]);
  overviewValues.push(['REGIONAL SALES CLUSTERS PERFORMANCE', 'TOTAL SALES (PHP)', 'COMPONENTS SALES', 'COMPUTED SERVICE REVENUE', 'RECORD COUNT']);
  
  clustersData.forEach(cl => {
    overviewValues.push([cl.name, cl.totalSales, cl.partsSales, cl.servicesSales, cl.count]);
  });

  // Sheet 2: Sales Orders List
  const salesRows: any[][] = [
    ['Sales Order #', 'Order Date', 'Customer Name', 'Tax System', 'Subtotal (PHP)', 'Total Collected (PHP)', 'Current Lifecycle Status', 'Source Warehouse Depot', 'Regional Cluster Segment', 'Logistics Terms Details']
  ];

  salesOrders.forEach(so => {
    const wh = warehouses.find(w => w.id === so.warehouseId)?.name || 'Central Site';
    salesRows.push([
      so.soNumber,
      so.orderDate,
      so.customerName,
      so.taxType || 'Non-VAT',
      so.subtotal || 0,
      so.total || 0,
      so.status,
      wh,
      so.salesCluster || 'N/A',
      so.notes || ''
    ]);
  });

  // Sheet 3: Purchase Orders List
  const purchaseRows: any[][] = [
    ['Purchase Order #', 'Creation Sourcing Date', 'Expected Delivery Date', 'Actual Check-In Date', 'Vendor Supplier Partner', 'Target Receiving Warehouse', 'Transaction Currency', 'Exchange Value', 'Total Spent (PHP)', 'Current Sourcing StageStatus', 'Contractual Cargo Logistics notes']
  ];

  purchaseOrders.forEach(po => {
    const wh = warehouses.find(w => w.id === po.warehouseId)?.name || 'Central Depot';
    const sup = suppliers.find(s => s.id === po.supplierId);
    const supName = sup ? sup.name : po.vendorName;
    purchaseRows.push([
      po.poNumber,
      po.orderDate,
      po.deliveryDate,
      po.actualDeliveryDate || 'N/A',
      supName,
      wh,
      po.currency || 'USD',
      po.exchangeRate || 1.0,
      po.total || 0,
      po.status,
      po.notes || ''
    ]);
  });

  // Sheet 4: Inventory Transactions Ledger
  const transactionsRows: any[][] = [
    ['Log ID Code', 'Ledger Check-In Date', 'Component Part SKU', 'Component Name', 'Action Sequence Type', 'Volume delta Delta', 'Depot Warehouse Node', 'Audit Description / Sourcing Reference Details']
  ];

  transactions.forEach(t => {
    const pItem = items.find(i => i.id === t.itemId);
    const pName = pItem ? pItem.name : t.itemName;
    transactionsRows.push([
      t.id,
      t.date,
      t.sku,
      pName,
      t.type,
      t.quantity,
      t.warehouseName || 'Warehouse Site',
      t.description || ''
    ]);
  });

  // 3. Dispatch batchUpdate for cells update
  const makeBatchUpdateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'KPI Dashboard & Financials!A1', values: overviewValues },
        { range: 'Sales Orders Log!A1', values: salesRows },
        { range: 'Purchase Orders Log!A1', values: purchaseRows },
        { range: 'Inventory Transactions Ledger!A1', values: transactionsRows }
      ]
    })
  });

  if (!makeBatchUpdateResponse.ok) {
    const errorDetails = await makeBatchUpdateResponse.text();
    console.error('Batch cells population failed:', errorDetails);
    throw new Error(`Failed to populate spreadsheets workspace data: ${makeBatchUpdateResponse.statusText}`);
  }

  return spreadsheetUrl;
};

/**
 * Fetches and parses machinery log spreadsheet rows into MachineLog entries.
 */
export const importMachineLogsFromGoogleSheets = async (
  spreadsheetUrl: string,
  customers: Customer[]
): Promise<MachineLog[]> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Unauthorized active Google Sheets session. Please authenticate first.');
  }

  // Extract Spreadsheet ID
  const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('Could not parse a valid Google Spreadsheet ID from the provided URL.');
  }
  const spreadsheetId = match[1];

  // Extract GID
  const gidMatch = spreadsheetUrl.match(/[?#]gid=([0-9]+)/);
  const targetGid = gidMatch ? parseInt(gidMatch[1], 10) : null;

  // 1. Fetch metadata to determine Sheet Title from Gid
  const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!metaResponse.ok) {
    const errorDetails = await metaResponse.text();
    console.error('Spreadsheet metadata retrieval failed:', errorDetails);
    throw new Error(`Failed to retrieve spreadsheet metadata. Make sure the file exists and you have access: ${metaResponse.statusText}`);
  }

  const metaData = await metaResponse.json();
  const sheets = metaData.sheets || [];
  
  let sheetTitle = '';
  if (targetGid !== null) {
    const matchedSheet = sheets.find((s: any) => s.properties?.sheetId === targetGid);
    if (matchedSheet) {
      sheetTitle = matchedSheet.properties.title;
    }
  }
  
  if (!sheetTitle && sheets.length > 0) {
    sheetTitle = sheets[0].properties?.title || 'Sheet1';
  }

  if (!sheetTitle) {
    throw new Error('No worksheets found inside the target Spreadsheet.');
  }

  // 2. Fetch sheet core values
  const urlRange = encodeURIComponent(sheetTitle);
  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${urlRange}?valueRenderOption=FORMATTED_VALUE`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!valuesResponse.ok) {
    const errorDetails = await valuesResponse.text();
    console.error('Sheet cells retrieval failed:', errorDetails);
    throw new Error(`Failed to fetch sheet values: ${valuesResponse.statusText}`);
  }

  const data = await valuesResponse.json();
  const rows: any[][] = data.values || [];

  if (rows.length < 2) {
    throw new Error('Google Sheet appears to be empty or does not have at least a header and a data row.');
  }

  // 3. Map headers and indices with flexible alias support
  const headers = rows[0].map(h => (h || '').trim().toLowerCase());
  
  const getIdxWithAlts = (keys: string[]) => {
    for (const k of keys) {
      const targetClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headers.findIndex(h => {
        const hClean = h.replace(/[^a-z0-9]/g, '');
        return hClean === targetClean;
      });
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const serialNumberIdx = getIdxWithAlts(['serialNumber', 'serial no', 'serial_no', 'serialno', 'serial number']);
  const modelIdx = getIdxWithAlts(['model']);
  const deliveryDateIdx = getIdxWithAlts(['deliveryDate', 'delivery date', 'delivery_date', 'deliverydate']);
  const warrantyStartIdx = getIdxWithAlts(['warrantyStart', 'warranty start', 'warranty_start', 'warrantystart', 'date start of warranty']);
  const warrantyEndIdx = getIdxWithAlts(['warrantyEnd', 'warranty end', 'warranty_end', 'warrantyend', 'date end of warranty', 'date end warranty']);
  const customerIdIdx = getIdxWithAlts(['customerId', 'customer id', 'customer_id', 'customerid']);
  const customerNameIdx = getIdxWithAlts(['customerName', 'customer name', 'customer_name', 'customername', 'customer']);
  const salesOrderIdIdx = getIdxWithAlts(['salesOrderId', 'sales order id', 'sales_order_id', 'salesorderid']);
  const soNumberIdx = getIdxWithAlts(['soNumber', 'so number', 'so_number', 'sonumber']);
  const statusIdx = getIdxWithAlts(['status']);
  const notesIdx = getIdxWithAlts(['notes', 'note']);
  const descriptionIdx = getIdxWithAlts(['description']);
  const machineLocationIdx = getIdxWithAlts(['machineLocation', 'current location', 'location', 'machine location']);
  const warrantyStatusIdx = getIdxWithAlts(['warrantyStatus', 'warranty status', 'warranty_status', 'warrantystatus']);
  const classificationIdx = getIdxWithAlts(['classification']);
  const idIdx = getIdxWithAlts(['id', 'no', 'no.']);

  // Extra Heavy Machinery fields
  const warrantyPeriodIdx = getIdxWithAlts(['warrantyPeriod', 'warranty period', 'warranty_period', 'warrantyperiod']);
  const unitWarrantyIdx = getIdxWithAlts(['unit warranty', 'unitwarranty', 'unit_warranty']);
  const unitPrimecareIdx = getIdxWithAlts(['unit primecare', 'unitprimecare', 'unit_primecare']);
  const currentSmrIdx = getIdxWithAlts(['current smr', 'currentsmr', 'current_smr', 'smr']);
  const updateDateIdx = getIdxWithAlts(['update date', 'updatedate', 'update_date']);
  const lastPmsAndHourMeterIdx = getIdxWithAlts(['last pms & hour meter', 'last pms and hour meter', 'last pms', 'lastpms', 'last_pms']);
  const regionIdx = getIdxWithAlts(['region']);
  const remarksIdx = getIdxWithAlts(['remarks']);
  const contactPersonIdx = getIdxWithAlts(['contact person', 'contactperson', 'contact_person']);
  const contactNoIdx = getIdxWithAlts(['contact no', 'contactno', 'contact_no', 'contact number']);
  const updatedCustomerContactIdx = getIdxWithAlts(['updated customer contact', 'updatedcustomercontact', 'updated_customer_contact']);

  if (serialNumberIdx === -1 || modelIdx === -1) {
    throw new Error("Google Sheet must contain at least 'serialNumber' (or 'SERIAL NO.') and 'model' columns as headers.");
  }

  const parsedLogs: MachineLog[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  const getDefaultWarrantyEnd = (startStr: string) => {
    const d = new Date(startStr);
    if (isNaN(d.getTime())) return todayStr;
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().split('T')[0];
  };

  const validStatuses = [
    'Operational', 'Breakdown', 'Operational with Problem', 'Other', 
    'Deployed', 'Active Maintenance', 'Warranty Claim', 'Retired'
  ];

  const validWarrStatuses = [
    'warranty/primecare', 'non-warranty/primecare', 
    'non-warranty/non-primecacre', 'warranty/non-primecare'
  ];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawSN = row[serialNumberIdx]?.trim();
    if (!rawSN) continue;

    const rawModel = row[modelIdx]?.trim() || 'Unknown Model';
    const rawId = idIdx !== -1 && row[idIdx]?.trim() ? row[idIdx].trim() : `mch-gs-${Date.now()}-${i}`;

    let rawCustId = customerIdIdx !== -1 ? row[customerIdIdx]?.trim() : '';
    let rawCustName = customerNameIdx !== -1 ? row[customerNameIdx]?.trim() : '';

    if (rawCustId) {
      const match = customers.find(c => c.id === rawCustId);
      if (match) {
        rawCustName = match.name;
      }
    } else if (rawCustName) {
      const match = customers.find(c => c.name.toLowerCase() === rawCustName.toLowerCase());
      if (match) {
        rawCustId = match.id;
        rawCustName = match.name;
      }
    }

    if (!rawCustId && customers.length > 0) {
      rawCustId = customers[0].id;
      rawCustName = customers[0].name;
    }

    const rawDelivery = deliveryDateIdx !== -1 && row[deliveryDateIdx]?.trim() ? row[deliveryDateIdx].trim() : todayStr;
    const rawWarrStart = warrantyStartIdx !== -1 && row[warrantyStartIdx]?.trim() ? row[warrantyStartIdx].trim() : rawDelivery;
    const rawWarrEnd = warrantyEndIdx !== -1 && row[warrantyEndIdx]?.trim() ? row[warrantyEndIdx].trim() : getDefaultWarrantyEnd(rawWarrStart);

    let rawStatus = statusIdx !== -1 ? row[statusIdx]?.trim() : 'Operational';
    if (!validStatuses.includes(rawStatus)) {
      rawStatus = 'Operational';
    }

    let rawClassification = classificationIdx !== -1 ? row[classificationIdx]?.trim() : 'Core Product';
    if (rawClassification !== 'Service Campaign' && rawClassification !== 'Core Product') {
      rawClassification = 'Core Product';
    }

    let rawWarrantyStatus = warrantyStatusIdx !== -1 ? row[warrantyStatusIdx]?.trim() : 'warranty/primecare';
    const matchedWarr = validWarrStatuses.find(ws => ws.toLowerCase() === rawWarrantyStatus.toLowerCase());
    rawWarrantyStatus = matchedWarr || 'warranty/primecare';

    // Parse numeric SMR
    let parsedSmr: number | undefined = undefined;
    if (currentSmrIdx !== -1 && row[currentSmrIdx]) {
      const cleanNum = row[currentSmrIdx].replace(/[^0-9.]/g, '');
      const parsedVal = parseFloat(cleanNum);
      if (!isNaN(parsedVal)) {
        parsedSmr = parsedVal;
      }
    }

    const log: MachineLog = {
      id: rawId,
      serialNumber: rawSN,
      model: rawModel,
      deliveryDate: rawDelivery,
      warrantyStart: rawWarrStart,
      warrantyEnd: rawWarrEnd,
      customerId: rawCustId || '',
      customerName: rawCustName || 'Unknown Customer',
      salesOrderId: salesOrderIdIdx !== -1 ? row[salesOrderIdIdx]?.trim() || '' : '',
      soNumber: soNumberIdx !== -1 ? row[soNumberIdx]?.trim() || 'N/A' : 'N/A',
      status: rawStatus as MachineLog['status'],
      notes: notesIdx !== -1 ? row[notesIdx]?.trim() || '' : '',
      description: descriptionIdx !== -1 ? row[descriptionIdx]?.trim() || '' : '',
      machineLocation: machineLocationIdx !== -1 ? row[machineLocationIdx]?.trim() || '' : '',
      warrantyStatus: rawWarrantyStatus as MachineLog['warrantyStatus'],
      classification: rawClassification as 'Service Campaign' | 'Core Product',
      
      // Extended fields
      warrantyPeriod: warrantyPeriodIdx !== -1 ? row[warrantyPeriodIdx]?.trim() || '' : '',
      unitWarranty: unitWarrantyIdx !== -1 ? row[unitWarrantyIdx]?.trim() || '' : '',
      unitPrimecare: unitPrimecareIdx !== -1 ? row[unitPrimecareIdx]?.trim() || '' : '',
      currentSmr: parsedSmr,
      updateDate: updateDateIdx !== -1 ? row[updateDateIdx]?.trim() || '' : '',
      lastPmsAndHourMeter: lastPmsAndHourMeterIdx !== -1 ? row[lastPmsAndHourMeterIdx]?.trim() || '' : '',
      region: regionIdx !== -1 ? row[regionIdx]?.trim() || '' : '',
      remarks: remarksIdx !== -1 ? row[remarksIdx]?.trim() || '' : '',
      contactPerson: contactPersonIdx !== -1 ? row[contactPersonIdx]?.trim() || '' : '',
      contactNo: contactNoIdx !== -1 ? row[contactNoIdx]?.trim() || '' : '',
      updatedCustomerContact: updatedCustomerContactIdx !== -1 ? row[updatedCustomerContactIdx]?.trim() || '' : ''
    };

    parsedLogs.push(log);
  }

  return parsedLogs;
};
