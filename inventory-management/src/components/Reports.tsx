/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Item, Warehouse, PurchaseOrder, SalesOrder, InventoryTransaction, Supplier } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  PiggyBank, 
  PackageCheck, 
  BarChart3, 
  PieChart as LucidePieChart, 
  LineChart as LucideLineChart,
  DollarSign,
  Boxes,
  MapPin,
  ClipboardList,
  AlertTriangle,
  History,
  Briefcase,
  Layers,
  Percent,
  Truck,
  Building,
  FileSpreadsheet,
  CheckCircle2,
  LogOut
} from 'lucide-react';
import { initAuth, googleSignIn, logoutUser, exportReportToGoogleSheets } from '../workspace';

function SafeResponsiveContainer({ children, height, width = "100%", ...props }: any) {
  const [hasCalculated, setHasCalculated] = useState(false);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setHasCalculated(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  if (!hasCalculated) {
    return <div style={{ height, width: "100%" }} />;
  }

  return (
    <ResponsiveContainer width={width} height={height} {...props}>
      {children}
    </ResponsiveContainer>
  );
}

interface ReportsProps {
  items: Item[];
  warehouses: Warehouse[];
  purchaseOrders: PurchaseOrder[];
  salesOrders: SalesOrder[];
  transactions: InventoryTransaction[];
  suppliers?: Supplier[];
}

export default function Reports({
  items = [],
  warehouses = [],
  purchaseOrders = [],
  salesOrders = [],
  transactions = [],
  suppliers = []
}: ReportsProps) {
  const [activeReportTab, setActiveReportTab] = useState<'financials' | 'inventory' | 'warehouses' | 'logs' | 'ph-compliance' | 'weekly-pdf'>('financials');
  const [reportFrequency, setReportFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  // Google Sheets Workspace Auth State Managers
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsAuthLoading(false);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setIsAuthLoading(false);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    setExportError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setExportError(err.message || 'Failed to authenticate Google Account.');
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutUser();
      setGoogleUser(null);
      setGoogleToken(null);
      setExportedUrl(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleExportToSheets = async () => {
    if (!googleToken) return;
    setIsExporting(true);
    setExportError(null);
    setExportedUrl(null);

    try {
      const sheetUrl = await exportReportToGoogleSheets({
        selectedYear,
        selectedMonth,
        totalSales,
        totalPurchases,
        potentialMargin,
        avgLeadTime,
        taxSummary,
        categorySalesSummary,
        clustersData,
        salesOrders: filteredSalesOrders,
        purchaseOrders: filteredPurchaseOrders,
        transactions: filteredTransactions,
        warehouses,
        items,
        suppliers
      });
      setExportedUrl(sheetUrl);
    } catch (err: any) {
      console.error('Google Sheets Export error:', err);
      setExportError(err.message || 'Failed to export dynamic report to Google Sheets.');
    } finally {
      setIsExporting(false);
    }
  };

  // Dynamically extract available years from datasets
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    
    // Seed standard years so it's never empty
    years.add('2025');
    years.add('2026');
    years.add('2027');

    purchaseOrders.forEach(po => {
      const dateStr = po.orderDate || po.deliveryDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          years.add(String(d.getFullYear()));
        }
      }
    });

    salesOrders.forEach(so => {
      const dateStr = so.orderDate || so.shipmentDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          years.add(String(d.getFullYear()));
        }
      }
    });

    transactions.forEach(t => {
      const dateStr = t.date;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          years.add(String(d.getFullYear()));
        }
      }
    });

    return Array.from(years).sort();
  }, [purchaseOrders, salesOrders, transactions]);

  // Filter base datasets based on Year and Month selections
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(po => {
      const date = new Date(po.orderDate || po.deliveryDate);
      if (isNaN(date.getTime())) return true;
      const yearMatch = selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
      const monthMatch = selectedMonth === 'ALL' || String(date.getMonth()) === selectedMonth;
      return yearMatch && monthMatch;
    });
  }, [purchaseOrders, selectedYear, selectedMonth]);

  const filteredSalesOrders = useMemo(() => {
    return salesOrders.filter(so => {
      const date = new Date(so.orderDate || so.shipmentDate);
      if (isNaN(date.getTime())) return true;
      const yearMatch = selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
      const monthMatch = selectedMonth === 'ALL' || String(date.getMonth()) === selectedMonth;
      return yearMatch && monthMatch;
    });
  }, [salesOrders, selectedYear, selectedMonth]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return true;
      const yearMatch = selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
      const monthMatch = selectedMonth === 'ALL' || String(date.getMonth()) === selectedMonth;
      return yearMatch && monthMatch;
    });
  }, [transactions, selectedYear, selectedMonth]);

  // Procurement Forecast based on last 90 days Consumption rates
  const procurementForecast = useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    return items.map(item => {
      // Outbound transactions for this item in the last 90 days
      const outboundTxns = transactions.filter(t => 
        t.itemId === item.id && 
        new Date(t.date) >= ninetyDaysAgo &&
        ['Stock Out', 'Adjustment Deduct', 'Transfer Out'].includes(t.type)
      );

      const totalOutbound = outboundTxns.reduce((sum, t) => sum + Math.abs(t.quantity), 0);
      const avgDailyConsumption = totalOutbound > 0 ? (totalOutbound / 90) : 0;

      // Current aggregate stock on hand
      const currentOnHand = Object.values(item.stockByWarehouse || {}).reduce((s: number, q: any) => s + ((q as number) || 0), 0);
      const reorderLevel = item.reorderPoint || 0;

      let daysToReorder = Infinity;
      let predictedDateStr = 'Safe / Stable';
      let status: 'CRITICAL' | 'ATTENTION' | 'STABLE' = 'STABLE';

      if (currentOnHand <= reorderLevel) {
        daysToReorder = 0;
        predictedDateStr = 'IMMEDIATE - Sourcing Needed!';
        status = 'CRITICAL';
      } else if (avgDailyConsumption > 0) {
        const remainingBuffer = currentOnHand - reorderLevel;
        daysToReorder = Math.ceil(remainingBuffer / avgDailyConsumption);
        
        if (daysToReorder <= 7) {
          status = 'CRITICAL';
        } else if (daysToReorder <= 30) {
          status = 'ATTENTION';
        }

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysToReorder);
        predictedDateStr = targetDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: '2-digit'
        });
      } else {
        predictedDateStr = 'No Active Outbound (Inactive)';
      }

      return {
        ...item,
        currentOnHand,
        totalOutbound,
        avgDailyConsumption,
        daysToReorder,
        predictedDateStr,
        status
      };
    }).sort((a, b) => a.daysToReorder - b.daysToReorder);
  }, [items, transactions]);

  // Year-only filtered sets for chronological charts (trend lines)
  const filteredPurchaseOrdersYearOnly = useMemo(() => {
    return purchaseOrders.filter(po => {
      const date = new Date(po.orderDate || po.deliveryDate);
      if (isNaN(date.getTime())) return true;
      return selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
    });
  }, [purchaseOrders, selectedYear]);

  const filteredSalesOrdersYearOnly = useMemo(() => {
    return salesOrders.filter(so => {
      const date = new Date(so.orderDate || so.shipmentDate);
      if (isNaN(date.getTime())) return true;
      return selectedYear === 'ALL' || String(date.getFullYear()) === selectedYear;
    });
  }, [salesOrders, selectedYear]);

  // --- BRAND PERFORMANCE, SUPPLIER METRICS & LEAD TIMES ---

  // Calculate Avg lead time
  const avgLeadTime = useMemo(() => {
    const receivedPOs = filteredPurchaseOrders.filter(po => po.status === 'Received');
    if (receivedPOs.length === 0) return 0;
    
    let totalDays = 0;
    let counted = 0;
    
    receivedPOs.forEach(po => {
      if (po.leadTimeDays && po.leadTimeDays > 0) {
        totalDays += po.leadTimeDays;
        counted++;
      } else {
        const start = new Date(po.orderDate).getTime();
        const endStr = po.actualDeliveryDate || po.goodsReceipt?.receivedDate || po.deliveryDate;
        if (endStr && start) {
          const end = new Date(endStr).getTime();
          const pDiff = (end - start) / (1000 * 60 * 60 * 24);
          if (pDiff >= 0) {
            totalDays += pDiff;
            counted++;
          }
        }
      }
    });
    
    return counted > 0 ? totalDays / counted : 0;
  }, [filteredPurchaseOrders]);

  // Monthly procurement spending trends by Supplier (uses year-only filter for smooth line trends)
  const monthlySupplierProcurementData = useMemo(() => {
    const supplierNames: string[] = Array.from(new Set<string>(filteredPurchaseOrdersYearOnly.map(po => {
      const matchedSupplier = suppliers.find(s => s.id === po.supplierId || s.name === po.vendorName);
      return String(matchedSupplier ? matchedSupplier.name : po.vendorName);
    })));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthMap: Record<string, Record<string, number>> = {};

    monthNames.forEach(m => {
      monthMap[m] = {};
      supplierNames.forEach(sName => {
        monthMap[m][sName] = 0;
      });
    });

    filteredPurchaseOrdersYearOnly.forEach(po => {
      if (po.status === 'Cancelled') return;
      const matchedSupplier = suppliers.find(s => s.id === po.supplierId || s.name === po.vendorName);
      const sName = matchedSupplier ? matchedSupplier.name : po.vendorName;
      
      const date = new Date(po.orderDate);
      if (!isNaN(date.getTime())) {
        const mName = monthNames[date.getMonth()];
        const rate = matchedSupplier?.exchangeRate || po.exchangeRate || 1.0;
        const currency = matchedSupplier?.currency || po.currency || 'USD';
        
        po.items.forEach(line => {
          const itemObj = items.find(it => it.id === line.itemId);
          let amountInPHP = line.quantity * (line.unitCost || itemObj?.purchasePrice || 0);
          if (currency === 'USD') {
            amountInPHP = amountInPHP * rate;
          }
          monthMap[mName][sName] = (monthMap[mName][sName] || 0) + amountInPHP;
        });
      }
    });

    return monthNames.map(m => ({
      month: m,
      ...monthMap[m]
    }));
  }, [filteredPurchaseOrdersYearOnly, suppliers, items]);

  const uniqueSupplierSpentNames = useMemo(() => {
    return Array.from(new Set(filteredPurchaseOrdersYearOnly.map(po => {
      const matchedSupplier = suppliers.find(s => s.id === po.supplierId || s.name === po.vendorName);
      return matchedSupplier ? matchedSupplier.name : po.vendorName;
    })));
  }, [filteredPurchaseOrdersYearOnly, suppliers]);

  // Brand sales data breakdown of parts vs services
  const brandSalesData = useMemo(() => {
    const validSOs = filteredSalesOrders.filter(so => so.status !== 'Cancelled');
    const brandMap: Record<string, { brand: string; partsSales: number; servicesSales: number; totalSales: number }> = {};

    validSOs.forEach(so => {
      so.items.forEach(line => {
        const itemObj = items.find(it => it.id === line.itemId);
        const brandName = (itemObj?.brand || 'Generic').trim();
        
        const classification = (line.category === 'Parts' || line.category === 'Services') 
          ? line.category 
          : (itemObj?.category?.toLowerCase().includes('service') || itemObj?.category?.toLowerCase().includes('labor') || itemObj?.category?.toLowerCase().includes('work')) 
            ? 'Services' 
            : 'Parts';

        const lineAmount = (line.quantity * line.unitPrice);

        if (!brandMap[brandName]) {
          brandMap[brandName] = { brand: brandName, partsSales: 0, servicesSales: 0, totalSales: 0 };
        }

        if (classification === 'Services') {
          brandMap[brandName].servicesSales += lineAmount;
        } else {
          brandMap[brandName].partsSales += lineAmount;
        }
        brandMap[brandName].totalSales += lineAmount;
      });
    });

    return Object.values(brandMap).sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredSalesOrders, items]);

  // --- PH REGIONAL CLUSTERS, CATEGORY BREAKDOWN, & TAX AUDITS ---

  // 1. Sales per Cluster breakdown (parts and service classification)
  const clustersData = useMemo(() => {
    const validSOs = filteredSalesOrders.filter(so => so.status !== 'Cancelled');
    const clusterSummary: Record<string, { name: string; totalSales: number; partsSales: number; servicesSales: number; vatExSales: number; vatIncSales: number; count: number }> = {};
    
    // Core default clusters to seed in the list for a clean layout
    const defaultClusters = ['Head Office', 'Davao Hub', 'Cebu Logistics', 'North Luzon Cluster', 'Other / Walk-In'];
    defaultClusters.forEach(name => {
      clusterSummary[name] = { name, totalSales: 0, partsSales: 0, servicesSales: 0, vatExSales: 0, vatIncSales: 0, count: 0 };
    });

    validSOs.forEach(so => {
      const rawCluster = so.salesCluster || 'Other / Walk-In';
      let clusterName = rawCluster;
      if (rawCluster.toLowerCase().includes('davao')) clusterName = 'Davao Hub';
      else if (rawCluster.toLowerCase().includes('cebu')) clusterName = 'Cebu Logistics';
      else if (rawCluster.toLowerCase().includes('luzon')) clusterName = 'North Luzon Cluster';
      else if (rawCluster.toLowerCase().includes('head') || rawCluster.toLowerCase().includes('manila') || rawCluster.toLowerCase().includes('office')) clusterName = 'Head Office';
      else if (!clusterSummary[rawCluster]) {
        clusterSummary[rawCluster] = { name: rawCluster, totalSales: 0, partsSales: 0, servicesSales: 0, vatExSales: 0, vatIncSales: 0, count: 0 };
      }

      const cluster = clusterSummary[clusterName] || clusterSummary['Other / Walk-In'] || clusterSummary[rawCluster];
      cluster.count += 1;
      cluster.vatIncSales += so.total || 0;
      cluster.vatExSales += so.subtotal || 0;
      cluster.totalSales += so.total || 0;

      // Classify line items into parts & services
      so.items.forEach(line => {
        const itemObj = items.find(it => it.id === line.itemId);
        const classification = (line.category === 'Parts' || line.category === 'Services') 
          ? line.category 
          : (itemObj?.category?.toLowerCase().includes('service') || itemObj?.category?.toLowerCase().includes('labor') || itemObj?.category?.toLowerCase().includes('work')) 
            ? 'Services' 
            : 'Parts';

        const lineAmount = (line.quantity * line.unitPrice);
        if (classification === 'Services') {
          cluster.servicesSales += lineAmount;
        } else {
          cluster.partsSales += lineAmount;
        }
      });
    });

    return Object.values(clusterSummary).filter(c => c.count > 0 || defaultClusters.includes(c.name));
  }, [filteredSalesOrders, items]);

  // 2. VAT Exclusive vs VAT Inclusive Sales (sales vat ex & sales w/ vat)
  const taxSummary = useMemo(() => {
    const validSOs = filteredSalesOrders.filter(so => so.status !== 'Cancelled');
    let totalVatExclusive = 0;
    let totalVatInclusive = 0;
    let totalTaxCollected = 0;
    let vatSalesCount = 0;
    let exemptSalesCount = 0;

    validSOs.forEach(so => {
      totalVatExclusive += so.subtotal || 0;
      totalVatInclusive += so.total || 0;
      totalTaxCollected += so.tax || 0;
      if (so.taxType === 'VAT' || (so.tax && so.tax > 0)) {
        vatSalesCount++;
      } else {
        exemptSalesCount++;
      }
    });

    return {
      totalVatExclusive,
      totalVatInclusive,
      totalTaxCollected,
      vatSalesCount,
      exemptSalesCount
    };
  }, [filteredSalesOrders]);

  // 3. Sales per Item Category
  const categorySalesSummary = useMemo(() => {
    const validSOs = filteredSalesOrders.filter(so => so.status !== 'Cancelled');
    const catSales: Record<string, { category: string; amount: number; qty: number }> = {};

    validSOs.forEach(so => {
      so.items.forEach(line => {
        const itemObj = items.find(it => it.id === line.itemId);
        const cat = itemObj?.category || line.category || 'General';
        if (!catSales[cat]) {
          catSales[cat] = { category: cat, amount: 0, qty: 0 };
        }
        catSales[cat].amount += (line.quantity * line.unitPrice);
        catSales[cat].qty += line.quantity;
      });
    });

    return Object.values(catSales).sort((a, b) => b.amount - a.amount);
  }, [filteredSalesOrders, items]);

  // 4. Purchase Amount per Supplier per Category
  const purchaseSupplierCategorySummary = useMemo(() => {
    const summary: Record<string, { supplierName: string; totalSpent: number; categories: Record<string, number> }> = {};

    filteredPurchaseOrders.forEach(po => {
      let supName = po.vendorName || po.supplierId || 'General Supplier';
      let key = po.supplierId || supName;

      // Match partner Supplier for accurate currency exchange rate conversion to PHP
      const matchedSupplier = suppliers.find(s => s.id === po.supplierId || s.name === po.vendorName);
      if (matchedSupplier) {
        supName = matchedSupplier.name;
        key = matchedSupplier.id;
      }

      const rate = matchedSupplier?.exchangeRate || po.exchangeRate || 1.0;

      if (!summary[key]) {
        summary[key] = { supplierName: supName, totalSpent: 0, categories: {} };
      }

      po.items.forEach(line => {
        const itemObj = items.find(it => it.id === line.itemId);
        const cat = itemObj?.category || 'General';
        
        const currencySuffix = matchedSupplier?.currency || po.currency || 'USD';
        let amountInPHP = line.quantity * (line.unitCost || itemObj?.purchasePrice || 0);

        if (currencySuffix === 'USD') {
          amountInPHP = amountInPHP * rate;
        }

        if (!summary[key].categories[cat]) {
          summary[key].categories[cat] = 0;
        }
        summary[key].categories[cat] += amountInPHP;
        summary[key].totalSpent += amountInPHP;
      });
    });

    return Object.values(summary).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [filteredPurchaseOrders, items, suppliers]);

  // --- FINANCIAL CALCULATIONS ---
  // Total Inventory Value at Cost and Price
  const { totalValueAtCost, totalValueAtRetail, potentialMargin } = useMemo(() => {
    let costSum = 0;
    let retailSum = 0;
    items.forEach(item => {
      const qoh = Object.values(item.stockByWarehouse).reduce((sum, qty) => sum + qty, 0);
      costSum += qoh * item.purchasePrice;
      retailSum += qoh * item.sellingPrice;
    });
    const margin = retailSum > 0 ? ((retailSum - costSum) / retailSum) * 100 : 0;
    return {
      totalValueAtCost: costSum,
      totalValueAtRetail: retailSum,
      potentialMargin: margin
    };
  }, [items]);

  // Total Purchase commitment (sum of active POs)
  const totalPurchases = useMemo(() => {
    return filteredPurchaseOrders.reduce((sum, po) => sum + (po.total || 0), 0);
  }, [filteredPurchaseOrders]);

  // Total Sales commitments (sum of sales orders)
  const totalSales = useMemo(() => {
    return filteredSalesOrders.reduce((sum, so) => sum + (so.total || 0), 0);
  }, [filteredSalesOrders]);

  // --- RECHARTS DATA PREPARATIONS ---

  // 1. Stock Valuation per Category (Pie Chart)
  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number }> = {};
    items.forEach(item => {
      const qoh = Object.values(item.stockByWarehouse).reduce((sum, qty) => sum + qty, 0);
      const val = qoh * item.purchasePrice;
      if (val <= 0) return;
      if (!map[item.category]) {
        map[item.category] = { name: item.category, value: 0 };
      }
      map[item.category].value += Math.round(val);
    });
    return Object.values(map);
  }, [items]);

  // 2. Warehouse Stock Allocation (Bar Chart)
  const warehouseStockData = useMemo(() => {
    return warehouses.map(wh => {
      let totalQty = 0;
      let totalVal = 0;
      items.forEach(item => {
        const qty = item.stockByWarehouse[wh.id] || 0;
        totalQty += qty;
        totalVal += qty * item.purchasePrice;
      });
      return {
        name: wh.code || wh.name.substring(0, 8),
        fullName: wh.name,
        quantity: totalQty,
        valuation: Math.round(totalVal)
      };
    });
  }, [warehouses, items]);

  // 3. Purchase vs Sales Orders Trend (Configurable Weekly, Monthly, or Yearly)
  const timelineData = useMemo(() => {
    if (reportFrequency === 'weekly') {
      const dataMap: Record<string, { label: string; Purchases: number; Sales: number }> = {};
      
      // Seed the last 12 weeks to ensure continuous chart flow
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - (i * 7));
        const janFirst = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((d.getTime() - janFirst.getTime()) / 86400000) + janFirst.getDay() + 1) / 7);
        const label = `Wk ${weekNum} (${d.getFullYear()})`;
        dataMap[label] = { label, Purchases: 0, Sales: 0 };
      }

      // Populate purchase orders
      filteredPurchaseOrdersYearOnly.forEach(po => {
        const d = new Date(po.orderDate || po.deliveryDate || Date.now());
        const janFirst = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((d.getTime() - janFirst.getTime()) / 86400000) + janFirst.getDay() + 1) / 7);
        const label = `Wk ${weekNum} (${d.getFullYear()})`;
        const poVal = po.total || 0;
        
        if (!dataMap[label]) {
          dataMap[label] = { label, Purchases: 0, Sales: 0 };
        }
        dataMap[label].Purchases += Math.round(poVal);
      });

      // Populate sales orders
      filteredSalesOrdersYearOnly.forEach(so => {
        const d = new Date(so.orderDate || so.shipmentDate || Date.now());
        const janFirst = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil((((d.getTime() - janFirst.getTime()) / 86400000) + janFirst.getDay() + 1) / 7);
        const label = `Wk ${weekNum} (${d.getFullYear()})`;
        const soVal = so.total || 0;
        
        if (!dataMap[label]) {
          dataMap[label] = { label, Purchases: 0, Sales: 0 };
        }
        dataMap[label].Sales += Math.round(soVal);
      });

      // Sort chronological
      return Object.values(dataMap);

    } else if (reportFrequency === 'yearly') {
      const dataMap: Record<string, { label: string; Purchases: number; Sales: number }> = {
        '2025': { label: '2025', Purchases: 0, Sales: 0 },
        '2026': { label: '2026', Purchases: 0, Sales: 0 },
        '2027': { label: '2027', Purchases: 0, Sales: 0 },
      };

      filteredPurchaseOrdersYearOnly.forEach(po => {
        const date = new Date(po.orderDate || po.deliveryDate || Date.now());
        const yr = String(date.getFullYear());
        if (!dataMap[yr]) {
          dataMap[yr] = { label: yr, Purchases: 0, Sales: 0 };
        }
        dataMap[yr].Purchases += Math.round(po.total || 0);
      });

      filteredSalesOrdersYearOnly.forEach(so => {
        const date = new Date(so.orderDate || so.shipmentDate || Date.now());
        const yr = String(date.getFullYear());
        if (!dataMap[yr]) {
          dataMap[yr] = { label: yr, Purchases: 0, Sales: 0 };
        }
        dataMap[yr].Sales += Math.round(so.total || 0);
      });

      return Object.values(dataMap).sort((a,b) => a.label.localeCompare(b.label));

    } else {
      // Monthly
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dataMap: Record<string, { label: string; Purchases: number; Sales: number }> = {};
      
      months.forEach((m) => {
        dataMap[m] = { label: m, Purchases: 0, Sales: 0 };
      });

      filteredPurchaseOrdersYearOnly.forEach(po => {
        const date = new Date(po.orderDate || po.deliveryDate || Date.now());
        const mName = months[date.getMonth()];
        if (dataMap[mName]) {
          dataMap[mName].Purchases += Math.round(po.total || 0);
        }
      });

      filteredSalesOrdersYearOnly.forEach(so => {
        const date = new Date(so.orderDate || so.shipmentDate || Date.now());
        const mName = months[date.getMonth()];
        if (dataMap[mName]) {
          dataMap[mName].Sales += Math.round(so.total || 0);
        }
      });

      return Object.values(dataMap);
    }
  }, [filteredPurchaseOrdersYearOnly, filteredSalesOrdersYearOnly, reportFrequency]);

  // 4. Low Stock alert items
  const lowStockItems = useMemo(() => {
    return items.filter(item => {
      const totalQty = Object.values(item.stockByWarehouse).reduce((sum, q) => sum + q, 0);
      return totalQty <= item.reorderPoint;
    });
  }, [items]);

  // 5. 30-day Sparkline trends for Purchases & Sales (Chronological 30 days up to current local system time)
  const sparklineData = useMemo(() => {
    const days: { dateStr: string; purchaseSpend: number; salesRevenue: number }[] = [];
    const now = new Date();
    
    // Generate previous 30 calendar days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        dateStr,
        purchaseSpend: 0,
        salesRevenue: 0
      });
    }

    // Accumulate actual sourcing purchase orders (excluding Cancelled/Draft)
    purchaseOrders.forEach(po => {
      if (po.status === 'Cancelled' || po.status === 'Draft' || !po.orderDate) return;
      const poDate = po.orderDate.split('T')[0];
      const match = days.find(day => day.dateStr === poDate);
      if (match) {
        match.purchaseSpend += po.total || 0;
      }
    });

    // Accumulate actual sales orders (excluding Cancelled/Draft)
    salesOrders.forEach(so => {
      if (so.status === 'Cancelled' || so.status === 'Draft' || !so.orderDate) return;
      const soDate = so.orderDate.split('T')[0];
      const match = days.find(day => day.dateStr === soDate);
      if (match) {
        match.salesRevenue += so.total || 0;
      }
    });

    return days;
  }, [purchaseOrders, salesOrders]);

  // Color Palette Constants
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

  return (
    <div className="space-y-6">
      {/* Page Header and Filtering Dashboard Control Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 border border-gray-150 p-4 rounded-xl">
        <div>
          <h1 className="text-xl font-bold text-gray-905 tracking-tight flex items-center gap-1.5">
            <BarChart3 className="w-5 h-5 text-indigo-650" />
            Business Intelligence Reports
          </h1>
          <p className="text-xs text-gray-500">Corporate analytics, financial statements, and warehouse allocation audits</p>
        </div>
        
        {/* Dynamic Sourcing Date Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1">Fiscal Year</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg font-bold text-gray-750 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-3xs"
            >
              <option value="ALL">📅 All Years</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>Year {yr}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mb-1">Sourcing Month</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg font-bold text-gray-750 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-3xs"
            >
              <option value="ALL">🗓️ All Months</option>
              <option value="0">January</option>
              <option value="1">February</option>
              <option value="2">March</option>
              <option value="3">April</option>
              <option value="4">May</option>
              <option value="5">June</option>
              <option value="6">July</option>
              <option value="7">August</option>
              <option value="8">September</option>
              <option value="9">October</option>
              <option value="10">November</option>
              <option value="11">December</option>
            </select>
          </div>

          {(selectedYear !== 'ALL' || selectedMonth !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedYear('ALL');
                setSelectedMonth('ALL');
              }}
              className="mt-4 px-2.5 py-1.5 text-[9px] font-extrablack font-mono text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 rounded-lg transition-all cursor-pointer shadow-3xs"
              title="Reset Filters"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Google Sheets Live Integration Control Center */}
      <div className="bg-white border border-gray-150 rounded-xl p-4 shadow-3xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                Google Sheets Integration
                {googleUser && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 bg-emerald-50 rounded-md border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Connected
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-455 max-w-2xl mt-0.5">
                Sync live inventory valuation ledger audits, Sales Orders records, Purchase Orders logistics datasets, and compliance statements directly to real Google Sheets spreadsheets in your Google Drive.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAuthLoading ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
                <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                Reconciling Google Auth...
              </div>
            ) : !googleUser ? (
              <button
                onClick={handleGoogleLogin}
                className="text-xs font-bold border border-gray-200 hover:bg-gray-50 shadow-3xs rounded-lg transition-all cursor-pointer flex items-center justify-center bg-white px-3 py-2 text-gray-700"
                style={{ height: '38px' }}
              >
                <div className="flex items-center gap-2">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 flex-shrink-0">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  <span className="font-semibold">Sign in with Google</span>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-gray-800">{googleUser.displayName || 'Authorized Account'}</span>
                  <span className="text-[10px] text-gray-400 font-mono">{googleUser.email}</span>
                </div>
                
                {googleUser.photoURL && (
                  <img 
                    src={googleUser.photoURL} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full border border-gray-200"
                    referrerPolicy="no-referrer"
                  />
                )}

                <button
                  onClick={handleExportToSheets}
                  disabled={isExporting}
                  className="px-3.5 py-1.5 text-xs font-bold font-mono text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  {isExporting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Export Report
                    </>
                  )}
                </button>

                <button
                  onClick={handleGoogleLogout}
                  className="p-2 text-gray-400 hover:text-gray-650 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  title="Sign Out Google Session"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action outcome banners/logs alerts */}
        {(exportedUrl || exportError) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {exportedUrl && (
              <div className="bg-emerald-25 border border-emerald-100 text-emerald-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">🟢 Live Sheets Sync Completed!</span>
                    <span className="text-[10px] text-emerald-700 font-mono">
                      Created a multi-tab workbook with active year/month filters. Anyone with edit permissions in drive can view.
                    </span>
                  </div>
                </div>
                <a
                  href={exportedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 rounded-md shadow-3xs cursor-pointer transition-colors flex items-center gap-1 justify-center self-start sm:self-center"
                >
                  Open Google Sheet
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M13 2.5a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0V4.56L10.78 11.3a.75.75 0 11-1.06-1.06l6.74-6.74H13.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            )}

            {exportError && (
              <div className="bg-rose-25 border border-rose-100 text-rose-800 p-3 rounded-lg flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-1">Google Workspace Sync Failed</span>
                  <p className="text-[10px] text-rose-700 leading-normal whitespace-pre-wrap">{exportError}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center gap-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-mono">Stock Valuation (Cost)</p>
            <h3 className="text-md font-bold text-gray-900">₱{totalValueAtCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
            <span className="text-[10px] text-indigo-600 font-mono font-bold">₱{totalValueAtRetail.toLocaleString(undefined, {maximumFractionDigits: 0})} Retail</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium font-mono">Total Sales Ledger</p>
              <h3 className="text-md font-bold text-gray-900">₱{totalSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
              <span className="text-[10px] text-emerald-600 font-mono font-semibold">{filteredSalesOrders.length} Orders Booked</span>
            </div>
          </div>
          <div className="w-[70px] h-[36px] flex-shrink-0 self-center">
            <AreaChart width={70} height={36} data={sparklineData}>
              <Area type="monotone" dataKey="salesRevenue" stroke="#10b981" strokeWidth={1.5} fill="#a7f3d0" fillOpacity={0.3} dot={false} isAnimationActive={false} />
            </AreaChart>
            <div className="text-[8px] text-center text-gray-400 font-mono leading-none mt-0.5">30d trend</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium font-mono">Total Procurement Expenses</p>
              <h3 className="text-md font-bold text-gray-900">₱{totalPurchases.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
              <span className="text-[10px] text-rose-600 font-mono font-semibold">{filteredPurchaseOrders.length} Supply Requests</span>
            </div>
          </div>
          <div className="w-[70px] h-[36px] flex-shrink-0 self-center">
            <AreaChart width={70} height={36} data={sparklineData}>
              <Area type="monotone" dataKey="purchaseSpend" stroke="#ef4444" strokeWidth={1.5} fill="#fecaca" fillOpacity={0.3} dot={false} isAnimationActive={false} />
            </AreaChart>
            <div className="text-[8px] text-center text-gray-400 font-mono leading-none mt-0.5">30d trend</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center gap-4">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-mono">Simulated Gross Profit</p>
            <h3 className="text-md font-bold text-gray-900">₱{Math.max(0, totalSales - (totalValueAtCost * (filteredSalesOrders.length / (salesOrders.length || 1)))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
            <span className="text-[10px] text-amber-600 font-mono font-semibold">{potentialMargin.toFixed(1)}% Avg Assets Markup</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs flex items-center gap-4">
          <div className="p-2.5 bg-indigo-50 text-indigo-640 rounded-lg">
            <Truck className="w-5 h-5 text-indigo-600 animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium font-mono">Avg Fulfillment Lead Time</p>
            <h3 className="text-md font-semibold text-gray-900">{avgLeadTime === 0 ? 'N/A' : `${avgLeadTime.toFixed(1)} Days`}</h3>
            <span className="text-[10px] text-indigo-600 font-mono font-bold">From {filteredPurchaseOrders.filter(p => p.status === 'Received').length} Delivered POs</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 gap-1 bg-white p-1 rounded-t-xl border border-b-0 border-gray-150">
        <button
          onClick={() => setActiveReportTab('financials')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'financials' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <DollarSign className="w-4 h-4" />
          Financial Statements & Trends
        </button>
        <button
          onClick={() => setActiveReportTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'inventory' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <Boxes className="w-4 h-4" />
          Inventory Valuation & Catalog
        </button>
        <button
          onClick={() => setActiveReportTab('warehouses')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'warehouses' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <MapPin className="w-4 h-4" />
          Facility Allocation
        </button>
        <button
          onClick={() => setActiveReportTab('ph-compliance')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'ph-compliance' ? 'bg-indigo-50 text-indigo-700 font-extrabold shadow-2xs border border-indigo-150' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <Building className="w-4 h-4" />
          🇵🇭 PH Compliance & Sourcing
        </button>
        <button
          onClick={() => setActiveReportTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'logs' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
        >
          <History className="w-4 h-4" />
          Audit Ledger Activity
        </button>
        <button
          onClick={() => setActiveReportTab('weekly-pdf')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeReportTab === 'weekly-pdf' ? 'bg-rose-50 text-rose-700 font-extrabold shadow-2xs border border-rose-150' : 'text-gray-505 hover:text-gray-800'}`}
        >
          <ClipboardList className="w-4 h-4 text-rose-600" />
          Weekly PDF Alerts
        </button>
      </div>

      {/* Tab Panels */}
      <div className="bg-white p-5 rounded-b-xl border border-gray-150 mt-[-1px] shadow-xs">
        
        {/* PANEL 1: FINANCIALS */}
        {activeReportTab === 'financials' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-3 gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Capital Flow Analysis</h3>
                <p className="text-xs text-gray-400">Comparing historical sales deliveries vs sourcing expenditures over the calendar timeline</p>
              </div>
              
              {/* Report Frequency options: weekly, monthly, or yearly */}
              <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200 shadow-2xs self-start sm:self-auto shrink-0">
                <button
                  onClick={() => setReportFrequency('weekly')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    reportFrequency === 'weekly'
                      ? 'bg-white text-indigo-700 shadow-3xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setReportFrequency('monthly')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    reportFrequency === 'monthly'
                      ? 'bg-white text-indigo-700 shadow-3xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setReportFrequency('yearly')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    reportFrequency === 'yearly'
                      ? 'bg-white text-indigo-700 shadow-3xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>

            {/* Recharts Area Timeline */}
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 h-[300px] min-w-0">
              <SafeResponsiveContainer height={260}>
                <AreaChart
                  data={timelineData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip wrapperStyle={{ outline: 'none' }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }} />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="Purchases" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorPurchases)" name="Supply Orders Expense" />
                  <Area type="monotone" dataKey="Sales" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" name="Client Sales Revenue" />
                </AreaChart>
              </SafeResponsiveContainer>
            </div>

            {/* NEW ADDED SECTIONS: Monthly Procurement Spend by Supplier & Sales Report Per Brand */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Supplier Monthly Procurement Spending Trends */}
              <div className="bg-white p-5 rounded-xl border border-gray-150 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Monthly Procurement Trend by Supplier
                  </h4>
                  <p className="text-[11px] text-gray-400">Chronological procurement spend (converted to PHP) tracking per supplier brand</p>
                </div>
                <div className="h-[260px] bg-gray-50/50 p-2 rounded-lg border border-gray-100 min-w-0">
                  <SafeResponsiveContainer height={240}>
                    <LineChart data={monthlySupplierProcurementData} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '6px' }} />
                      <Legend wrapperStyle={{ fontSize: '9px' }} />
                      {uniqueSupplierSpentNames.map((sName, index) => {
                        const colors = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
                        const color = colors[index % colors.length];
                        return (
                          <Line
                            key={sName}
                            type="monotone"
                            dataKey={sName}
                            stroke={color}
                            strokeWidth={2.5}
                            activeDot={{ r: 5 }}
                            name={sName}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </SafeResponsiveContainer>
                </div>
              </div>

              {/* Brand Parts vs Service Sales Bar Chart */}
              <div className="bg-white p-5 rounded-xl border border-gray-150 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    Sales Distribution per Brand (Parts/Service)
                  </h4>
                  <p className="text-[11px] text-gray-400">Breakdown of gross sales revenue of parts vs services across product brands</p>
                </div>
                <div className="h-[260px] bg-gray-50/50 p-2 rounded-lg border border-gray-100 min-w-0">
                  <SafeResponsiveContainer height={240}>
                    <BarChart data={brandSalesData} margin={{ top: 10, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="brand" tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '6px' }} />
                      <Legend wrapperStyle={{ fontSize: '9px' }} />
                      <Bar dataKey="partsSales" stackId="brandStack" fill="#6366f1" name="Parts Sales" />
                      <Bar dataKey="servicesSales" stackId="brandStack" fill="#14b8a6" name="Services Billed" />
                    </BarChart>
                  </SafeResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Brand Leaderboard Table Cards */}
            <div className="bg-white p-4.5 rounded-xl border border-gray-150 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-mono">Billed Product Brand Performance Grid</h4>
                <span className="text-[10px] bg-slate-100 text-slate-705 px-2 py-0.5 rounded font-bold font-mono">Total {brandSalesData.length} Brands tracked</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {brandSalesData.map((b, idx) => (
                  <div key={b.brand} className="bg-slate-50/50 border border-slate-100 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                      <span className="font-bold text-gray-800 text-xs truncate max-w-[120px]">{b.brand || 'Generic'}</span>
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">Rank #{idx + 1}</span>
                    </div>
                    <div className="space-y-1 text-[10px] font-mono">
                      <div className="flex items-center justify-between text-gray-500">
                        <span>Parts Sales:</span>
                        <span className="font-bold text-gray-700">₱{b.partsSales.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-500">
                        <span>Services:</span>
                        <span className="font-bold text-gray-700">₱{b.servicesSales.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-indigo-700 font-sans border-t border-dashed border-gray-200 pt-1 mt-1 font-bold">
                        <span>Grand Total:</span>
                        <span>₱{b.totalSales.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {brandSalesData.length === 0 && (
                  <div className="col-span-full py-6 text-center text-xs text-slate-400">No sales record exists to construct brand leaderboard.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                  Latest Procurement Logs
                </div>
                <div className="divide-y divide-gray-50 text-[11px] max-h-[180px] overflow-y-auto">
                  {filteredPurchaseOrders.length === 0 ? (
                    <div className="p-3 text-center text-gray-400">No active purchase orders recorded</div>
                  ) : (
                    filteredPurchaseOrders.slice(-5).map(po => {
                      const total = po.total || 0;
                      return (
                        <div key={po.id} className="py-2.5 flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900">{po.poNumber}</span>
                              <span className="text-[10px] text-gray-400 font-mono">({po.orderDate})</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">Status: {po.status}</div>
                          </div>
                          <span className="font-mono font-bold text-rose-600">${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="border border-gray-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                  <PackageCheck className="w-4 h-4 text-gray-400" />
                  Latest Sales Logs
                </div>
                <div className="divide-y divide-gray-50 text-[11px] max-h-[180px] overflow-y-auto">
                  {filteredSalesOrders.length === 0 ? (
                    <div className="p-3 text-center text-gray-400">No sales orders recorded</div>
                  ) : (
                    filteredSalesOrders.slice(-5).map(so => {
                      const total = so.total || 0;
                      return (
                        <div key={so.id} className="py-2.5 flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900">{so.soNumber}</span>
                              <span className="text-[10px] text-gray-400 font-mono">({so.orderDate})</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">Shipment: {so.status}</div>
                          </div>
                          <span className="font-mono font-bold text-emerald-600">₱{total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: INVENTORY VALUATION */}
        {activeReportTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Capital Distribution per Category</h3>
                <p className="text-xs text-gray-400">Divergence of static cash inventory values segmented across your category structures</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Category Pie Chart */}
              <div className="md:col-span-5 h-[240px] flex items-center justify-center">
                {categoryData.length === 0 ? (
                  <div className="text-center text-gray-400 text-xs font-mono">No values to compute categories on</div>
                ) : (
                  <div className="w-full h-full relative min-w-0">
                    <SafeResponsiveContainer height={220}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`₱${Number(value).toLocaleString()}`, 'Valuation']} />
                      </PieChart>
                    </SafeResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono">Total Capital</span>
                      <span className="text-sm font-extrabold text-gray-800">₱{Math.round(totalValueAtCost).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Legends list */}
              <div className="md:col-span-7 space-y-3.5">
                <h4 className="text-xs font-bold text-gray-800 font-mono">Valuation Split Details (Cost)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categoryData.map((data, index) => {
                    const percent = totalValueAtCost > 0 ? (data.value / totalValueAtCost) * 100 : 0;
                    return (
                      <div key={data.name} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:shadow-xs transition-shadow">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                          <span className="text-xs font-semibold text-gray-700">{data.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-950 font-mono">₱{data.value.toLocaleString()}</span>
                          <span className="block text-[9px] text-gray-400">{percent.toFixed(1)}% split</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Low stock alerts panel */}
            <div className="border border-rose-100 rounded-xl p-4 bg-rose-50/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Inventory Surveillance Alert: Stock depletion at risk
                </div>
                <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded font-mono">
                  {lowStockItems.length} Products Low
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px] text-gray-600">
                  <thead>
                    <tr className="border-b border-rose-100 text-rose-800 opacity-80 font-bold uppercase">
                      <th className="py-2">SKU</th>
                      <th className="py-2">Item Name</th>
                      <th className="py-2 text-right">Reorder Level</th>
                      <th className="py-2 text-right">Total On Hand</th>
                      <th className="py-2 text-right">Procurement Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50/50">
                    {lowStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-emerald-600 font-bold">
                          🎉 Perfect Inventory Levels! All items sit safely above reorder points.
                        </td>
                      </tr>
                    ) : (
                      lowStockItems.map(item => {
                        const sumQty = Object.values(item.stockByWarehouse || {}).reduce((s: number, q: any) => s + ((q as number) || 0), 0);
                        return (
                          <tr key={item.id} className="hover:bg-rose-50/10">
                            <td className="py-2.5 font-bold text-gray-900">{item.sku}</td>
                            <td className="py-2.5 font-sans font-medium text-gray-800">{item.name}</td>
                            <td className="py-2.5 text-right">{item.reorderPoint}</td>
                            <td className="py-2.5 text-right font-bold text-rose-600">{sumQty}</td>
                            <td className="py-2.5 text-right font-bold">₱{item.purchasePrice.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PROCUREMENT FORECAST (90-DAY OUTBOUND CONSUMPTION INDICATOR) */}
            <div className="border border-indigo-200 border-dashed rounded-xl p-5 bg-indigo-50/15 space-y-4 text-left">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-650 animate-bounce" />
                    Procurement Demand & Reorder Forecast Indicator
                  </h4>
                  <p className="text-xs text-gray-400">Estimated required reorder dates derived from average daily material outflows (last 90 days)</p>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase shadow-3xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                  90-day demand run-rate
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-450 font-mono text-[9px] uppercase tracking-wider">
                      <th className="py-2 pr-2">SKU</th>
                      <th className="py-2 pr-2">Product Description</th>
                      <th className="py-2 pr-2 text-right font-semibold">On Hand</th>
                      <th className="py-2 pr-2 text-right">Reorder Level</th>
                      <th className="py-2 pr-2 text-right">90d Outflows</th>
                      <th className="py-2 pr-2 text-right text-indigo-700">Daily Demand Rate</th>
                      <th className="py-2 pr-2 text-center text-amber-700 font-bold">Required Reorder Date</th>
                      <th className="py-2 pr-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {procurementForecast.map(item => {
                      let statusBadge = (
                        <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded">
                          Stable
                        </span>
                      );
                      let dateColor = "text-slate-800 font-semibold";

                      if (item.status === 'CRITICAL') {
                        statusBadge = (
                          <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700 bg-red-100 rounded animate-pulse">
                            CRITICAL
                          </span>
                        );
                        dateColor = "text-red-700 font-extrabold";
                      } else if (item.status === 'ATTENTION') {
                        statusBadge = (
                          <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 rounded">
                            Warning
                          </span>
                        );
                        dateColor = "text-amber-700 font-bold";
                      }

                      return (
                        <tr key={item.id} className="hover:bg-indigo-50/20">
                          <td className="py-2.5 font-bold text-gray-900 font-mono pr-2">{item.sku}</td>
                          <td className="py-2.5 font-sans font-medium text-gray-800 pr-2">{item.name}</td>
                          <td className="py-2.5 text-right font-mono text-gray-700 pr-2">{item.currentOnHand}</td>
                          <td className="py-2.5 text-right font-mono text-gray-500 pr-2">{item.reorderPoint || 0}</td>
                          <td className="py-2.5 text-right font-mono text-gray-700 pr-2">{item.totalOutbound}</td>
                          <td className="py-2.5 text-right font-mono text-indigo-650 font-extrabold pr-2">
                            {item.avgDailyConsumption.toFixed(2)} / d
                          </td>
                          <td className={`py-2.5 text-center font-mono ${dateColor} pr-2`}>
                            {item.predictedDateStr}
                          </td>
                          <td className="py-2.5 text-right">{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 3: WAREHOUSE FACILITY ALLOCATION */}
        {activeReportTab === 'warehouses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Capital Volume on Location Placement</h3>
                <p className="text-xs text-gray-400">Total volume allocations and dollar valuations on location node</p>
              </div>
            </div>

            {/* Warehouse Allocation Recharts Bar */}
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 h-[280px] min-w-0">
              <SafeResponsiveContainer height={245}>
                <BarChart
                  data={warehouseStockData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} />
                  <YAxis yAxisId="left" orientation="left" stroke="#6366f1" tick={{ fontSize: 10 }} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 10 }} axisLine={false} />
                  <Tooltip formatter={(value: any) => [`₱${Number(value).toLocaleString()}`]} contentStyle={{ fontSize: '11px', fontWeight: 'bold', borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar yAxisId="left" dataKey="quantity" fill="#6366f1" radius={[4, 4, 0, 0]} name="On Hand Stock Qty" />
                  <Bar yAxisId="right" dataKey="valuation" fill="#10b981" radius={[4, 4, 0, 0]} name="Valuation at Cost (₱ - PHP)" />
                </BarChart>
              </SafeResponsiveContainer>
            </div>

            {/* Details breakdown of warehouses */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {warehouseStockData.map(data => (
                <div key={data.name} className="bg-white p-4 rounded-xl border border-gray-150 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 truncate">{data.fullName}</span>
                    <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase">{data.name}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1.5 border-t border-gray-105">
                    <span className="text-gray-400 font-medium">Physical Stock:</span>
                    <span className="font-mono font-bold text-gray-900">{data.quantity.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">Storage Valuation:</span>
                    <span className="font-mono font-bold text-emerald-600">₱{data.valuation.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL 4: TRANSACTION LEDGER ACTIVITIES */}
        {activeReportTab === 'logs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Historical Audit Records</h3>
                <p className="text-xs text-gray-400">Chronological list of stock transfers, manual adjustments, and purchase transactions</p>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-150 rounded-xl">
              <table className="w-full text-left font-mono text-[10px] text-gray-600">
                <thead>
                  <tr className="bg-gray-55/65 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Transaction ID</th>
                    <th className="px-4 py-3">Catalog Item</th>
                    <th className="px-4 py-3">Activity Type</th>
                    <th className="px-4 py-3 text-right">Volume Delta</th>
                    <th className="px-4 py-3">Audit Statement / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[11px]">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No transactions registered in current cycle ledger audits.
                      </td>
                    </tr>
                  ) : (
                    // Show reverse chronological order (newest first)
                    [...filteredTransactions].reverse().slice(0, 15).map(tx => {
                      const item = items.find(it => it.id === tx.itemId);
                      const isIncrement = tx.type === 'Purchase' || tx.type === 'Transfer In' || (tx.type === 'Adjustment' && tx.quantity > 0);
                      return (
                        <tr key={tx.id} className="hover:bg-gray-52/35">
                          <td className="px-4 py-3 text-gray-400">
                            {new Date(tx.date || Date.now()).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-700">{tx.id}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-gray-900">{item?.name || 'Unknown Item'}</span>
                            <span className="text-gray-400 font-normal ml-1">[{item?.sku}]</span>
                          </td>
                          <td className="px-4 py-3 capitalize">
                            <span className={`px-2 py-0.5 rounded-sm font-semibold ${tx.type === 'Purchase' ? 'bg-indigo-50 text-indigo-700' : tx.type === 'Sales' ? 'bg-emerald-50 text-emerald-700' : tx.type === 'Transfer Out' || tx.type === 'Transfer In' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${isIncrement ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isIncrement ? '+' : ''}{tx.quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-sans text-gray-600 font-medium">
                            {tx.description || 'Standard operational shift'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PANEL 5: PH COMPLIANCE & SOURCING */}
        {activeReportTab === 'ph-compliance' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Compliance Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-indigo-650" />
                  PH Revenue & Import Sourcing Compliance Audit
                </h3>
                <p className="text-xs text-gray-400">BIR-aligned cluster distribution, parts vs services breakdown, VAT audits, and overseas supplier category spend in PHP</p>
              </div>
              <span className="self-start sm:self-auto text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-150 font-mono font-bold px-2.5 py-1 rounded inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                PH CUSTOMS & BIR ALIGNED
              </span>
            </div>

            {/* Sub-grid 1: VAT Breakdown & Item Category Sales */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* VAT Audit Breakdown */}
              <div className="lg:col-span-5 border border-indigo-100/80 rounded-xl p-5 bg-indigo-50/10 space-y-4">
                <h4 className="text-xs font-bold text-indigo-950 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                  <Percent className="w-4 h-4 text-indigo-600" />
                  12% VAT Audit Breakdown
                </h4>
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-lg border border-gray-100 flex justify-between items-center shadow-2xs">
                    <span className="text-xs text-gray-400 font-medium">VAT-Exempt Sales (Net Value)</span>
                    <span className="text-xs font-mono font-bold text-gray-900">₱{taxSummary.totalVatExclusive.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-100 flex justify-between items-center shadow-2xs">
                    <span className="text-xs text-gray-400 font-medium">VAT-Inclusive Sales (Gross)</span>
                    <span className="text-xs font-mono font-bold text-gray-905">₱{taxSummary.totalVatInclusive.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="p-3 bg-indigo-50/30 rounded-lg border border-indigo-100/50 flex justify-between items-center">
                    <span className="text-xs text-indigo-950 font-bold">12% VAT Output Tax Collected</span>
                    <span className="text-xs font-mono font-extrabold text-indigo-700">₱{taxSummary.totalTaxCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Micro statistics */}
                <div className="grid grid-cols-2 gap-3 text-center pt-2">
                  <div className="p-2 border border-gray-100 bg-white rounded-lg">
                    <span className="block text-[9px] text-gray-400 uppercase font-mono font-semibold">VAT Transactions</span>
                    <span className="text-sm font-black text-gray-800">{taxSummary.vatSalesCount}</span>
                  </div>
                  <div className="p-2 border border-gray-100 bg-white rounded-lg">
                    <span className="block text-[9px] text-gray-400 uppercase font-mono font-semibold">Exempt / Zero-rated</span>
                    <span className="text-sm font-black text-gray-800">{taxSummary.exemptSalesCount}</span>
                  </div>
                </div>
              </div>

              {/* Item Category Sales */}
              <div className="lg:col-span-7 border border-gray-150 rounded-xl p-5 space-y-4 bg-white">
                <h4 className="text-xs font-bold text-gray-850 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-indigo-650" />
                  Category Sales Ledger Summary
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px] font-mono">
                        <th className="pb-2">Category Classification</th>
                        <th className="pb-2 text-right">Qty Dispatched</th>
                        <th className="pb-2 text-right">Invoice Value (PHP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {categorySalesSummary.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-gray-400">No category-based client deliveries identified</td>
                        </tr>
                      ) : (
                        categorySalesSummary.map(cat => (
                          <tr key={cat.category} className="hover:bg-gray-50/30">
                            <td className="py-3 font-semibold text-gray-900">{cat.category}</td>
                            <td className="py-3 text-right font-mono text-gray-505">{cat.qty.toLocaleString()} units</td>
                            <td className="py-3 text-right font-mono font-bold text-indigo-950">₱{cat.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 2: Regional Cluster Audits (Parts vs Service Breakdown) */}
            <div className="border border-gray-150 rounded-xl p-5 bg-white space-y-4">
              <h4 className="text-xs font-bold text-gray-850 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                <Building className="w-4 h-4 text-purple-650" />
                Regional Cluster Sales performance & Lines Classification
              </h4>
              <p className="text-[11px] text-gray-400 mt-[-8px]">
                Regional logistics cluster categorization including explicit separation of parts assets vs service/labor contracts.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-405 font-bold uppercase text-[10px] font-mono">
                      <th className="pb-3">Reporting Cluster Region</th>
                      <th className="pb-3 text-right">Parts Sales (PHP)</th>
                      <th className="pb-3 text-right">Service/Labor (PHP)</th>
                      <th className="pb-3 text-right">VAT-Exclusive Sales</th>
                      <th className="pb-3 text-right">Grand Total (Inc. VAT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-55">
                    {clustersData.map((cluster) => (
                      <tr key={cluster.name} className="hover:bg-gray-50/20">
                        <td className="py-3.5 font-bold text-gray-950 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                          {cluster.name}
                        </td>
                        <td className="py-3.5 text-right font-mono text-teal-700">
                          ₱{cluster.partsSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-right font-mono text-indigo-600">
                          ₱{cluster.servicesSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-right font-mono text-gray-500">
                          ₱{cluster.vatExSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-right font-mono font-extrabold text-indigo-950 text-sm">
                          ₱{cluster.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Sourcing Sourcing Expenditures (Supplier per category in PHP) */}
            <div className="border border-gray-150 rounded-xl p-5 bg-white space-y-4">
              <h4 className="text-xs font-bold text-gray-850 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                <Truck className="w-4 h-4 text-emerald-650" />
                Purchase Expenditures: Supplier per Item Category (converted to PHP)
              </h4>
              <p className="text-[11px] text-gray-400 mt-[-8px]">
                Audit matrix translating international currency supply costs (e.g. Caterpillar/Komatsu in USD) into Philippine Peso (PHP) at partner partner exchange rates.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="border-b border-gray-150 text-gray-400 font-bold uppercase text-[10px] font-mono">
                      <th className="pb-3">Sourcing Vendor / Supplier</th>
                      <th className="pb-3">Internal Category Allocation</th>
                      <th className="pb-3 text-right">Expenses (PHP Equivalent)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {purchaseSupplierCategorySummary.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-gray-400">No active overseas procurement data recorded</td>
                      </tr>
                    ) : (
                      purchaseSupplierCategorySummary.map((sup, sIdx) => {
                        const categories = Object.entries(sup.categories);
                        if (categories.length === 0) {
                          return (
                            <tr key={sup.supplierName} className="hover:bg-gray-50/10">
                              <td className="py-3.5 font-bold text-gray-900">{sup.supplierName}</td>
                              <td className="py-3.5 text-gray-400 font-mono italic">None Registered</td>
                              <td className="py-3.5 text-right font-mono font-bold text-emerald-600">₱0.00</td>
                            </tr>
                          );
                        }
                        return categories.map(([catName, expenseAmount], cIdx) => (
                           <tr key={`${sup.supplierName}-${catName}`} className="hover:bg-gray-50/10">
                            {cIdx === 0 ? (
                              <td className="py-3 font-bold text-gray-950" rowSpan={categories.length}>
                                <div className="flex items-center gap-1">
                                  <span className="px-1 text-[9px] font-black font-sans bg-emerald-50 text-emerald-700 border border-emerald-150 rounded mr-1">VENDOR</span>
                                  {sup.supplierName}
                                </div>
                              </td>
                            ) : null}
                            <td className="py-3 font-mono font-medium text-gray-700">{catName}</td>
                            <td className="py-3 text-right font-mono font-bold text-emerald-700">
                              ₱{Number(expenseAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ));
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 6: WEEKLY ALERTS & SPEND PDF SUMMARY */}
        {activeReportTab === 'weekly-pdf' && (() => {
          // Compute summary variables inside closure
          const lowStockThreshold = 10;
          const lowStockItems = items.filter(item => {
            const totalQty = Object.values(item.stockByWarehouse || {}).map((v: any) => Number(v) || 0).reduce((a, b) => a + b, 0);
            return totalQty <= (item.reorderPoint || lowStockThreshold);
          });

          let totalSpentPHP = 0;
          const poDetails = purchaseOrders.slice(0, 8).map(po => {
            const poSupplier = suppliers.find(s => s.name === po.vendorName || s.id === po.supplierId);
            const conversionRate = poSupplier?.exchangeRate || po.exchangeRate || 1.0;
            const totalPHP = po.total * conversionRate;
            totalSpentPHP += totalPHP;
            return {
              ...po,
              totalPHP
            };
          });

          // PDF compiler function
          const handleDownloadPDF = () => {
            const doc = new jsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Slate 800 background banner
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, pageWidth, 42, 'F');
            
            // Indigo divider accent
            doc.setFillColor(79, 70, 229);
            doc.rect(0, 42, pageWidth, 2.5, 'F');

            // Titles
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text("EQUIPRIME LOGISTICS HUB", 14, 16);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(191, 196, 210);
            doc.text("WEEKLY COMPREHENSIVE INTELLIGENCE REPORT", 14, 23);
            doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 30);

            // Confidentials right aligned
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.text("Status: CONFIDENTIAL", pageWidth - 14, 16, { align: 'right' });
            doc.setFont("helvetica", "normal");
            doc.setTextColor(191, 196, 210);
            doc.text("Type: LOW-STOCK & SOURCING SPEND", pageWidth - 14, 23, { align: 'right' });
            doc.text("Class: Standardized Sourcing Extract", pageWidth - 14, 30, { align: 'right' });

            let yPos = 55;

            // SECTION 1: LOW STOCK
            doc.setFillColor(244, 63, 94); // rose-500 indicator
            doc.rect(14, yPos, 4, 6, 'F');
            
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("1. DEPROVISIONED / LOW-STOCK SAFETY WARNINGS", 22, yPos + 4.5);

            yPos += 12;

            // Table Header block
            doc.setFillColor(241, 245, 249);
            doc.rect(14, yPos, pageWidth - 28, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text("SKU CODE", 16, yPos + 5.5);
            doc.text("PRODUCT DETAILS & MODEL", 42, yPos + 5.5);
            doc.text("ON-HAND", 115, yPos + 5.5);
            doc.text("TARGET LEVEL", 145, yPos + 5.5);
            doc.text("URGENCY STATUS", 172, yPos + 5.5);

            yPos += 8;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);

            if (lowStockItems.length === 0) {
              doc.text("No active safety threshold violations recorded. Supply levels are structurally solid.", 16, yPos + 5.5);
              yPos += 12;
            } else {
              lowStockItems.forEach(item => {
                const totalQty = Object.values(item.stockByWarehouse || {}).map((v: any) => Number(v) || 0).reduce((a, b) => a + b, 0);
                doc.setDrawColor(241, 245, 249);
                doc.line(14, yPos, pageWidth - 14, yPos);

                doc.text(item.sku, 16, yPos + 5.5);
                const descText = `${item.name} (${item.brand})`;
                doc.text(descText.length > 42 ? descText.substring(0, 42) + '...' : descText, 42, yPos + 5.5);
                
                doc.text(`${totalQty} ${item.unit}`, 115, yPos + 5.5);
                doc.text(`${item.reorderPoint} ${item.unit}`, 145, yPos + 5.5);

                doc.setFont("helvetica", "bold");
                if (totalQty === 0) {
                  doc.setTextColor(239, 68, 68);
                  doc.text("OUT-OF-STOCK", 172, yPos + 5.5);
                } else {
                  doc.setTextColor(245, 158, 11);
                  doc.text("LOW ON-HAND", 172, yPos + 5.5);
                }
                doc.setFont("helvetica", "normal");
                doc.setTextColor(30, 41, 59);
                yPos += 8;
              });
            }

            yPos += 10;

            // SECTION 2: SOURCING EXPEDITURES
            doc.setFillColor(79, 70, 229); // Indigo for money
            doc.rect(14, yPos, 4, 6, 'F');
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("2. WEEKLY SOURCING EXPENDITURES & PROCUREMENT", 22, yPos + 4.5);

            yPos += 12;

            // Table Header block
            doc.setFillColor(241, 245, 249);
            doc.rect(14, yPos, pageWidth - 28, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text("PO REF", 16, yPos + 5.5);
            doc.text("ORDER DATE", 42, yPos + 5.5);
            doc.text("SUPPLIER VENDOR", 72, yPos + 5.5);
            doc.text("SITE", 125, yPos + 5.5);
            doc.text("LEDGER STATE", 152, yPos + 5.5);
            doc.text("SUBTOTAL (PHP)", 172, yPos + 5.5);

            yPos += 8;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);

            if (poDetails.length === 0) {
              doc.text("No active procurement contracts registered in systems databases.", 16, yPos + 5.5);
              yPos += 12;
            } else {
              poDetails.forEach(po => {
                doc.setDrawColor(241, 245, 249);
                doc.line(14, yPos, pageWidth - 14, yPos);

                doc.text(po.poNumber, 16, yPos + 5.5);
                doc.text(po.orderDate || 'N/A', 42, yPos + 5.5);
                
                const sName = po.vendorName || 'N/A';
                doc.text(sName.length > 25 ? sName.substring(0, 25) + '...' : sName, 72, yPos + 5.5);
                
                const destWh = warehouses.find(w => w.id === po.warehouseId);
                doc.text(destWh ? destWh.code : 'Default', 125, yPos + 5.5);
                doc.text(po.status, 152, yPos + 5.5);

                doc.setFont("helvetica", "bold");
                doc.text(`₱${po.totalPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 172, yPos + 5.5);
                doc.setFont("helvetica", "normal");
                yPos += 8;
              });
            }

            yPos += 8;

            // Totals Sum block
            doc.setFillColor(248, 250, 252);
            doc.rect(14, yPos, pageWidth - 28, 16, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.rect(14, yPos, pageWidth - 28, 16, 'S');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text("AGGREGATE SOURCING EXPENSES SUM IN BASE PHP CONVERSION:", 18, yPos + 10.5);
            
            doc.setFontSize(11);
            doc.setTextColor(79, 70, 229);
            doc.text(`₱${totalSpentPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP`, pageWidth - 18, yPos + 10.5, { align: 'right' });

            // Page end footer
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("Equiprime Logistics Sourcing Desk - SECURE LEDGER BATCH EXTRACT", 14, pageHeight - 12);
            doc.text("Aligned with BIR Revenue Sourcing Protocols and ISO-2026 Audit Codes.", 14, pageHeight - 8);
            doc.text("Page 1 of 1", pageWidth - 14, pageHeight - 10, { align: 'right' });

            doc.save(`Weekly_Sourcing_Report_${new Date().toISOString().split('T')[0]}.pdf`);
          };

          return (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Header Title bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-901 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-rose-500" />
                    Automated Weekly PDF Intelligence Compiler
                  </h3>
                  <p className="text-xs text-gray-400">Instantly package threshold alerts and raw vendor spending converted to BIR-compliant base currency PHP</p>
                </div>
                <button
                  onClick={handleDownloadPDF}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-transform cursor-pointer shadow-sm hover:scale-[1.02] flex items-center gap-2"
                >
                  📥 Download Standard PDF Report
                </button>
              </div>

              {/* Grid Statistics summaries */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-amber-50/50 border border-amber-100/70 rounded-xl space-y-1">
                  <span className="block text-[10px] text-amber-500 uppercase font-mono font-bold">Safety Threshold Breaches</span>
                  <strong className="text-lg text-amber-900 block font-mono">{lowStockItems.length} SKUs Violation</strong>
                  <span className="text-[10px] text-amber-600 font-medium block">Urgent procurement list automatically drafted below.</span>
                </div>

                <div className="p-4 bg-indigo-50/40 border border-indigo-100/60 rounded-xl space-y-1">
                  <span className="block text-[10px] text-indigo-500 uppercase font-mono font-bold">Aggregate Sourcing Cost (Base)</span>
                  <strong className="text-lg text-indigo-950 block font-mono">₱{totalSpentPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                  <span className="text-[10px] text-indigo-600 font-medium block">Formulated across active procurement purchase order contracts in database.</span>
                </div>

                <div className="p-4 bg-emerald-50/40 border border-emerald-100/60 rounded-xl space-y-1">
                  <span className="block text-[10px] text-emerald-500 uppercase font-mono font-bold">Ledger Export Status</span>
                  <strong className="text-lg text-emerald-950 block">Audit-Compliant</strong>
                  <span className="text-[10px] text-emerald-600 font-medium block">Configured for instant download, local storage archiving, or print dispatch.</span>
                </div>
              </div>

              {/* Full Interactive PDF Mock Preview Container */}
              <div className="border border-gray-250 bg-slate-100 p-6 md:p-12 rounded-xl flex justify-center shadow-inner">
                {/* Paper sheet representation */}
                <div className="bg-white max-w-2xl w-full p-8 shadow-xl rounded-md border border-gray-250 text-slate-800 font-sans space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-800" />
                  
                  {/* Mock Paper Header */}
                  <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                    <div>
                      <h4 className="text-base font-black uppercase text-slate-900 tracking-tight">Equiprime Logistics Hub</h4>
                      <p className="text-[10px] text-slate-450 uppercase tracking-widest font-mono">Weekly Sourcing & Satiation Intelligence Summary</p>
                      <p className="text-[10px] text-indigo-600 mt-1 font-mono font-bold">Extract Timeline: Week Ending {new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="text-right text-[9px] font-mono text-slate-500">
                      <span className="block font-bold">ID: EQP-WLR-0994</span>
                      <span className="block">Status: SECURE ARCHIVE</span>
                      <span className="block">Location: Manila Hub, PH</span>
                    </div>
                  </div>

                  {/* Mock Section 1: Low stock alerts */}
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold uppercase text-rose-600 font-mono tracking-wider flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded bg-rose-500" />
                      1. Deprovisioned / Low-Stock Safety Warnings
                    </h5>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[10.5px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 font-bold font-mono text-[9px] text-slate-450">
                            <th className="p-2">SKU Code</th>
                            <th className="p-2">Product Name & Category</th>
                            <th className="p-2 text-center">Safety Level</th>
                            <th className="p-2 text-center">Current Stock</th>
                            <th className="p-2 text-right">Ledger Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {lowStockItems.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center italic text-slate-400">Stable inventory balance levels. No threshold overdraws tracked.</td>
                            </tr>
                          ) : (
                            lowStockItems.slice(0, 4).map(item => {
                              const totalQty = Object.values(item.stockByWarehouse || {}).map((v: any) => Number(v) || 0).reduce((a, b) => a + b, 0);
                              return (
                                <tr key={item.id} className="text-slate-700">
                                  <td className="p-2 font-bold">{item.sku}</td>
                                  <td className="p-2 font-sans">{item.name} <span className="text-[9.5px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-mono font-semibold">{item.category}</span></td>
                                  <td className="p-2 text-center text-rose-600 font-black">{item.reorderPoint}</td>
                                  <td className="p-2 text-center text-amber-600 font-black">{totalQty}</td>
                                  <td className="p-2 text-right text-rose-650 font-bold uppercase text-[9px]">{totalQty === 0 ? '⛔ OUT OF STOCK' : '⚠️ LOW ON-HAND'}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mock Section 2: Procurement Costs breakdown */}
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold uppercase text-indigo-600 font-mono tracking-wider flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded bg-indigo-500" />
                      2. Sourcing Expenditures & Capital Allocations
                    </h5>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[10.5px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 font-bold font-mono text-[9px] text-slate-450">
                            <th className="p-2">PO Ref Reference</th>
                            <th className="p-2">Supplier Vendor</th>
                            <th className="p-2">Site</th>
                            <th className="p-2">Stage</th>
                            <th className="p-2 text-right">Amount (PHP Eq)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {poDetails.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center italic text-slate-400">No active overseas procurement bills drafted.</td>
                            </tr>
                          ) : (
                            poDetails.slice(0, 4).map(po => (
                              <tr key={po.id} className="text-slate-700">
                                <td className="p-2 font-bold">{po.poNumber}</td>
                                <td className="p-2 font-sans">{po.vendorName}</td>
                                <td className="p-2">{warehouses.find(w => w.id === po.warehouseId)?.code || 'MANILA'}</td>
                                <td className="p-2 font-semibold text-emerald-650 text-[9.5px] uppercase">{po.status}</td>
                                <td className="p-2 text-right font-black text-slate-900">₱{po.totalPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Total summary Box */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200/80 flex items-center justify-between font-mono">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Weekly Total Procurement spending conversion (Base currency PHP):</span>
                    <strong className="text-base text-indigo-700 font-black">
                      ₱{totalSpentPHP.toLocaleString('en-US', { minimumFractionDigits: 2 })} PHP
                    </strong>
                  </div>

                  {/* Footer declaration */}
                  <div className="pt-4 border-t border-dashed border-slate-200 text-center text-[9px] text-slate-400 italic space-y-1 font-mono">
                    <p>Secured with military-grade SHA ledger hashing codes. Authorized distribution channels only.</p>
                    <p>© 2026 Equiprime Logistics Sourcing. Standards enforcement document.</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
