/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Warehouse, Item, PurchaseOrder, SalesOrder, StockTransfer, InventoryTransaction, Supplier, Customer, UserRecord, StockLot, MachineLog, ExplicitGoodsReceipt, ExplicitDeliveryReceipt } from './types';
import { 
  INITIAL_WAREHOUSES, 
  INITIAL_ITEMS, 
  INITIAL_PURCHASE_ORDERS, 
  INITIAL_SALES_ORDERS, 
  INITIAL_TRANSFERS, 
  INITIAL_TRANSACTIONS,
  INITIAL_SUPPLIERS,
  INITIAL_USERS,
  INITIAL_CUSTOMERS,
  INITIAL_LOTS,
  INITIAL_MACHINE_LOGS
} from './InitialData';

// Component imports
import Dashboard from './components/Dashboard';
import InventoryItems from './components/InventoryItems';
import PurchaseOrders from './components/PurchaseOrders';
import SalesOrders from './components/SalesOrders';
import WarehouseManager from './components/WarehouseManager';
import Reports from './components/Reports';
import Suppliers from './components/Suppliers';
import UserAccessManager from './components/UserAccessManager';
import CustomerManager from './components/CustomerManager';
import FifoLotsManager from './components/FifoLotsManager';
import TrackingHub from './components/TrackingHub';
import MachineLogs from './components/MachineLogs';
import LoginPage from './components/LoginPage';
import EmailAlertsHub from './components/EmailAlertsHub';
import { ResetSetupModal } from './components/ResetSetupModal';
import { LoginSessionLog } from './types';

// Icons
import { 
  Building2, 
  Warehouse as WHIcon, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  BarChart3, 
  Database,
  Building,
  User,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  LogOut,
  AppWindow,
  Users,
  Shield,
  Barcode,
  Wrench,
  FileCheck,
  Mail
} from 'lucide-react';

export default function App() {
  // Core states loaded from localStorage or fallback to initial seed data
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => {
    const saved = localStorage.getItem('inv_warehouses');
    return saved ? JSON.parse(saved) : INITIAL_WAREHOUSES;
  });

  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem('inv_items');
    return saved ? JSON.parse(saved) : INITIAL_ITEMS;
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const saved = localStorage.getItem('inv_purchase_orders');
    return saved ? JSON.parse(saved) : INITIAL_PURCHASE_ORDERS;
  });

  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>(() => {
    const saved = localStorage.getItem('inv_sales_orders');
    return saved ? JSON.parse(saved) : INITIAL_SALES_ORDERS;
  });

  const [transfers, setTransfers] = useState<StockTransfer[]>(() => {
    const saved = localStorage.getItem('inv_transfers');
    return saved ? JSON.parse(saved) : INITIAL_TRANSFERS;
  });

  const [transactions, setTransactions] = useState<InventoryTransaction[]>(() => {
    const saved = localStorage.getItem('inv_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('inv_suppliers');
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });

  const [users, setUsers] = useState<UserRecord[]>(() => {
    const saved = localStorage.getItem('inv_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<UserRecord>(() => {
    const saved = localStorage.getItem('inv_current_user');
    return saved ? JSON.parse(saved) : INITIAL_USERS[0];
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('inv_is_logged_in') === 'true';
  });

  const [loginSessionLogs, setLoginSessionLogs] = useState<LoginSessionLog[]>(() => {
    const saved = localStorage.getItem('inv_login_session_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('inv_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [lots, setLots] = useState<StockLot[]>(() => {
    const saved = localStorage.getItem('inv_lots');
    return saved ? JSON.parse(saved) : INITIAL_LOTS;
  });

  const [machineLogs, setMachineLogs] = useState<MachineLog[]>(() => {
    const saved = localStorage.getItem('inv_machine_logs');
    return saved ? JSON.parse(saved) : INITIAL_MACHINE_LOGS;
  });

  const [explicitGoodsReceipts, setExplicitGoodsReceipts] = useState<ExplicitGoodsReceipt[]>(() => {
    const saved = localStorage.getItem('inv_explicit_grs');
    return saved ? JSON.parse(saved) : [];
  });

  const [explicitDeliveryReceipts, setExplicitDeliveryReceipts] = useState<ExplicitDeliveryReceipt[]>(() => {
    const saved = localStorage.getItem('inv_explicit_drs');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Automated Low Stock Email Alerts Trigger System State
  const [emailAlertLogs, setEmailAlertLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem('inv_email_alerts');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('inv_email_alerts', JSON.stringify(emailAlertLogs));
  }, [emailAlertLogs]);

  const triggerLowStockEmail = (item: Item, prevStock: number, currentStock: number) => {
    const subject = `⚠️ [ALERT] Stock Low: Sku ${item.sku} fell below Reorder Point`;
    const body = `Hi Procurement Team,

This is an automated system alert triggered via Firebase functions / local mock service.

The stock level for item "${item.name}" (SKU: ${item.sku}) has fallen below its configured reorder level of ${item.reorderPoint} units.

- Previous Stock: ${prevStock} ${item.unit}
- Current Stock: ${currentStock} ${item.unit}
- Reorder Point: ${item.reorderPoint} ${item.unit}

Please initiate a new Purchase Order immediately for this sku to avoid supply chain interruption.

Best Regards,
Equiprime Inventory Automated System Alerts Portal`;

    const newLog = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      previousStock: prevStock,
      currentStock,
      reorderPoint: item.reorderPoint,
      dateTriggered: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      recipientEmail: "procurement@equiprime.ph",
      subject,
      body,
      status: 'Sent',
      serviceType: 'Firebase Function (Simulated)'
    };

    setEmailAlertLogs((prev) => [newLog, ...prev]);
    triggerToast(
      `Email trigger fired to procurement@equiprime.ph: '${item.name}' fell to ${currentStock} units. Check Email Alerts Log.`,
      'warning',
      'Low Stock Email Alert'
    );
  };

  // Manual trigger tester handler
  const handleTriggerMockAlert = (item: Item, customStockValue: number) => {
    const prevStock = Object.values(item.stockByWarehouse).map((v: any) => Number(v) || 0).reduce((a: number, b: number) => a + b, 0);
    triggerLowStockEmail(item, prevStock, customStockValue);
  };

  // Keep track of previous items to detect drops
  const prevItemsRef = useRef<Item[] | null>(null);

  useEffect(() => {
    if (!items || items.length === 0) return;
    
    if (prevItemsRef.current) {
      items.forEach((item) => {
        const prevItem = prevItemsRef.current?.find((p) => p.id === item.id);
        if (prevItem) {
          const currentStock = Object.values(item.stockByWarehouse).map((v: any) => Number(v) || 0).reduce((a: number, b: number) => a + b, 0);
          const previousStock = Object.values(prevItem.stockByWarehouse).map((v: any) => Number(v) || 0).reduce((a: number, b: number) => a + b, 0);

          if (currentStock <= item.reorderPoint && previousStock > item.reorderPoint) {
            triggerLowStockEmail(item, previousStock, currentStock);
          }
        }
      });
    }
    prevItemsRef.current = items;
  }, [items]);
  const [isResetSetupOpen, setIsResetSetupOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'warning'; title?: string }[]>([]);

  const triggerToast = (message: string, type: 'success' | 'info' | 'warning' = 'success', title?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast = { id, message, type, title };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleDeleteGoodsReceipt = (grId: string) => {
    const gr = explicitGoodsReceipts.find(g => g.id === grId);
    if (!gr) return;
    
    if (currentUser?.role !== 'Admin' && !currentUser?.permissions?.canRevertLifecycle) {
      alert("⚠️ ACCESS DENIED! Only administrators or authorized personnel with 'Revert Lifecycle' permission can delete Goods Receipts.");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete Goods Receipt ${gr.grNumber}? This action is irreversible.`)) {
      return;
    }
    
    setExplicitGoodsReceipts(prev => prev.filter(g => g.id !== grId));
    triggerToast(`Goods Receipt ${gr.grNumber} has been successfully deleted.`, 'info', 'GR Deleted');
  };

  const handleDeleteDeliveryReceipt = (drId: string) => {
    const dr = explicitDeliveryReceipts.find(d => d.id === drId);
    if (!dr) return;

    if (currentUser?.role !== 'Admin' && !currentUser?.permissions?.canRevertLifecycle) {
      alert("⚠️ ACCESS DENIED! Only administrators or authorized personnel with 'Revert Lifecycle' permission can delete Delivery Receipts.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Delivery Receipt ${dr.drNumber}? This action is irreversible.`)) {
      return;
    }

    setExplicitDeliveryReceipts(prev => prev.filter(d => d.id !== drId));
    triggerToast(`Delivery Receipt ${dr.drNumber} has been successfully deleted.`, 'info', 'DR Deleted');
  };

  const isTabVisible = (tabId: string) => {
    const list = currentUser?.permissions?.allowedTabs || ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'tracking-hub', 'user-security', 'reports', 'machine-logs', 'email-logs'];
    return list.includes(tabId);
  };

  useEffect(() => {
    const list = currentUser?.permissions?.allowedTabs || ['dashboard', 'items', 'purchase', 'sales', 'warehouses', 'suppliers', 'customers', 'fifo-lots', 'tracking-hub', 'user-security', 'reports', 'machine-logs', 'email-logs'];
    if (!list.includes(activeTab)) {
      if (list.length > 0) {
        setActiveTab(list[0]);
      }
    }
  }, [currentUser, activeTab]);

  // Derive items with dynamic average supplier price from Received POs
  const processedItems = useMemo(() => {
    return items.map((item) => {
      let totalCost = 0;
      let totalQty = 0;
      purchaseOrders.forEach((po) => {
        if (po.status === 'Received') {
          po.items.forEach((line) => {
            if (line.itemId === item.id) {
              totalCost += (line.unitCost ?? 0) * line.quantity;
              totalQty += line.quantity;
            }
          });
        }
      });
      if (totalQty > 0) {
        return {
          ...item,
          purchasePrice: totalCost / totalQty
        };
      }
      return item;
    });
  }, [items, purchaseOrders]);

  // Sync state mutations back to LocalStorage
  useEffect(() => {
    localStorage.setItem('inv_warehouses', JSON.stringify(warehouses));
  }, [warehouses]);

  useEffect(() => {
    localStorage.setItem('inv_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('inv_purchase_orders', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  useEffect(() => {
    localStorage.setItem('inv_sales_orders', JSON.stringify(salesOrders));
  }, [salesOrders]);

  useEffect(() => {
    localStorage.setItem('inv_transfers', JSON.stringify(transfers));
  }, [transfers]);

  useEffect(() => {
    localStorage.setItem('inv_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('inv_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('inv_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('inv_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('inv_is_logged_in', String(isLoggedIn));
  }, [isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('inv_login_session_logs', JSON.stringify(loginSessionLogs));
  }, [loginSessionLogs]);

  useEffect(() => {
    localStorage.setItem('inv_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('inv_lots', JSON.stringify(lots));
  }, [lots]);

  useEffect(() => {
    localStorage.setItem('inv_machine_logs', JSON.stringify(machineLogs));
  }, [machineLogs]);

  useEffect(() => {
    localStorage.setItem('inv_explicit_grs', JSON.stringify(explicitGoodsReceipts));
  }, [explicitGoodsReceipts]);

  useEffect(() => {
    localStorage.setItem('inv_explicit_drs', JSON.stringify(explicitDeliveryReceipts));
  }, [explicitDeliveryReceipts]);

  // RESET TO DEFAULT SEED DATA Trigger
  const handleResetData = () => {
    if (currentUser?.role !== 'Admin') {
      alert("⚠️ ACCESS DENIED! Only administrators are authorized to reset the application data.");
      return;
    }
    setIsResetSetupOpen(true);
  };

  const handleCompleteManualReset = (setupData: {
    warehouse: Warehouse;
    item: Item;
    supplier: Supplier;
    customer: Customer;
  }) => {
    setWarehouses([setupData.warehouse]);
    setItems([setupData.item]);
    setSuppliers([setupData.supplier]);
    setCustomers([setupData.customer]);
    setPurchaseOrders([]);
    setSalesOrders([]);
    setTransfers([]);
    setTransactions([]);
    setLots([]);
    setExplicitGoodsReceipts([]);
    setExplicitDeliveryReceipts([]);
    setMachineLogs([]);
    
    // Preserve current admin or default logins
    const keptAdmins = users.filter(u => u.role === 'Admin');
    setUsers(keptAdmins.length > 0 ? keptAdmins : INITIAL_USERS);
    
    setIsResetSetupOpen(false);
    setActiveTab('dashboard');
    setLoginSessionLogs([]);
    alert("🚀 CUSTOM REGISTRY INITIALIZED SUCCESSFUL! The application has been reset and populated with your manual configurations.");
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to load standard demo seed data? This will overwrite your current settings and customization.')) {
      setWarehouses(INITIAL_WAREHOUSES);
      setItems(INITIAL_ITEMS);
      setPurchaseOrders([]);
      setSalesOrders([]);
      setTransfers([]);
      setTransactions([]);
      setSuppliers(INITIAL_SUPPLIERS);
      
      const keptAdmins = users.filter(u => u.role === 'Admin');
      setUsers(keptAdmins.length > 0 ? keptAdmins : INITIAL_USERS);
      
      if (currentUser && currentUser.role === 'Admin') {
        setCurrentUser(currentUser);
        setIsLoggedIn(true);
      } else {
        const firstAdmin = keptAdmins[0] || INITIAL_USERS[0];
        setCurrentUser(firstAdmin);
        setIsLoggedIn(true);
      }

      setCustomers(INITIAL_CUSTOMERS);
      setLots([]);
      setExplicitGoodsReceipts([]);
      setExplicitDeliveryReceipts([]);
      setMachineLogs(INITIAL_MACHINE_LOGS);
      setIsResetSetupOpen(false);
      setActiveTab('dashboard');
      setLoginSessionLogs([]);
      alert("Demo seed data restored successfully.");
    }
  };

  // ----- SESSION LOGIN AUDITING HANDLERS -----
  const handleLoginEvent = (
    user: UserRecord | null,
    emailEntered: string,
    isSuccess: boolean,
    reason?: string
  ) => {
    const timestampStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const newLog: LoginSessionLog = {
      id: logId,
      userName: user ? user.name : 'Unknown Identity',
      userEmail: emailEntered,
      userRole: user ? user.role : 'Guest / External',
      timestamp: timestampStr,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      reason: reason || (isSuccess ? 'Successfully authenticated session.' : 'Authentication failed.')
    };

    setLoginSessionLogs((prev) => [...prev, newLog]);

    if (isSuccess && user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    // Add logout remark log
    const timestampStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';
    const logId = `log-${Date.now()}`;
    const logoutLog: LoginSessionLog = {
      id: logId,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      timestamp: timestampStr,
      status: 'SUCCESS',
      reason: `User logged out of active workspace session.`
    };
    setLoginSessionLogs((prev) => [...prev, logoutLog]);
  };

  const handleClearLoginLogs = () => {
    setLoginSessionLogs([]);
  };

  const handleChangeSimUser = (user: UserRecord) => {
    const timestampStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';
    const logId = `log-${Date.now()}`;
    const newLog: LoginSessionLog = {
      id: logId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      timestamp: timestampStr,
      status: 'SUCCESS',
      reason: `Switched active design context to simulated profile: ${user.name} (${user.role})`
    };
    setLoginSessionLogs((prev) => [...prev, newLog]);
    setCurrentUser(user);
  };

  // ----- SUPPLIERS STATE MUTATIONS -----
  const handleAddSupplier = (newSup: Omit<Supplier, 'id'>) => {
    const createdSupplier: Supplier = {
      ...newSup,
      id: `sup-${Date.now()}`
    };
    setSuppliers((prev) => [...prev, createdSupplier]);
  };

  const handleEditSupplier = (updatedSup: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.id === updatedSup.id ? updatedSup : s)));
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  // ----- USERS STATE MUTATIONS -----
  const handleAddUser = (newUsr: Omit<UserRecord, 'id'>) => {
    const createdUser: UserRecord = {
      ...newUsr,
      id: `user-${Date.now()}`
    };
    setUsers((prev) => [...prev, createdUser]);
  };

  const handleEditUser = (updatedUsr: UserRecord) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUsr.id ? updatedUsr : u)));
    if (updatedUsr.id === currentUser.id) {
      setCurrentUser(updatedUsr);
    }
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      alert("Cannot delete the active logged-in user simulation profile!");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  // ----- CUSTOMERS STATE MUTATIONS -----
  const handleAddCustomer = (newCust: Omit<Customer, 'id'>) => {
    const createdCustomer: Customer = {
      ...newCust,
      id: `cust-${Date.now()}`
    };
    setCustomers((prev) => [...prev, createdCustomer]);
  };

  const handleEditCustomer = (updatedCust: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
  };

  const handleDeleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  // ----- FIFO STOCK LOTS MUTATIONS -----
  const handleAddLot = (newLot: Omit<StockLot, 'id'>) => {
    const createdLot: StockLot = {
      ...newLot,
      id: `lot-${Date.now()}`
    };
    setLots((prev) => [...prev, createdLot]);

    // Side effect: increase current catalog stock for item
    setItems((prevItems) => {
      const target = prevItems.find(p => p.id === newLot.itemId);
      if (!target) return prevItems;
      return prevItems.map((item) => {
        if (item.id !== newLot.itemId) return item;
        const currentStockMap = { ...item.stockByWarehouse };
        const previousStock = currentStockMap[newLot.warehouseId] || 0;
        currentStockMap[newLot.warehouseId] = previousStock + newLot.quantityReceived;
        return {
          ...item,
          stockByWarehouse: currentStockMap
        };
      });
    });
  };

  const handleEditLot = (updatedLot: StockLot) => {
    setLots((prev) => prev.map((l) => (l.id === updatedLot.id ? updatedLot : l)));
  };

  const handleDeleteLot = (id: string) => {
    setLots((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAdjustLotStock = (
    lotId: string,
    adjustmentType: 'dispense' | 'adjust',
    quantity: number,
    reason: string
  ) => {
    const targetLot = lots.find((l) => l.id === lotId);
    if (!targetLot) return;

    const targetItem = items.find((p) => p.id === targetLot.itemId);
    if (!targetItem) return;

    const targetWhName = warehouses.find((w) => w.id === targetLot.warehouseId)?.name || 'Central Site';

    let delta = 0;
    let newQuantityRemaining = targetLot.quantityRemaining;

    if (adjustmentType === 'dispense') {
      delta = -quantity;
      newQuantityRemaining = Math.max(0, targetLot.quantityRemaining - quantity);
    } else if (adjustmentType === 'adjust') {
      newQuantityRemaining = Math.max(0, quantity);
      delta = newQuantityRemaining - targetLot.quantityRemaining;
    }

    if (delta === 0) return; // No actual balance change

    // 1. Update the target lot's quantityRemaining
    setLots((prevLots) =>
      prevLots.map((l) => (l.id === lotId ? { ...l, quantityRemaining: newQuantityRemaining } : l))
    );

    // 2. Adjust target item stock inside stockByWarehouse
    setItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id !== targetLot.itemId) return item;
        const currentStockMap = { ...item.stockByWarehouse };
        const prevStock = currentStockMap[targetLot.warehouseId] || 0;
        currentStockMap[targetLot.warehouseId] = Math.max(0, prevStock + delta);
        return {
          ...item,
          stockByWarehouse: currentStockMap
        };
      });
    });

    // 3. Log a detailed InventoryTransaction which includes the Lot ID
    const operationName = adjustmentType === 'dispense' ? 'FIFO Lot Dispense' : 'FIFO Lot Reconciliation';
    const transactionRecord: InventoryTransaction = {
      id: `tx-lot-${Date.now()}`,
      itemId: targetLot.itemId,
      itemName: targetItem.name,
      sku: targetItem.sku,
      quantity: delta,
      type: 'Adjustment',
      referenceNumber: targetLot.lotNumber,
      warehouseId: targetLot.warehouseId,
      warehouseName: targetWhName,
      date: new Date().toISOString().split('T')[0],
      description: `${operationName} of ${Math.abs(delta)} pcs. [Lot ID: ${targetLot.id}] [Lot No: ${targetLot.lotNumber}]. Reason: ${reason}`,
      lotId: targetLot.id
    };

    setTransactions((prev) => [...prev, transactionRecord]);
  };

  // ----- INVENTORY EVENTS & MUTATIONS TRIGGER HANDLERS -----

  // 1. Add Catalog Item
  const handleAddItem = (newItem: Omit<Item, 'id'>) => {
    const createdItem: Item = {
      ...newItem,
      id: `item-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`
    };
    setItems((prev) => [...prev, createdItem]);
  };

  // 2. Edit Catalog Item Details
  const handleEditItem = (updatedItem: Item) => {
    setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
  };

  // 2.5 Delete Catalog Item
  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  // 3. Manual Stock Adjustment Reconciliation
  const handleAdjustStock = (
    itemId: string,
    warehouseId: string,
    adjustmentType: 'add' | 'remove' | 'set',
    qty: number,
    reason: string
  ) => {
    const targetItem = items.find((p) => p.id === itemId);
    const targetWhName = warehouses.find((w) => w.id === warehouseId)?.name || 'Default Site';
    if (!targetItem) return;

    setItems((prevItems) => {
      return prevItems.map((item) => {
        if (item.id !== itemId) return item;
        const currentStockMap = { ...item.stockByWarehouse };
        const prevStock = currentStockMap[warehouseId] || 0;
        let finalStock = prevStock;

        if (adjustmentType === 'add') finalStock = prevStock + qty;
        else if (adjustmentType === 'remove') finalStock = Math.max(0, prevStock - qty);
        else if (adjustmentType === 'set') finalStock = qty;

        currentStockMap[warehouseId] = finalStock;
        return {
          ...item,
          stockByWarehouse: currentStockMap
        };
      });
    });

    // Record adjustment as formal transaction audit ledger
    const volumeChange = adjustmentType === 'add' 
      ? qty 
      : adjustmentType === 'remove' 
        ? -qty 
        : qty - (targetItem.stockByWarehouse[warehouseId] || 0);

    const adjustmentTransaction: InventoryTransaction = {
      id: `tx-${Date.now()}`,
      itemId,
      itemName: targetItem.name,
      sku: targetItem.sku,
      quantity: volumeChange,
      type: 'Adjustment',
      referenceNumber: 'MAN-ADJ',
      warehouseId,
      warehouseName: targetWhName,
      date: new Date().toISOString().split('T')[0],
      description: `Stock manually reconciled: ${reason}`
    };

    setTransactions((prev) => [...prev, adjustmentTransaction]);
  };

  // 4. Create Supplier Purchase Order (Draft)
  const handleCreatePO = (newPO: Omit<PurchaseOrder, 'id'>) => {
    const createdPO: PurchaseOrder = {
      ...newPO,
      id: `po-${Date.now()}`,
      statusHistory: [
        {
          status: 'Draft',
          date: new Date().toISOString().split('T')[0],
          note: 'Purchase Order created as draft.',
          user: currentUser?.name || 'Staff Member'
        }
      ]
    };

    setPurchaseOrders((prev) => [...prev, createdPO]);
  };

  const handleEditPO = (updatedPO: PurchaseOrder, isRemarkOnly?: boolean) => {
    setPurchaseOrders((prev) => prev.map((po) => {
      if (po.id === updatedPO.id) {
        if (isRemarkOnly) {
          return updatedPO;
        }
        const history = po.statusHistory ? [...po.statusHistory] : [
          { status: 'Draft', date: po.orderDate, note: 'Purchase Order created.', user: 'Staff Member' }
        ];
        history.push({
          status: po.status,
          date: new Date().toISOString().split('T')[0],
          note: 'Purchase Order details or notes were edited.',
          user: currentUser?.name || 'Staff Member'
        });
        return {
          ...updatedPO,
          statusHistory: history
        };
      }
      return po;
    }));
  };

  // 5. Update Purchase Order Status Lifecycle
  const handleUpdatePOStatus = (poId: string, status: PurchaseOrder['status'], changeReason?: string, operatorName?: string) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return;

    const oldStatus = po.status;
    if (oldStatus === status) return; // No change

    // Enforce lifecycle reversibility validation
    const isPoReversion = 
      (oldStatus === 'Received' && status !== 'Received') ||
      (oldStatus === 'Issued' && status === 'Draft');
    
    if (isPoReversion) {
      const allowed = currentUser.role === 'Admin' || currentUser.permissions.canRevertLifecycle;
      if (!allowed) {
        alert("⚠️ ACCESS DENIED! Only administrators or authorized assigned personnel with 'Revert Lifecycle' permission can revert the status of this transaction life cycle.");
        return;
      }
    }

    const todayDate = new Date().toISOString().split('T')[0];

    // Build the status history log note and object
    let actionNote = '';
    if (changeReason && changeReason.trim()) {
      actionNote = changeReason.trim();
    } else {
      if (status === 'Issued') {
        actionNote = `Purchase order issued and dispatched to supplier ${po.vendorName || ''}.`;
      } else if (status === 'Received') {
        actionNote = `Received all items in full. Verified stock checked-in at destination site.`;
      } else if (status === 'Cancelled') {
        actionNote = `Purchase order cancelled.`;
      } else if (status === 'Draft') {
        actionNote = `Purchase order status reverted to draft.`;
      } else {
        actionNote = `Status updated to ${status}.`;
      }
    }

    setPurchaseOrders((prev) =>
      prev.map((p) => {
        if (p.id === poId) {
          const history = p.statusHistory ? [...p.statusHistory] : [
            { status: 'Draft', date: p.orderDate, note: 'Purchase Order created.', user: 'Staff Member' }
          ];
          history.push({
            status,
            date: todayDate,
            note: actionNote,
            user: operatorName || currentUser?.name || 'Staff Member'
          });

          if (status === 'Received') {
            const daysPassed = p.orderDate 
              ? Math.max(1, Math.ceil((new Date(todayDate).getTime() - new Date(p.orderDate).getTime()) / (1000 * 60 * 60 * 24)))
              : 7;
            return { 
              ...p, 
              status, 
              actualDeliveryDate: todayDate,
              leadTimeDays: daysPassed,
              statusHistory: history
            };
          }
          return { ...p, status, actualDeliveryDate: undefined, leadTimeDays: undefined, statusHistory: history };
        }
        return p;
      })
    );

    // SIDE EFFECT A: When status changes to "Received", programmatically raise items stocking levels
    if (status === 'Received') {
      const destWarehouseName = warehouses.find((w) => w.id === po.warehouseId)?.name || 'Specified Hub';
      const totalUnits = po.items.reduce((s, it) => s + it.quantity, 0);
      triggerToast(
        `Successfully received PO ${po.poNumber}. Injected ${totalUnits.toLocaleString()} units of inventory into "${destWarehouseName}".`,
        'success',
        `Stock Injected: PO ${po.poNumber}`
      );
      
      setItems((prevItems) => {
        return prevItems.map((item) => {
          const poLineOfItem = po.items.find((line) => line.itemId === item.id);
          if (!poLineOfItem) return item;

          const currentStockMap = { ...item.stockByWarehouse };
          const previousStock = currentStockMap[po.warehouseId] || 0;
          currentStockMap[po.warehouseId] = previousStock + poLineOfItem.quantity;

          return {
            ...item,
            purchasePrice: poLineOfItem.unitCost || item.purchasePrice,
            stockByWarehouse: currentStockMap
          };
        });
      });

      // Record logs for each incoming line element
      const receivedTransactions: InventoryTransaction[] = po.items.map((line, idx) => {
        const itemObj = items.find((p) => p.id === line.itemId);
        return {
          id: `tx-${poId}-${idx}-${Date.now()}`,
          itemId: line.itemId,
          itemName: itemObj?.name || 'Item in PO',
          sku: itemObj?.sku || 'SKU',
          quantity: line.quantity,
          type: 'Purchase',
          referenceNumber: po.poNumber,
          warehouseId: po.warehouseId,
          warehouseName: destWarehouseName,
          date: todayDate,
          description: `Inventory checked-in from received PO ${po.poNumber}`
        };
      });

      setTransactions((prev) => [...prev, ...receivedTransactions]);

      // Record corresponding FIFO stock lots with QR codes for received items
      const newStockLots: StockLot[] = po.items.map((line, idx) => {
        const itemObj = items.find((p) => p.id === line.itemId);
        const sku = itemObj?.sku || 'SKU';
        const nowStamp = Date.now().toString().slice(-6);
        const randValue = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const uniqueLotNumber = `LOT-${po.poNumber.substring(3)}-${sku}-${nowStamp}`;
        const qrValue = `QR-LOT-${line.itemId.slice(-4)}-${nowStamp}-${randValue}`;

        return {
          id: `lot-${line.itemId}-${Date.now()}-${idx}`,
          itemId: line.itemId,
          lotNumber: uniqueLotNumber,
          warehouseId: po.warehouseId,
          quantityReceived: line.quantity,
          quantityRemaining: line.quantity,
          dateReceived: todayDate,
          barcodeValue: qrValue,
          poId: po.id,
          poNumber: po.poNumber,
          grNumber: `GR-${po.poNumber.substring(3)}`
        };
      });

      if (newStockLots.length > 0) {
        setLots((prevLots) => [...prevLots, ...newStockLots]);
      }
    }

    // SIDE EFFECT B: If moving AWAY from Received, subtract/reverse the stocking level
    if (oldStatus === 'Received' && status !== 'Received') {
      const destWarehouseName = warehouses.find((w) => w.id === po.warehouseId)?.name || 'Specified Hub';
      
      setItems((prevItems) => {
        return prevItems.map((item) => {
          const poLineOfItem = po.items.find((line) => line.itemId === item.id);
          if (!poLineOfItem) return item;

          const currentStockMap = { ...item.stockByWarehouse };
          const previousStock = currentStockMap[po.warehouseId] || 0;
          currentStockMap[po.warehouseId] = Math.max(0, previousStock - poLineOfItem.quantity);

          return {
            ...item,
            stockByWarehouse: currentStockMap
          };
        });
      });

      // Record reverse transactions
      const reversalTransactions: InventoryTransaction[] = po.items.map((line, idx) => {
        const itemObj = items.find((p) => p.id === line.itemId);
        return {
          id: `tx-rev-${poId}-${idx}-${Date.now()}`,
          itemId: line.itemId,
          itemName: itemObj?.name || 'Item in PO',
          sku: itemObj?.sku || 'SKU',
          quantity: -line.quantity,
          type: 'Adjustment',
          referenceNumber: po.poNumber,
          warehouseId: po.warehouseId,
          warehouseName: destWarehouseName,
          date: todayDate,
          description: `Inventory backed-out. Purchase Order status reversed from Received to ${status}`
        };
      });

      setTransactions((prev) => [...prev, ...reversalTransactions]);
    }
  };

  // 5.5 Partial and Explicit Logistics Receipt Processors
  const handleReceivePOBatch = (
    poId: string, 
    receiptNumber: string, 
    receivedBy: string, 
    receivedDate: string, 
    notes: string, 
    receivedAmounts: Record<string, number>,
    lotNumbers?: Record<string, string>,
    lotSplits?: Array<{ itemId: string; lotNumber: string; quantity: number; expiryDate?: string }>
  ) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    const grItems: { itemId: string; sku: string; name: string; quantity: number; lotId?: string; lotNumber?: string; }[] = [];
    const newStockLots: StockLot[] = [];

    let updatedPOItems;

    if (lotSplits && lotSplits.length > 0) {
      // Group quantities by itemId to update receivedQuantity in lines
      const splitTotals: Record<string, number> = {};
      lotSplits.forEach(s => {
        splitTotals[s.itemId] = (splitTotals[s.itemId] || 0) + s.quantity;
      });

      updatedPOItems = po.items.map(line => {
        const batchQty = splitTotals[line.itemId] || 0;
        const prevRec = line.receivedQuantity || 0;
        return {
          ...line,
          receivedQuantity: prevRec + batchQty
        };
      });

      lotSplits.forEach((split, idx) => {
        const itemObj = items.find(it => it.id === split.itemId);
        const nowStamp = Date.now().toString().slice(-6);
        const randValue = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const qrValue = `QR-LOT-${split.itemId.slice(-4)}-${nowStamp}-${idx}-${randValue}`;
        const targetLotId = `lot-${split.itemId}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;

        newStockLots.push({
          id: targetLotId,
          itemId: split.itemId,
          lotNumber: split.lotNumber,
          warehouseId: po.warehouseId,
          quantityReceived: split.quantity,
          quantityRemaining: split.quantity,
          dateReceived: receivedDate,
          expiryDate: split.expiryDate ? new Date(split.expiryDate).toISOString() : undefined,
          barcodeValue: qrValue,
          poId: po.id,
          poNumber: po.poNumber,
          grId: `GR-${receiptNumber}`,
          grNumber: receiptNumber
        });

        grItems.push({
          itemId: split.itemId,
          sku: itemObj?.sku || 'SKU',
          name: itemObj?.name || 'Item',
          quantity: split.quantity,
          lotId: targetLotId,
          lotNumber: split.lotNumber
        });
      });
    } else {
      updatedPOItems = po.items.map(line => {
        const batchQty = receivedAmounts[line.itemId] || 0;
        if (batchQty > 0) {
          const itemObj = items.find(it => it.id === line.itemId);
          const nowStamp = Date.now().toString().slice(-6);
          const randValue = Math.floor(Math.random() * 1050).toString().padStart(3, '0');
          
          const customLotNum = lotNumbers?.[line.itemId]?.trim();
          const uniqueLotNumber = customLotNum || `LOT-${po.poNumber.substring(3)}-${itemObj?.sku || 'SKU'}-${nowStamp}`;
          const qrValue = `QR-LOT-${line.itemId.slice(-4)}-${nowStamp}-${randValue}`;
          const targetLotId = `lot-${line.itemId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

          newStockLots.push({
            id: targetLotId,
            itemId: line.itemId,
            lotNumber: uniqueLotNumber,
            warehouseId: po.warehouseId,
            quantityReceived: batchQty,
            quantityRemaining: batchQty,
            dateReceived: receivedDate,
            barcodeValue: qrValue,
            poId: po.id,
            poNumber: po.poNumber,
            grId: `GR-${receiptNumber}`,
            grNumber: receiptNumber
          });

          grItems.push({
            itemId: line.itemId,
            sku: itemObj?.sku || 'SKU',
            name: itemObj?.name || 'Item',
            quantity: batchQty,
            lotId: targetLotId,
            lotNumber: uniqueLotNumber
          });
        }
        const prevRec = line.receivedQuantity || 0;
        return {
          ...line,
          receivedQuantity: prevRec + batchQty
        };
      });
    }

    const newGR: ExplicitGoodsReceipt = {
      id: `GR-${receiptNumber}-${Date.now()}`,
      grNumber: receiptNumber,
      poId,
      poNumber: po.poNumber,
      receivedDate,
      receivedBy,
      notes,
      warehouseId: po.warehouseId,
      items: grItems
    };

    setExplicitGoodsReceipts(prev => [...prev, newGR]);

    if (newStockLots.length > 0) {
      setLots(prevLots => [...prevLots, ...newStockLots]);
    }

    const destWarehouseName = warehouses.find(w => w.id === po.warehouseId)?.name || 'Warehouse';
    setItems(prevItems => {
      return prevItems.map(item => {
        const qtyReceivedInBatch = receivedAmounts[item.id] || 0;
        if (qtyReceivedInBatch <= 0) return item;

        const currentStockMap = { ...item.stockByWarehouse };
        const previousStock = currentStockMap[po.warehouseId] || 0;
        currentStockMap[po.warehouseId] = previousStock + qtyReceivedInBatch;

        const poLine = po.items.find(l => l.itemId === item.id);
        return {
          ...item,
          purchasePrice: poLine?.unitCost || item.purchasePrice,
          stockByWarehouse: currentStockMap
        };
      });
    });

    const newTransactions: InventoryTransaction[] = grItems.map((grLine, idx) => ({
      id: `tx-gr-${poId}-${idx}-${Date.now()}`,
      itemId: grLine.itemId,
      itemName: grLine.name,
      sku: grLine.sku,
      quantity: grLine.quantity,
      type: 'Purchase',
      referenceNumber: po.poNumber,
      warehouseId: po.warehouseId,
      warehouseName: destWarehouseName,
      date: receivedDate,
      description: `Inventory checked in (GR: ${receiptNumber}) under PO: ${po.poNumber}`
    }));
    setTransactions(prev => [...prev, ...newTransactions]);

    setPurchaseOrders(prevPO => prevPO.map(p => {
      if (p.id === poId) {
        const isAllFullyReceived = updatedPOItems.every(line => (line.receivedQuantity || 0) >= line.quantity);
        const nextStatus = isAllFullyReceived ? 'Received' : 'Issued';
        
        const history = p.statusHistory ? [...p.statusHistory] : [];
        history.push({
          status: nextStatus,
          date: receivedDate,
          note: `Logged Goods Receipt ${receiptNumber}. ${isAllFullyReceived ? 'All items in full checked-in.' : 'Partial items received.'}`,
          user: receivedBy
        });

        return {
          ...p,
          items: updatedPOItems,
          status: nextStatus,
          statusHistory: history,
          actualDeliveryDate: isAllFullyReceived ? receivedDate : undefined
        };
      }
      return p;
    }));
  };

  const handleShipSOBatch = (
    soId: string,
    receiptNumber: string,
    dispatchedBy: string,
    dispatchDate: string,
    notes: string,
    shippedAmounts: Record<string, number>
  ) => {
    const so = salesOrders.find(s => s.id === soId);
    if (!so) return;

    const drItems: { itemId: string; sku: string; name: string; quantity: number }[] = [];
    const updatedSOItems = so.items.map(line => {
      const batchQty = shippedAmounts[line.itemId] || 0;
      if (batchQty > 0) {
        const itemObj = items.find(it => it.id === line.itemId);
        drItems.push({
          itemId: line.itemId,
          sku: itemObj?.sku || 'SKU',
          name: itemObj?.name || 'Item',
          quantity: batchQty
        });
      }
      const prevShip = line.shippedQuantity || 0;
      return {
        ...line,
        shippedQuantity: prevShip + batchQty
      };
    });

    const newDR: ExplicitDeliveryReceipt = {
      id: `DR-${receiptNumber}-${Date.now()}`,
      drNumber: receiptNumber,
      soId,
      soNumber: so.soNumber,
      dispatchDate,
      dispatchedBy,
      notes,
      warehouseId: so.warehouseId,
      items: drItems
    };

    setExplicitDeliveryReceipts(prev => [...prev, newDR]);

    const srcWarehouseName = warehouses.find(w => w.id === so.warehouseId)?.name || 'Warehouse';
    
    // Register Machine Logs for delivered machines if applicable
    const newLogs: MachineLog[] = [];
    drItems.forEach((drLine) => {
      const itemObj = items.find((p) => p.id === drLine.itemId);
      const isMachine = itemObj && (
        itemObj.category?.toLowerCase().includes('equipment') ||
        itemObj.category?.toLowerCase().includes('machine') ||
        itemObj.brand?.toLowerCase() === 'caterpillar' ||
        itemObj.brand?.toLowerCase() === 'komatsu' ||
        itemObj.brand?.toLowerCase() === 'dynapac' ||
        itemObj.sku?.startsWith('HE-')
      );

      if (isMachine && itemObj) {
        for (let i = 0; i < drLine.quantity; i++) {
          const serialNum = `${itemObj.sku || 'MCH'}-SN${100000 + Math.floor(Math.random() * 900000)}`;
          const wStart = dispatchDate;
          const wEnd = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0];
          newLogs.push({
            id: `mch-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
            serialNumber: serialNum,
            model: itemObj.name,
            deliveryDate: dispatchDate,
            warrantyStart: wStart,
            warrantyEnd: wEnd,
            customerId: so.customerId || 'cust-1',
            customerName: so.customerName || 'Walk-In Customer',
            salesOrderId: so.id,
            soNumber: so.soNumber,
            status: 'Deployed',
            notes: `Registered upon partial DR delivery. Order: ${so.soNumber}, Site Depot: ${srcWarehouseName}`
          });
        }
      }
    });
    if (newLogs.length > 0) {
      setMachineLogs((prev) => [...prev, ...newLogs]);
    }

    setItems(prevItems => {
      return prevItems.map(item => {
        const qtyShippedInBatch = shippedAmounts[item.id] || 0;
        if (qtyShippedInBatch <= 0) return item;

        const currentStockMap = { ...item.stockByWarehouse };
        const previousStock = currentStockMap[so.warehouseId] || 0;
        currentStockMap[so.warehouseId] = Math.max(0, previousStock - qtyShippedInBatch);

        return {
          ...item,
          stockByWarehouse: currentStockMap
        };
      });
    });

    // Deduct from FIFO material lots
    setLots((prevLots) => {
      let updatedLots = [...prevLots];
      drItems.forEach((drLine) => {
        let remainingToDeduct = drLine.quantity;
        // Find if they selected a specific lot or if we auto-consume
        const lineInSO = so.items.find(it => it.itemId === drLine.itemId);
        if (lineInSO && lineInSO.lotId) {
          updatedLots = updatedLots.map((l) => {
            if (l.id === lineInSO.lotId) {
              const consumed = Math.min(l.quantityRemaining, remainingToDeduct);
              remainingToDeduct -= consumed;
              return { ...l, quantityRemaining: Math.max(0, l.quantityRemaining - consumed) };
            }
            return l;
          });
        }
        
        if (remainingToDeduct > 0) {
          const eligibleLots = updatedLots
            .filter(l => l.itemId === drLine.itemId && l.warehouseId === so.warehouseId && l.quantityRemaining > 0)
            .sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime());
            
          for (const targetLot of eligibleLots) {
            if (remainingToDeduct <= 0) break;
            const consumed = Math.min(targetLot.quantityRemaining, remainingToDeduct);
            remainingToDeduct -= consumed;
            updatedLots = updatedLots.map(l => l.id === targetLot.id ? { ...l, quantityRemaining: l.quantityRemaining - consumed } : l);
          }
        }
      });
      return updatedLots;
    });

    const newTransactions: InventoryTransaction[] = drItems.map((drLine, idx) => ({
      id: `tx-dr-${soId}-${idx}-${Date.now()}`,
      itemId: drLine.itemId,
      itemName: drLine.name,
      sku: drLine.sku,
      quantity: -drLine.quantity,
      type: 'Sales',
      referenceNumber: so.soNumber,
      warehouseId: so.warehouseId,
      warehouseName: srcWarehouseName,
      date: dispatchDate,
      description: `Inventory shipped & released (DR: ${receiptNumber}) under SO: ${so.soNumber}`
    }));
    setTransactions(prev => [...prev, ...newTransactions]);

    setSalesOrders(prevSO => prevSO.map(s => {
      if (s.id === soId) {
        const isAllFullyShipped = updatedSOItems.every(line => (line.shippedQuantity || 0) >= line.quantity);
        const nextStatus = isAllFullyShipped ? 'Shipped' : 'Confirmed';
        
        const history = s.statusHistory ? [...s.statusHistory] : [];
        history.push({
          status: nextStatus,
          date: dispatchDate,
          note: `Log partial parts dispatch: DR ${receiptNumber} created. ${isAllFullyShipped ? 'All items fully dispatched.' : 'Parts partially released.'}`,
          user: dispatchedBy
        });

        return {
          ...s,
          items: updatedSOItems,
          status: nextStatus,
          statusHistory: history,
          shipmentDate: isAllFullyShipped ? dispatchDate : s.shipmentDate
        };
      }
      return s;
    }));
  };

  const handleDeleteSO = (soId: string) => {
    setSalesOrders((prev) => prev.filter((so) => so.id !== soId));
  };

  const handleUpdateSalesOrder = (updatedSO: SalesOrder) => {
    setSalesOrders((prev) => prev.map((so) => so.id === updatedSO.id ? updatedSO : so));
  };

  const handleDeletePO = (poId: string) => {
    setPurchaseOrders((prev) => prev.filter((po) => po.id !== poId));
  };

  // 6. Create Customer Sales Order (Draft)
  const handleCreateSO = (newSO: Omit<SalesOrder, 'id'>) => {
    const today = new Date().toISOString().split('T')[0];
    const createdSO: SalesOrder = {
      ...newSO,
      id: `so-${Date.now()}`,
      statusHistory: [
        {
          status: 'Draft',
          date: newSO.orderDate || today,
          note: 'Sales Order drafted, allocations uncommitted.',
          user: currentUser?.name || 'Staff Member'
        }
      ]
    };

    setSalesOrders((prev) => [...prev, createdSO]);
  };

  const handleEditSO = (updatedSO: SalesOrder, isRemarkOnly?: boolean) => {
    setSalesOrders((prev) => prev.map((so) => {
      if (so.id === updatedSO.id) {
        if (isRemarkOnly) {
          return updatedSO;
        }
        const history = so.statusHistory ? [...so.statusHistory] : [
          { status: 'Draft', date: so.orderDate, note: 'Sales Order drafted.', user: 'Staff Member' }
        ];
        history.push({
          status: updatedSO.status,
          date: new Date().toISOString().split('T')[0],
          note: 'Sales Order specifications or line-item pricing modified.',
          user: currentUser?.name || 'Staff Member'
        });
        return {
          ...updatedSO,
          statusHistory: history
        };
      }
      return so;
    }));
  };

  // 7. Update Sales Order Lifecycle Status
  const handleUpdateSOStatus = (soId: string, status: SalesOrder['status']) => {
    const so = salesOrders.find((s) => s.id === soId);
    if (!so) return;

    const oldStatus = so.status;
    if (oldStatus === status) return;

    const isDeductedOld = oldStatus === 'Shipped' || oldStatus === 'On Going' || oldStatus === 'Received';
    const isDeductedNew = status === 'Shipped' || status === 'On Going' || status === 'Received';

    // Enforce lifecycle reversibility validation
    const isSoReversion = 
      (isDeductedOld && !isDeductedNew) ||
      (oldStatus === 'Confirmed' && status === 'Draft');
    
    if (isSoReversion) {
      const allowed = currentUser.role === 'Admin' || currentUser.permissions.canRevertLifecycle;
      if (!allowed) {
        alert("⚠️ ACCESS DENIED! Only administrators or authorized assigned personnel with 'Revert Lifecycle' permission can revert the status of this transaction life cycle.");
        return;
      }
    }

    const todayDate = new Date().toISOString().split('T')[0];
    let note = `Sales order status changed to ${status}.`;
    if (status === 'Confirmed') {
      note = 'Order details validated, payment terms approved, and inventory priority reserved.';
    } else if (status === 'On Going' || status === 'Shipped') {
      note = 'Order released, components dispatched, and Heavy Equipment machines on route.';
    } else if (status === 'Received') {
      note = 'Order successfully received and verified by client.';
    } else if (status === 'Cancelled') {
      note = 'Order cancelled. Inventory allocations released/restored.';
    } else if (status === 'Draft') {
      note = 'Order status reverted to local draft.';
    }

    setSalesOrders((prev) => prev.map((s) => {
      if (s.id === soId) {
        const history = s.statusHistory ? [...s.statusHistory] : [
          { status: 'Draft', date: s.orderDate, note: 'Sales Order drafted.', user: 'Staff Member' }
        ];
        history.push({
          status,
          date: todayDate,
          note,
          user: currentUser?.name || 'Staff Member'
        });
        return { ...s, status, statusHistory: history };
      }
      return s;
    }));

    // CASE A: When transitioning TO deductive state from a non-deductive state (deduct inventory)
    if (!isDeductedOld && isDeductedNew) {
      const srcWarehouseName = warehouses.find((w) => w.id === so.warehouseId)?.name || 'Fulfilling Depot';

      // Record Heavy Equipment Machine Logs for delivered machinery
      const newLogs: MachineLog[] = [];
      so.items.forEach((line) => {
        const itemObj = items.find((p) => p.id === line.itemId);
        const isMachine = itemObj && (
          itemObj.category?.toLowerCase().includes('equipment') ||
          itemObj.category?.toLowerCase().includes('machine') ||
          itemObj.brand?.toLowerCase() === 'caterpillar' ||
          itemObj.brand?.toLowerCase() === 'komatsu' ||
          itemObj.brand?.toLowerCase() === 'dynapac' ||
          itemObj.sku?.startsWith('HE-')
        );

        if (isMachine && itemObj) {
          for (let i = 0; i < line.quantity; i++) {
            const serialNum = `${itemObj.sku || 'MCH'}-SN${100000 + Math.floor(Math.random() * 900000)}`;
            const wStart = todayDate;
            const wEnd = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0]; // 2 year standard warranty
            newLogs.push({
              id: `mch-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
              serialNumber: serialNum,
              model: itemObj.name,
              deliveryDate: todayDate,
              warrantyStart: wStart,
              warrantyEnd: wEnd,
              customerId: so.customerId || 'cust-1',
              customerName: so.customerName || 'Walk-In Customer',
              salesOrderId: so.id,
              soNumber: so.soNumber,
              status: 'Deployed',
              notes: `Registered upon delivery. Order: ${so.soNumber}, Site Depot: ${srcWarehouseName}`
            });
          }
        }
      });
      if (newLogs.length > 0) {
        setMachineLogs((prev) => [...prev, ...newLogs]);
      }

      setItems((prevItems) => {
        return prevItems.map((item) => {
          const soLineOfItem = so.items.find((line) => line.itemId === item.id);
          if (!soLineOfItem) return item;

          const currentStockMap = { ...item.stockByWarehouse };
          const previousStock = currentStockMap[so.warehouseId] || 0;
          currentStockMap[so.warehouseId] = Math.max(0, previousStock - soLineOfItem.quantity);

          return {
            ...item,
            stockByWarehouse: currentStockMap
          };
        });
      });

      // Deduct from lots programmatically
      setLots((prevLots) => {
        let updatedLots = [...prevLots];
        so.items.forEach((line) => {
          let remainingToDeduct = line.quantity;

          if (line.lotId) {
            // Deduct from specified lot
            updatedLots = updatedLots.map((l) => {
              if (l.id === line.lotId) {
                const consumed = Math.min(l.quantityRemaining, remainingToDeduct);
                remainingToDeduct -= consumed;
                return { ...l, quantityRemaining: Math.max(0, l.quantityRemaining - consumed) };
               }
              return l;
            });
          }

          // If there's still quantity to deduct or no lotId was specified, use FIFO auto-allocation
          if (remainingToDeduct > 0) {
            const activeLots = updatedLots
              .filter((l) => l.itemId === line.itemId && l.warehouseId === so.warehouseId && l.quantityRemaining > 0)
              .sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime());

            for (const lot of activeLots) {
              if (remainingToDeduct <= 0) break;
              const consumed = Math.min(lot.quantityRemaining, remainingToDeduct);
              remainingToDeduct -= consumed;

              updatedLots = updatedLots.map((l) => {
                if (l.id === lot.id) {
                  return { ...l, quantityRemaining: Math.max(0, l.quantityRemaining - consumed) };
                }
                return l;
              });
            }
          }
        });
        return updatedLots;
      });

      // Record outbound transactions
      const dispatchTransactions: InventoryTransaction[] = so.items.map((line, idx) => {
        const itemObj = items.find((p) => p.id === line.itemId);
        const lotInfoText = line.lotId ? ` (Specified Lot ID: ${line.lotId})` : '';
        return {
          id: `tx-${soId}-${idx}-${Date.now()}`,
          itemId: line.itemId,
          itemName: itemObj?.name || 'Item in SO',
          sku: itemObj?.sku || 'SKU',
          quantity: -line.quantity,
          type: 'Sales',
          referenceNumber: so.soNumber,
          warehouseId: so.warehouseId,
          warehouseName: srcWarehouseName,
          date: todayDate,
          description: `Inventory dispatched for fulfilled Sales Order ${so.soNumber}${lotInfoText}`,
          lotId: line.lotId
        };
      });

      setTransactions((prev) => [...prev, ...dispatchTransactions]);
    }

    // CASE B: Reversing AWAY from deductive status to non-deductive status (Return stock, restore lots, clean machines)
    if (isDeductedOld && !isDeductedNew) {
      const srcWarehouseName = warehouses.find((w) => w.id === so.warehouseId)?.name || 'Fulfilling Depot';

      // 1. Remove Deployed Heavy Equipment Machine Logs for this SO
      setMachineLogs((prev) => prev.filter((m) => m.salesOrderId !== soId));

      // 2. Add back items stocking levels
      setItems((prevItems) => {
        return prevItems.map((item) => {
          const soLineOfItem = so.items.find((line) => line.itemId === item.id);
          if (!soLineOfItem) return item;

          const currentStockMap = { ...item.stockByWarehouse };
          const previousStock = currentStockMap[so.warehouseId] || 0;
          currentStockMap[so.warehouseId] = previousStock + soLineOfItem.quantity;

          return {
            ...item,
            stockByWarehouse: currentStockMap
          };
        });
      });

      // 3. Restore quantities to lots
      setLots((prevLots) => {
        let updatedLots = [...prevLots];
        so.items.forEach((line) => {
          let remainingToRestore = line.quantity;

          if (line.lotId) {
            updatedLots = updatedLots.map((l) => {
              if (l.id === line.lotId) {
                return { ...l, quantityRemaining: l.quantityRemaining + remainingToRestore };
              }
              return l;
            });
          } else {
            const matchingLots = updatedLots.filter(l => l.itemId === line.itemId && l.warehouseId === so.warehouseId);
            if (matchingLots.length > 0) {
              updatedLots = updatedLots.map((l) => {
                if (l.id === matchingLots[0].id) {
                  return { ...l, quantityRemaining: l.quantityRemaining + remainingToRestore };
                }
                return l;
              });
            }
          }
        });
        return updatedLots;
      });

      // 4. Record inbound reversal transactions
      const reversalTransactions: InventoryTransaction[] = so.items.map((line, idx) => {
        const itemObj = items.find((p) => p.id === line.itemId);
        return {
          id: `tx-rev-${soId}-${idx}-${Date.now()}`,
          itemId: line.itemId,
          itemName: itemObj?.name || 'Item in SO',
          sku: itemObj?.sku || 'SKU',
          quantity: line.quantity,
          type: 'Adjustment',
          referenceNumber: so.soNumber,
          warehouseId: so.warehouseId,
          warehouseName: srcWarehouseName,
          date: todayDate,
          description: `Inventory returned. Sales Order status reversed from Shipped/On Going/Received to ${status}`
        };
      });

      setTransactions((prev) => [...prev, ...reversalTransactions]);
    }
  };

  const handleBatchUpdateSOStatus = (soIds: string[], status: 'Confirmed' | 'Shipped') => {
    if (!soIds || soIds.length === 0) return;

    // Local copies to perform atomic operations over multiple transactions
    let updatedSalesOrders = [...salesOrders];
    let updatedItems = [...items];
    let updatedLots = [...lots];
    let updatedTransactions = [...transactions];
    let updatedMachineLogs = [...machineLogs];

    const todayDate = new Date().toISOString().split('T')[0];

    soIds.forEach((soId) => {
      const soIndex = updatedSalesOrders.findIndex((s) => s.id === soId);
      if (soIndex === -1) return;

      const so = updatedSalesOrders[soIndex];
      const oldStatus = so.status;
      if (oldStatus === status) return;

      // Ensure lifecycle reversibility check is satisfied
      const isSoReversion = 
        (oldStatus === 'Shipped' && status !== 'Shipped') ||
        (oldStatus === 'Confirmed' && (status as string) === 'Draft');
      
      if (isSoReversion) {
        const allowed = currentUser.role === 'Admin' || currentUser.permissions.canRevertLifecycle;
        if (!allowed) {
          alert(`⚠️ ACCESS DENIED! Cannot revert order ${so.soNumber}.`);
          return;
        }
      }

      let note = `Sales order status changed to ${status} via batch operation.`;
      if (status === 'Confirmed') {
        note = 'Order details validated and reserved in batch operation.';
      } else if (status === 'Shipped') {
        note = 'Order components dispatched and Heavy Equipment machines delivered in batch operation.';
      }

      // 1. Update SO Status & History
      const history = so.statusHistory ? [...so.statusHistory] : [
        { status: 'Draft', date: so.orderDate, note: 'Sales Order drafted.', user: 'Staff Member' }
      ];
      history.push({
        status,
        date: todayDate,
        note,
        user: currentUser?.name || 'Staff Member'
      });

      updatedSalesOrders[soIndex] = {
        ...so,
        status,
        statusHistory: history
      };

      // 2. Perform Case A (Deduction of Inventory assets when transitioning to Shipped)
      if (status === 'Shipped') {
        const srcWarehouseName = warehouses.find((w) => w.id === so.warehouseId)?.name || 'Fulfilling Depot';

        // Add Heavy Equipment Machine Logs for delivered machinery
        so.items.forEach((line) => {
          const itemObj = updatedItems.find((p) => p.id === line.itemId);
          const isMachine = itemObj && (
            itemObj.category?.toLowerCase().includes('equipment') ||
            itemObj.category?.toLowerCase().includes('machine') ||
            itemObj.brand?.toLowerCase() === 'caterpillar' ||
            itemObj.brand?.toLowerCase() === 'komatsu' ||
            itemObj.brand?.toLowerCase() === 'dynapac' ||
            itemObj.sku?.startsWith('HE-')
          );

          if (isMachine && itemObj) {
            for (let i = 0; i < line.quantity; i++) {
              const serialNum = `${itemObj.sku || 'MCH'}-SN${100000 + Math.floor(Math.random() * 900000)}`;
              const wStart = todayDate;
              const wEnd = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0]; // 2 year standard warranty
              updatedMachineLogs.push({
                id: `mch-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
                serialNumber: serialNum,
                model: itemObj.name,
                deliveryDate: todayDate,
                warrantyStart: wStart,
                warrantyEnd: wEnd,
                customerId: so.customerId || 'cust-1',
                customerName: so.customerName || 'Walk-In Customer',
                salesOrderId: so.id,
                soNumber: so.soNumber,
                status: 'Deployed',
                notes: `Registered upon batch delivery. Order: ${so.soNumber}, Site Depot: ${srcWarehouseName}`
              });
            }
          }
        });

        // Deduct from Items stockByWarehouse map
        updatedItems = updatedItems.map((item) => {
          const soLineOfItem = so.items.find((line) => line.itemId === item.id);
          if (!soLineOfItem) return item;

          const currentStockMap = { ...item.stockByWarehouse };
          const previousStock = currentStockMap[so.warehouseId] || 0;
          currentStockMap[so.warehouseId] = Math.max(0, previousStock - soLineOfItem.quantity);

          return {
            ...item,
            stockByWarehouse: currentStockMap
          };
        });

        // Deduct from Stock Lots
        so.items.forEach((line) => {
          let remainingToDeduct = line.quantity;

          if (line.lotId) {
            updatedLots = updatedLots.map((l) => {
              if (l.id === line.lotId) {
                const consumed = Math.min(l.quantityRemaining, remainingToDeduct);
                remainingToDeduct -= consumed;
                return { ...l, quantityRemaining: Math.max(0, l.quantityRemaining - consumed) };
              }
              return l;
            });
          }

          if (remainingToDeduct > 0) {
            const activeLots = updatedLots
              .filter((l) => l.itemId === line.itemId && l.warehouseId === so.warehouseId && l.quantityRemaining > 0)
              .sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime());

            for (const lot of activeLots) {
              if (remainingToDeduct <= 0) break;
              const consumed = Math.min(lot.quantityRemaining, remainingToDeduct);
              remainingToDeduct -= consumed;

              updatedLots = updatedLots.map((l) => {
                if (l.id === lot.id) {
                  return { ...l, quantityRemaining: Math.max(0, l.quantityRemaining - consumed) };
                }
                return l;
              });
            }
          }
        });

        // Generate sales accounting logs / transactions
        const dispatchTransactions: InventoryTransaction[] = so.items.map((line, idx) => {
          const itemObj = updatedItems.find((p) => p.id === line.itemId);
          const lotInfoText = line.lotId ? ` (Specified Lot ID: ${line.lotId})` : '';
          return {
            id: `tx-${soId}-${idx}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            itemId: line.itemId,
            itemName: itemObj?.name || 'Item in SO',
            sku: itemObj?.sku || 'SKU',
            quantity: -line.quantity,
            type: 'Sales',
            referenceNumber: so.soNumber,
            warehouseId: so.warehouseId,
            warehouseName: srcWarehouseName,
            date: todayDate,
            description: `Inventory batch dispatched for fulfilled Sales Order ${so.soNumber}${lotInfoText}`,
            lotId: line.lotId
          };
        });

        updatedTransactions.push(...dispatchTransactions);
      }
    });

    // Save final merged state to master states atomically
    setSalesOrders(updatedSalesOrders);
    setItems(updatedItems);
    setLots(updatedLots);
    setTransactions(updatedTransactions);
    setMachineLogs(updatedMachineLogs);
  };

  // 8. Add Warehouse site
  const handleAddWarehouse = (newWH: Omit<Warehouse, 'id'>) => {
    const createdWH: Warehouse = {
      ...newWH,
      id: `wh-${Date.now()}`
    };
    
    // Set 0 stock balances of this warehouse for existing item profiles
    setItems((prevItems) => {
      return prevItems.map((item) => ({
        ...item,
        stockByWarehouse: {
          ...item.stockByWarehouse,
          [createdWH.id]: 0
        }
      }));
    });

    setWarehouses((prev) => [...prev, createdWH]);
  };

  const handleEditWarehouse = (id: string, updated: Partial<Warehouse>) => {
    setWarehouses((prev) => prev.map((wh) => (wh.id === id ? { ...wh, ...updated } : wh)));
    triggerToast(`Warehouse details updated successfully.`, 'success', 'Warehouse Updated');
  };

  const handleDeleteWarehouse = (id: string) => {
    setWarehouses((prev) => prev.filter((wh) => wh.id !== id));
    triggerToast(`Warehouse has been deleted from site registrations.`, 'info', 'Warehouse Deleted');
  };

  // 9. Execute Direct Stock Transfer between Locations
  const handleExecuteStockTransfer = (newTransfer: Omit<StockTransfer, 'id' | 'transferNumber' | 'status'>) => {
    const transferId = `tr-${Date.now()}`;
    const transferNum = `TR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const createdTransfer: StockTransfer = {
      ...newTransfer,
      id: transferId,
      transferNumber: transferNum,
      status: 'Completed'
    };

    setTransfers((prev) => [...prev, createdTransfer]);

    // Move stock programmatically (subtract from source, add to destination)
    setItems((prevItems) => {
      return prevItems.map((item) => {
        const line = newTransfer.items.find((it) => it.itemId === item.id);
        if (!line) return item;

        const currentStockMap = { ...item.stockByWarehouse };
        const srcStock = currentStockMap[newTransfer.sourceWarehouseId] || 0;
        const destStock = currentStockMap[newTransfer.destinationWarehouseId] || 0;

        currentStockMap[newTransfer.sourceWarehouseId] = Math.max(0, srcStock - line.quantity);
        currentStockMap[newTransfer.destinationWarehouseId] = destStock + line.quantity;

        return {
          ...item,
          stockByWarehouse: currentStockMap
        };
      });
    });

    // Deduct from lots at source location and transfer to destination location
    setLots((prevLots) => {
      let updatedLots = [...prevLots];
      newTransfer.items.forEach((line) => {
        let remainingToTransfer = line.quantity;
        let lotNumberToUse = `LOT-TR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
        let dateReceivedToUse = newTransfer.transferDate || new Date().toISOString().split('T')[0];
        let expiryDateToUse: string | undefined = undefined;

        // Trace consumed lots to recreate them in destination
        const consumedLots: { lotNumber: string; quantity: number; expiryDate?: string; dateReceived: string }[] = [];

        if (line.lotId) {
          // Transfer from specified lot
          const targetLot = updatedLots.find(l => l.id === line.lotId);
          if (targetLot) {
            lotNumberToUse = targetLot.lotNumber;
            expiryDateToUse = targetLot.expiryDate;
            dateReceivedToUse = targetLot.dateReceived;
            const consumed = Math.min(targetLot.quantityRemaining, remainingToTransfer);
            remainingToTransfer -= consumed;
            consumedLots.push({ lotNumber: lotNumberToUse, quantity: consumed, expiryDate: expiryDateToUse, dateReceived: dateReceivedToUse });

            updatedLots = updatedLots.map((l) => {
              if (l.id === line.lotId) {
                return { ...l, quantityRemaining: Math.max(0, l.quantityRemaining - consumed) };
              }
              return l;
            });
          }
        }

        if (remainingToTransfer > 0) {
          // FIFO auto-allocation for remainder
          const activeLots = updatedLots
            .filter((l) => l.itemId === line.itemId && l.warehouseId === newTransfer.sourceWarehouseId && l.quantityRemaining > 0)
            .sort((a, b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime());

          for (const lot of activeLots) {
            if (remainingToTransfer <= 0) break;
            const consumed = Math.min(lot.quantityRemaining, remainingToTransfer);
            remainingToTransfer -= consumed;
            consumedLots.push({ lotNumber: lot.lotNumber, quantity: consumed, expiryDate: lot.expiryDate, dateReceived: lot.dateReceived });

            updatedLots = updatedLots.map((l) => {
              if (l.id === lot.id) {
                return { ...l, quantityRemaining: Math.max(0, l.quantityRemaining - consumed) };
              }
              return l;
            });
          }
        }

        // Now, for each consumed lot from source, add it to destination warehouse
        consumedLots.forEach((consumed) => {
          const existingDestLot = updatedLots.find(
            (l) => l.lotNumber === consumed.lotNumber && l.itemId === line.itemId && l.warehouseId === newTransfer.destinationWarehouseId
          );

          if (existingDestLot) {
            updatedLots = updatedLots.map((l) => {
              if (l.id === existingDestLot.id) {
                return {
                  ...l,
                  quantityReceived: l.quantityReceived + consumed.quantity,
                  quantityRemaining: l.quantityRemaining + consumed.quantity
                };
              }
              return l;
            });
          } else {
            const newDestLot: StockLot = {
              id: `lot-tr-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              itemId: line.itemId,
              lotNumber: consumed.lotNumber,
              warehouseId: newTransfer.destinationWarehouseId,
              quantityReceived: consumed.quantity,
              quantityRemaining: consumed.quantity,
              dateReceived: consumed.dateReceived,
              expiryDate: consumed.expiryDate,
              barcodeValue: consumed.lotNumber
            };
            updatedLots.push(newDestLot);
          }
        });
      });
      return updatedLots;
    });

    // Record separate logs: Transfer Out (source) and Transfer In (destination)
    const srcName = warehouses.find((w) => w.id === newTransfer.sourceWarehouseId)?.name || 'Source Depot';
    const destName = warehouses.find((w) => w.id === newTransfer.destinationWarehouseId)?.name || 'Destination Depot';

    const auditLogs: InventoryTransaction[] = [];
    newTransfer.items.forEach((line, idx) => {
      const itemObj = items.find((p) => p.id === line.itemId);
      if (!itemObj) return;

      // Transfer Out Log
      auditLogs.push({
        id: `tx-${transferId}-out-${idx}-${Date.now()}`,
        itemId: line.itemId,
        itemName: itemObj.name,
        sku: itemObj.sku,
        quantity: -line.quantity,
        type: 'Transfer Out',
        referenceNumber: transferNum,
        warehouseId: newTransfer.sourceWarehouseId,
        warehouseName: srcName,
        date: newTransfer.transferDate,
        description: `Stock transfer outbound dispatched to ${destName} via ${transferNum}${line.lotId ? ` (Lot ID: ${line.lotId})` : ''}`,
        lotId: line.lotId
      });

      // Transfer In Log
      auditLogs.push({
        id: `tx-${transferId}-in-${idx}-${Date.now()}`,
        itemId: line.itemId,
        itemName: itemObj.name,
        sku: itemObj.sku,
        quantity: line.quantity,
        type: 'Transfer In',
        referenceNumber: transferNum,
        warehouseId: newTransfer.destinationWarehouseId,
        warehouseName: destName,
        date: newTransfer.transferDate,
        description: `Stock transfer inbound received from ${srcName} via ${transferNum}${line.lotId ? ` (Lot ID: ${line.lotId})` : ''}`,
        lotId: line.lotId
      });
    });

    setTransactions((prev) => [...prev, ...auditLogs]);
  };


  if (!isLoggedIn) {
    return (
      <LoginPage 
        users={users} 
        onLoginEvent={handleLoginEvent} 
        onAddUser={handleAddUser}
        onEditUser={handleEditUser}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] antialiased">
      {/* SIDEBAR NAVIGATION WORKSPACE */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-350 border-r border-slate-800 shrink-0">
        
        {/* Zoho logo and title branding */}
        <div className="p-5 flex items-center gap-2.5 border-b border-slate-800">
          <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-tight leading-none block">Centralized Inventory</span>
            <span className="text-[10px] text-gray-500 font-bold block font-mono mt-0.5">Enterprise Suite</span>
          </div>
        </div>

        {/* User identification card */}
        <div className="p-4 mx-3 my-4 bg-slate-850 rounded-xl border border-slate-800 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-600/35 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
            {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-white block truncate leading-none">{currentUser.name}</span>
            <span className="text-[9px] text-gray-500 block truncate mt-1">{currentUser.role} Account</span>
            <span className="text-[10px] text-emerald-400 font-bold font-mono tracking-wider flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              <span>LOGGED IN</span>
            </span>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="flex-1 px-3 space-y-1">
          {isTabVisible('dashboard') && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Dashboard Workspace</span>
            </button>
          )}

          {isTabVisible('items') && (
            <button
              onClick={() => setActiveTab('items')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'items' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Catalog Items ({items.length})</span>
            </button>
          )}

          {isTabVisible('purchase') && (
            <button
              onClick={() => setActiveTab('purchase')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'purchase' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Purchase Orders ({purchaseOrders.length})</span>
            </button>
          )}

          {isTabVisible('sales') && (
            <button
              onClick={() => setActiveTab('sales')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'sales' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Sales Orders ({salesOrders.length})</span>
            </button>
          )}

          {isTabVisible('warehouses') && (
            <button
              onClick={() => setActiveTab('warehouses')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'warehouses' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <WHIcon className="w-4 h-4" />
              <span>Warehouse Sites ({warehouses.length})</span>
            </button>
          )}

          {isTabVisible('suppliers') && (
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Partners & Suppliers ({suppliers.length})</span>
            </button>
          )}

          {isTabVisible('customers') && (
            <button
              onClick={() => setActiveTab('customers')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'customers' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customers CRM ({customers.length})</span>
            </button>
          )}

          {isTabVisible('fifo-lots') && (
            <button
              onClick={() => setActiveTab('fifo-lots')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'fifo-lots' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Barcode className="w-4 h-4" />
              <span>FIFO Lots & Barcodes ({lots.filter(l => l.remainingQuantity > 0).length})</span>
            </button>
          )}

          {isTabVisible('user-security') && (
            <button
              onClick={() => setActiveTab('user-security')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'user-security' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>User Access Matrix ({users.length})</span>
            </button>
          )}

          {isTabVisible('reports') && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Invoicing Analytics</span>
            </button>
          )}

          {isTabVisible('tracking-hub') && (
            <button
              onClick={() => setActiveTab('tracking-hub')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'tracking-hub' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Receipts Ledger (DR & GR)</span>
            </button>
          )}

          {isTabVisible('machine-logs') && (
            <button
              onClick={() => setActiveTab('machine-logs')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'machine-logs' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Wrench className="w-4 h-4 text-amber-500" />
              <span>Heavy Machinery Logs ({machineLogs.length})</span>
            </button>
          )}

          {isTabVisible('email-logs') && (
            <button
              onClick={() => setActiveTab('email-logs')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeTab === 'email-logs' ? 'bg-indigo-600 text-white shadow-xs' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Mail className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>Email Alerts Log ({emailAlertLogs.length})</span>
            </button>
          )}
        </nav>

        {/* Reset utilities options */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold tracking-wider text-slate-100 uppercase rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>Sign Out Session</span>
          </button>

          {currentUser.role === 'Admin' && (
            <button
              onClick={handleResetData}
              className="w-full py-2 bg-[#8C0000] hover:bg-red-800 text-[10px] font-bold tracking-wider text-rose-100/90 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              RESET HARD SEED DATA
            </button>
          )}
        </div>
      </aside>

      {/* CORE WORKSPACE PANELS */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Responsive Mobile Top bar */}
        <header className="md:hidden bg-slate-900 text-white flex items-center justify-between px-4 py-3 border-b border-slate-800 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-widest font-mono">Central Inventory</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="text-[11px] font-bold bg-slate-800 text-indigo-300 border border-slate-700 rounded-md px-3 py-1.5 focus:outline-hidden cursor-pointer"
            >
              {isTabVisible('dashboard') && <option value="dashboard">Dashboard</option>}
              {isTabVisible('items') && <option value="items">Catalog Items</option>}
              {isTabVisible('purchase') && <option value="purchase">Purchase Orders</option>}
              {isTabVisible('sales') && <option value="sales">Sales Orders</option>}
              {isTabVisible('warehouses') && <option value="warehouses">Warehouses</option>}
              {isTabVisible('suppliers') && <option value="suppliers">Suppliers</option>}
              {isTabVisible('customers') && <option value="customers">Customers CRM</option>}
              {isTabVisible('fifo-lots') && <option value="fifo-lots">FIFO Lots & Barcodes</option>}
              {isTabVisible('user-security') && <option value="user-security">User Security Access</option>}
              {isTabVisible('reports') && <option value="reports">Analytics</option>}
              {isTabVisible('tracking-hub') && <option value="tracking-hub">Receipts Tracking (DR & GR)</option>}
              {isTabVisible('machine-logs') && <option value="machine-logs">Heavy Machinery Logs</option>}
            </select>

            <button
              onClick={handleLogout}
              className="p-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md border border-slate-700 hover:text-red-300 cursor-pointer text-xs flex items-center justify-center"
              title="Logout session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* CONTAINER CONTENT WRAPPER */}
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
          {activeTab === 'dashboard' && (
            <Dashboard 
              items={processedItems} 
              warehouses={warehouses} 
              purchaseOrders={purchaseOrders} 
              salesOrders={salesOrders} 
              transactions={transactions} 
              onNavigate={setActiveTab} 
            />
          )}

          {activeTab === 'items' && (
            <InventoryItems
              items={processedItems}
              warehouses={warehouses}
              transactions={transactions}
              purchaseOrders={purchaseOrders}
              currentUser={currentUser}
              onAddItem={handleAddItem}
              onEditItem={handleEditItem}
              onAdjustStock={handleAdjustStock}
              onDeleteItem={handleDeleteItem}
              suppliers={suppliers}
            />
          )}

          {activeTab === 'purchase' && (
            <PurchaseOrders
              purchaseOrders={purchaseOrders}
              items={processedItems}
              warehouses={warehouses}
              suppliers={suppliers}
              onCreatePO={handleCreatePO}
              onUpdatePOStatus={handleUpdatePOStatus}
              onReceivePOBatch={handleReceivePOBatch}
              onEditPO={handleEditPO}
              currentUser={currentUser}
              users={users}
              lots={lots}
              explicitGoodsReceipts={explicitGoodsReceipts}
              onDeletePO={handleDeletePO}
              onDeleteGoodsReceipt={handleDeleteGoodsReceipt}
            />
          )}

          {activeTab === 'suppliers' && (
            <Suppliers
              suppliers={suppliers}
              purchaseOrders={purchaseOrders}
              onAddSupplier={handleAddSupplier}
              onEditSupplier={handleEditSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              canEdit={currentUser?.role === 'Admin' || (currentUser?.permissions?.canEditSuppliers ?? false)}
            />
          )}

          {activeTab === 'sales' && (
            <SalesOrders
              salesOrders={salesOrders}
              items={processedItems}
              warehouses={warehouses}
              customers={customers}
              onCreateSO={handleCreateSO}
              onUpdateSOStatus={handleUpdateSOStatus}
              onShipSOBatch={handleShipSOBatch}
              onEditSO={handleEditSO}
              canEdit={currentUser.permissions.canEditSalesOrders}
              lots={lots}
              explicitDeliveryReceipts={explicitDeliveryReceipts}
              currentUser={currentUser}
              users={users}
              onDeleteSO={handleDeleteSO}
              machineLogs={machineLogs}
              onBatchUpdateSOStatus={handleBatchUpdateSOStatus}
              onDeleteDeliveryReceipt={handleDeleteDeliveryReceipt}
            />
          )}

          {activeTab === 'customers' && (
            <CustomerManager
              customers={customers}
              salesOrders={salesOrders}
              onAddCustomer={handleAddCustomer}
              onEditCustomer={handleEditCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              canEdit={currentUser.role === 'Admin' || currentUser.permissions.canEditSalesOrders}
              onUpdateSalesOrder={handleUpdateSalesOrder}
            />
          )}

          {activeTab === 'fifo-lots' && (
            <FifoLotsManager
              lots={lots}
              items={processedItems}
              warehouses={warehouses}
              onAddLot={handleAddLot}
              onEditLot={handleEditLot}
              onDeleteLot={handleDeleteLot}
              canEdit={currentUser.role === 'Admin' || currentUser.permissions.canAdjustStock}
              onAdjustLotStock={handleAdjustLotStock}
            />
          )}

          {activeTab === 'user-security' && (
            <UserAccessManager
              users={users}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              onChangeCurrentUser={handleChangeSimUser}
              loginSessionLogs={loginSessionLogs}
              onClearLogs={handleClearLoginLogs}
            />
          )}

          {activeTab === 'warehouses' && (
            <WarehouseManager
              warehouses={warehouses}
              items={processedItems}
              transfers={transfers}
              onAddWarehouse={handleAddWarehouse}
              onEditWarehouse={handleEditWarehouse}
              onDeleteWarehouse={handleDeleteWarehouse}
              onExecuteStockTransfer={handleExecuteStockTransfer}
              lots={lots}
              canEdit={currentUser?.role === 'Admin' || (currentUser?.permissions?.canAdjustStock ?? false)}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'reports' && (
            <Reports
              items={processedItems}
              warehouses={warehouses}
              purchaseOrders={purchaseOrders}
              salesOrders={salesOrders}
              transactions={transactions}
              suppliers={suppliers}
            />
          )}

          {activeTab === 'tracking-hub' && (
            <TrackingHub
              purchaseOrders={purchaseOrders}
              salesOrders={salesOrders}
              items={processedItems}
              warehouses={warehouses}
              suppliers={suppliers}
              lots={lots}
              explicitGoodsReceipts={explicitGoodsReceipts}
              explicitDeliveryReceipts={explicitDeliveryReceipts}
              onDeleteGoodsReceipt={handleDeleteGoodsReceipt}
              onDeleteDeliveryReceipt={handleDeleteDeliveryReceipt}
            />
          )}

          {activeTab === 'machine-logs' && (
            <MachineLogs
              machineLogs={machineLogs}
              customers={customers}
              salesOrders={salesOrders}
              onUpdateMachineLogs={setMachineLogs}
              onUpdateSalesOrders={setSalesOrders}
              canEdit={currentUser.role === 'Admin' || currentUser.permissions.canEditSalesOrders}
            />
          )}

          {activeTab === 'email-logs' && (
            <EmailAlertsHub
              emailAlertLogs={emailAlertLogs}
              items={processedItems}
              onTriggerMockAlert={handleTriggerMockAlert}
              onClearLogs={() => setEmailAlertLogs([])}
            />
          )}
        </div>
      </main>

      <ResetSetupModal
        isOpen={isResetSetupOpen}
        onClose={() => setIsResetSetupOpen(false)}
        onCompleteSetup={handleCompleteManualReset}
        onLoadDefaults={handleResetToDefaults}
      />

      {/* Dynamic Toast System Overlay */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="p-4 bg-slate-900 border border-slate-800 text-white rounded-xl shadow-xl flex gap-3 pointer-events-auto animate-in slide-in-from-right duration-300 text-left"
          >
            <span className="w-2 h-2 bg-indigo-500 rounded-full mt-1 shrink-0 animate-pulse" />
            <div className="flex-1 text-left">
              {toast.title && <strong className="block text-xs font-mono font-black text-indigo-400 uppercase tracking-widest">{toast.title}</strong>}
              <p className="text-[11px] leading-relaxed text-slate-205 mt-0.5">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-white block self-start cursor-pointer hover:bg-slate-800 px-1 py-0.5 rounded transition-colors text-[10px] font-bold"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
