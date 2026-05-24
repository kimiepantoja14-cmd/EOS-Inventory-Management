import { useState, useMemo, FormEvent, ChangeEvent, useEffect } from 'react';
import { Customer, SalesOrder, MachineLog } from '../types';
import { Wrench, Search, PlusCircle, Calendar, Shield, MapPin, Building, ChevronRight, Hash, FileLineChart, X, Edit3, Trash2, Activity, Cpu, Play, Thermometer, ShieldAlert, Download, Upload, RefreshCw } from 'lucide-react';
import { initAuth, googleSignIn, importMachineLogsFromGoogleSheets } from '../workspace';

interface MachineLogsProps {
  machineLogs: MachineLog[];
  customers: Customer[];
  salesOrders: SalesOrder[];
  onUpdateMachineLogs: (updated: MachineLog[]) => void;
  onUpdateSalesOrders?: (updated: SalesOrder[]) => void;
  canEdit: boolean;
}

export default function MachineLogs({
  machineLogs,
  customers,
  salesOrders,
  onUpdateMachineLogs,
  onUpdateSalesOrders,
  canEdit
}: MachineLogsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Google Sheets Workspace Auth and Integration States
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [sheetUrlInput, setSheetUrlInput] = useState('https://docs.google.com/spreadsheets/d/1qzRHtMRKZcOxl-_kZLRv7itAoX8MoomF5BUZ-TV5tcA/edit?gid=855032587#gid=855032587');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

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
    setSyncStatusMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setSyncStatusMsg({
        text: err.message || 'Failed to authenticate Google Account.',
        isError: true
      });
    }
  };

  const handleSyncFromGoogleSheet = async () => {
    if (!googleToken) {
      alert("Please connect your Google Account first.");
      return;
    }

    if (!sheetUrlInput.trim()) {
      alert("Please enter a valid Google Sheet URL.");
      return;
    }

    setIsSyncingSheet(true);
    setSyncStatusMsg(null);

    try {
      const importedLogs = await importMachineLogsFromGoogleSheets(sheetUrlInput, customers);
      if (importedLogs.length === 0) {
        setSyncStatusMsg({
          text: "No valid rows was found in the Google Sheet.",
          isError: true
        });
        setIsSyncingSheet(false);
        return;
      }

      // Merge by serialNumber, overwriting duplicates
      const mergedMap = new Map<string, MachineLog>();
      machineLogs.forEach(log => {
        mergedMap.set(log.serialNumber, log);
      });
      importedLogs.forEach(log => {
        mergedMap.set(log.serialNumber, log);
      });

      onUpdateMachineLogs(Array.from(mergedMap.values()));
      setSyncStatusMsg({
        text: `Successfully synced/merged ${importedLogs.length} machinery logs from Google Sheet!`,
        isError: false
      });
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncStatusMsg({
        text: `Sync Failed: ${err.message}`,
        isError: true
      });
    } finally {
      setIsSyncingSheet(false);
    }
  };
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('All');
  const [selectedWarrantyStatus, setSelectedWarrantyStatus] = useState<string>('All');
  const [selectedClassification, setSelectedClassification] = useState<string>('All');
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState<MachineLog | null>(null);
  const [activeTab, setActiveTab] = useState<'registry' | 'soTracker'>('registry');
  const [soLinkFilter, setSoLinkFilter] = useState<'all' | 'linked' | 'pending'>('all');
  const [soStatusFilter, setSoStatusFilter] = useState<string>('all');

  // Interactive Sales Order subject & partsRequired inline editing states
  const [editingSO, setEditingSO] = useState<SalesOrder | null>(null);
  const [soSubject, setSoSubject] = useState('');
  const [soPartsRequired, setSoPartsRequired] = useState('');

  // Telemetry interactive simulation states
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [simulatedHours, setSimulatedHours] = useState<number>(420);
  const [simulatedRPM, setSimulatedRPM] = useState<number>(1850);
  const [simulatedTemp, setSimulatedTemp] = useState<number>(84);
  const [submittingRepairNote, setSubmittingRepairNote] = useState('');

  // Form states
  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [warrantyStart, setWarrantyStart] = useState(new Date().toISOString().split('T')[0]);
  const [warrantyEnd, setWarrantyEnd] = useState(() => {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 2); // 2 years default
    return end.toISOString().split('T')[0];
  });
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formSalesOrderId, setFormSalesOrderId] = useState('');
  const [formStatus, setFormStatus] = useState<MachineLog['status']>('Operational');
  const [formClassification, setFormClassification] = useState<'Service Campaign' | 'Core Product'>('Core Product');
  const [warrantyStatus, setWarrantyStatus] = useState<MachineLog['warrantyStatus']>('warranty/primecare');
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');
  const [machineLocation, setMachineLocation] = useState('');

  // NEW Heavy Machinery Field States
  const [warrantyPeriod, setWarrantyPeriod] = useState('');
  const [unitWarranty, setUnitWarranty] = useState('');
  const [unitPrimecare, setUnitPrimecare] = useState('');
  const [currentSmr, setCurrentSmr] = useState('');
  const [updateDate, setUpdateDate] = useState('');
  const [lastPmsAndHourMeter, setLastPmsAndHourMeter] = useState('');
  const [region, setRegion] = useState('');
  const [remarks, setRemarks] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [updatedCustomerContact, setUpdatedCustomerContact] = useState('');

  // Derived stats
  const stats = useMemo(() => {
    const total = machineLogs.length;
    const operational = machineLogs.filter(l => l.status === 'Operational' || l.status === 'Deployed').length;
    const breakdown = machineLogs.filter(l => l.status === 'Breakdown' || l.status === 'Warranty Claim').length;
    const problem = machineLogs.filter(l => l.status === 'Operational with Problem' || l.status === 'Active Maintenance').length;
    
    // Calculate active warranties (warrantyEnd > today)
    const todayStr = new Date().toISOString().split('T')[0];
    const underWarranty = machineLogs.filter(l => l.warrantyEnd >= todayStr).length;

    return { total, operational, breakdown, problem, underWarranty };
  }, [machineLogs]);

  // Filtering logs
  const filteredLogs = useMemo(() => {
    return machineLogs.filter(log => {
      const matchSearch = 
        log.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = selectedStatus === 'All' || log.status === selectedStatus;
      const matchCustomer = selectedCustomer === 'All' || log.customerId === selectedCustomer;
      const matchWarranty = selectedWarrantyStatus === 'All' || (log.warrantyStatus || 'Warranty/Primecare') === selectedWarrantyStatus;
      const matchClassification = selectedClassification === 'All' || (log.classification || 'Core Product') === selectedClassification;

      return matchSearch && matchStatus && matchCustomer && matchWarranty && matchClassification;
    });
  }, [machineLogs, searchTerm, selectedStatus, selectedCustomer, selectedWarrantyStatus, selectedClassification]);

  const filteredSalesOrders = useMemo(() => {
    return salesOrders.filter(so => {
      const linkedLogs = machineLogs.filter(log => log.salesOrderId === so.id || log.soNumber === so.soNumber);
      const isLinked = linkedLogs.length > 0;

      const matchesSearch = 
        so.soNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        so.customerName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCustomer = selectedCustomer === 'All' || so.customerId === selectedCustomer;

      const matchesLink = 
        soLinkFilter === 'all' ||
        (soLinkFilter === 'linked' && isLinked) ||
        (soLinkFilter === 'pending' && !isLinked);

      const matchesStatus = soStatusFilter === 'all' || so.status.toLowerCase() === soStatusFilter.toLowerCase();

      return matchesSearch && matchesCustomer && matchesLink && matchesStatus;
    });
  }, [salesOrders, machineLogs, searchTerm, selectedCustomer, soLinkFilter, soStatusFilter]);

  const handleOpenAdd = () => {
    setSerialNumber(`SN-${Math.floor(100000 + Math.random() * 900000)}`);
    setModel('');
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setWarrantyStart(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    setWarrantyEnd(d.toISOString().split('T')[0]);
    setFormCustomerId(customers[0]?.id || '');
    setFormSalesOrderId('');
    setFormStatus('Operational');
    setFormClassification('Core Product');
    setWarrantyStatus('warranty/primecare');
    setNotes('');
    setDescription('');
    setMachineLocation('');
    setWarrantyPeriod('');
    setUnitWarranty('');
    setUnitPrimecare('');
    setCurrentSmr('');
    setUpdateDate('');
    setLastPmsAndHourMeter('');
    setRegion('');
    setRemarks('');
    setContactPerson('');
    setContactNo('');
    setUpdatedCustomerContact('');
    setEditingLog(null);
    setShowAddLogModal(true);
  };

  const handleOpenEdit = (log: MachineLog) => {
    setEditingLog(log);
    setSerialNumber(log.serialNumber);
    setModel(log.model);
    setDeliveryDate(log.deliveryDate);
    setWarrantyStart(log.warrantyStart);
    setWarrantyEnd(log.warrantyEnd);
    setFormCustomerId(log.customerId);
    setFormSalesOrderId(log.salesOrderId || '');
    setFormStatus(log.status);
    setFormClassification(log.classification || 'Core Product');
    setWarrantyStatus(log.warrantyStatus || 'warranty/primecare');
    setNotes(log.notes || '');
    setDescription(log.description || '');
    setMachineLocation(log.machineLocation || '');
    setWarrantyPeriod(log.warrantyPeriod || '');
    setUnitWarranty(log.unitWarranty || '');
    setUnitPrimecare(log.unitPrimecare || '');
    setCurrentSmr(log.currentSmr !== undefined ? String(log.currentSmr) : '');
    setUpdateDate(log.updateDate || '');
    setLastPmsAndHourMeter(log.lastPmsAndHourMeter || '');
    setRegion(log.region || '');
    setRemarks(log.remarks || '');
    setContactPerson(log.contactPerson || '');
    setContactNo(log.contactNo || '');
    setUpdatedCustomerContact(log.updatedCustomerContact || '');
    setShowAddLogModal(true);
  };

  const handleOpenAddForSO = (so: SalesOrder) => {
    setSerialNumber(`SN-${Math.floor(100000 + Math.random() * 900000)}`);
    setModel('');
    setDeliveryDate(so.shipmentDate || new Date().toISOString().split('T')[0]);
    setWarrantyStart(so.shipmentDate || new Date().toISOString().split('T')[0]);
    const d = so.shipmentDate ? new Date(so.shipmentDate) : new Date();
    d.setFullYear(d.getFullYear() + 2);
    setWarrantyEnd(d.toISOString().split('T')[0]);
    setFormCustomerId(so.customerId || '');
    setFormSalesOrderId(so.id);
    setFormStatus('Operational');
    setFormClassification('Core Product');
    setWarrantyStatus('warranty/primecare');
    setNotes(`Delivered via Sales Order ref ${so.soNumber}.`);
    setDescription('');
    setMachineLocation('');
    setWarrantyPeriod('');
    setUnitWarranty('');
    setUnitPrimecare('');
    setCurrentSmr('');
    setUpdateDate('');
    setLastPmsAndHourMeter('');
    setRegion(so.region || '');
    setRemarks('');
    setContactPerson('');
    setContactNo('');
    setUpdatedCustomerContact('');
    setEditingLog(null);
    setShowAddLogModal(true);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!serialNumber || !model || !formCustomerId) {
      alert('Please fill out all required fields.');
      return;
    }

    const selectedCust = customers.find(c => c.id === formCustomerId);
    const customerNm = selectedCust ? selectedCust.name : 'Unknown Customer';
    const chosenSO = salesOrders.find(s => s.id === formSalesOrderId);
    const soNumText = chosenSO ? chosenSO.soNumber : 'N/A';

    const cleanSmrNum = currentSmr.trim() !== '' ? parseFloat(currentSmr) : undefined;

    if (editingLog) {
      // Update
      const updated = machineLogs.map(l => {
        if (l.id === editingLog.id) {
          return {
            ...l,
            serialNumber,
            model,
            deliveryDate,
            warrantyStart,
            warrantyEnd,
            customerId: formCustomerId,
            customerName: customerNm,
            salesOrderId: formSalesOrderId,
            soNumber: soNumText,
            status: formStatus,
            classification: formClassification,
            warrantyStatus,
            notes,
            description,
            machineLocation,
            
            // New heavy machinery fields
            warrantyPeriod,
            unitWarranty,
            unitPrimecare,
            currentSmr: cleanSmrNum,
            updateDate,
            lastPmsAndHourMeter,
            region,
            remarks,
            contactPerson,
            contactNo,
            updatedCustomerContact
          };
        }
        return l;
      });
      onUpdateMachineLogs(updated);
    } else {
      // Create
      const newLog: MachineLog = {
        id: `mch-${Date.now()}`,
        serialNumber,
        model,
        deliveryDate,
        warrantyStart,
        warrantyEnd,
        customerId: formCustomerId,
        customerName: customerNm,
        salesOrderId: formSalesOrderId,
        soNumber: soNumText,
        status: formStatus,
        classification: formClassification,
        warrantyStatus,
        notes,
        description,
        machineLocation,
        
        // New heavy machinery fields
        warrantyPeriod,
        unitWarranty,
        unitPrimecare,
        currentSmr: cleanSmrNum,
        updateDate,
        lastPmsAndHourMeter,
        region,
        remarks,
        contactPerson,
        contactNo,
        updatedCustomerContact
      };
      onUpdateMachineLogs([...machineLogs, newLog]);
    }
    setShowAddLogModal(false);
  };

  const handleOpenEditSO = (so: SalesOrder) => {
    setEditingSO(so);
    setSoSubject(so.subject || '');
    setSoPartsRequired(so.partsRequired || '');
  };

  const handleSaveSOFields = (e: FormEvent) => {
    e.preventDefault();
    if (!editingSO || !onUpdateSalesOrders) return;

    const updated = salesOrders.map(s => {
      if (s.id === editingSO.id) {
        return {
          ...s,
          subject: soSubject,
          partsRequired: soPartsRequired
        };
      }
      return s;
    });

    onUpdateSalesOrders(updated);
    setEditingSO(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to remove this delivered heavy equipment log?')) {
      const remaining = machineLogs.filter(l => l.id !== id);
      onUpdateMachineLogs(remaining);
    }
  };

  // Helper to parse CSV properly supporting quotes
  const parseCSV = (text: string) => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentVal = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentVal.trim());
        lines.push(row);
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    if (currentVal || row.length > 0) {
      row.push(currentVal.trim());
      lines.push(row);
    }
    return lines;
  };

  const handleExportCSV = () => {
    if (machineLogs.length === 0) {
      alert("No machine logs to export.");
      return;
    }

    const csvHeaders = [
      'id',
      'serialNumber',
      'model',
      'deliveryDate',
      'warrantyStart',
      'warrantyEnd',
      'customerId',
      'customerName',
      'salesOrderId',
      'soNumber',
      'status',
      'notes',
      'description',
      'machineLocation',
      'warrantyStatus',
      'classification'
    ];

    const escapeCSVCell = (val: any) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      csvHeaders.join(','),
      ...machineLogs.map(log => 
        csvHeaders.map(h => escapeCSVCell((log as any)[h])).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `machinery_fleet_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const lines = parseCSV(text);
        if (lines.length < 2) {
          alert("CSV file seems to be empty or has invalid format.");
          return;
        }

        const csvHeaders = lines[0].map(h => h.trim().toLowerCase());
        
        const getIdxWithAlts = (keys: string[]) => {
          for (const k of keys) {
            const targetClean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            const idx = csvHeaders.findIndex(h => {
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
          alert("Required columns 'serialNumber' (or 'SERIAL NO.') and 'model' must be present in the CSV header.");
          return;
        }

        const importedLogs: MachineLog[] = [];
        const todayStr = new Date().toISOString().split('T')[0];

        const getDefaultWarrantyEnd = (startStr: string) => {
          const d = new Date(startStr);
          if (isNaN(d.getTime())) return todayStr;
          d.setFullYear(d.getFullYear() + 2);
          return d.toISOString().split('T')[0];
        };

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i];
          if (row.length === 0 || (row.length === 1 && !row[0])) continue;

          const rawSN = row[serialNumberIdx]?.trim();
          if (!rawSN) continue;

          const rawModel = row[modelIdx]?.trim() || 'Unknown Model';
          const rawId = idIdx !== -1 && row[idIdx]?.trim() ? row[idIdx].trim() : `mch-${Date.now()}-${i}`;
          
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
          const validStatuses = ['Operational', 'Breakdown', 'Operational with Problem', 'Other', 'Deployed', 'Active Maintenance', 'Warranty Claim', 'Retired'];
          if (!validStatuses.includes(rawStatus)) {
            rawStatus = 'Operational';
          }

          let rawClassification = classificationIdx !== -1 ? row[classificationIdx]?.trim() : 'Core Product';
          if (rawClassification !== 'Service Campaign' && rawClassification !== 'Core Product') {
            rawClassification = 'Core Product';
          }

          let rawWarrantyStatus = warrantyStatusIdx !== -1 ? row[warrantyStatusIdx]?.trim() : 'warranty/primecare';
          const validWarrStatuses = ['warranty/primecare', 'non-warranty/primecare', 'non-warranty/non-primecacre', 'warranty/non-primecare'];
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

          const newLog: MachineLog = {
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

          importedLogs.push(newLog);
        }

        if (importedLogs.length === 0) {
          alert("No valid rows were parsed from the CSV.");
          return;
        }

        // Merge by serialNumber: keep existing list but overwrite duplicates
        const mergedMap = new Map<string, MachineLog>();
        machineLogs.forEach(log => {
          mergedMap.set(log.serialNumber, log);
        });
        importedLogs.forEach(log => {
          mergedMap.set(log.serialNumber, log);
        });

        onUpdateMachineLogs(Array.from(mergedMap.values()));
        alert(`Successfully imported/merged ${importedLogs.length} machinery logs!`);
        e.target.value = '';
      } catch (err: any) {
        alert("Failed to parse CSV: " + err.message);
      }
    };

    reader.readAsText(file);
  };

  // Helper: check warranty percentage remaining
  const getWarrantyInfo = (start: string, end: string) => {
    const today = new Date().getTime();
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    
    if (today > endTime) {
      return {
        label: 'Warranty Expired',
        percent: 0,
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200',
        barClass: 'bg-rose-500',
      };
    }
    if (today < startTime) {
      return {
        label: 'Inactive Warranty',
        percent: 0,
        badgeClass: 'bg-slate-100 text-slate-800 border border-slate-200',
        barClass: 'bg-slate-300',
      };
    }

    const totalDuration = endTime - startTime;
    if (totalDuration <= 0) {
      return {
        label: 'Warranty Expired',
        percent: 0,
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200',
        barClass: 'bg-rose-500',
      };
    }

    const elapsed = today - startTime;
    const percent = Math.min(
      105,
      Math.max(0, Math.floor((elapsed / totalDuration) * 100)),
    );
    const remainingPercent = Math.max(0, 100 - percent);
    const label = `${remainingPercent}% remaining`;
    
    let badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    let barClass = 'bg-emerald-500';
    
    if (remainingPercent <= 20) {
      badgeClass = 'bg-rose-100 text-rose-800 border border-rose-200';
      barClass = 'bg-rose-500';
    } else if (remainingPercent <= 50) {
      badgeClass = 'bg-amber-100 text-amber-800 border border-amber-200';
      barClass = 'bg-amber-500';
    }
    
    return { label, percent: remainingPercent, badgeClass, barClass };
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-500 animate-spin-slow" />
            <span>Heavy Machinery Delivered Fleet Tracker</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Maintain permanent mechanical logs, lifecycle warranties, and status records for all client-delivered equipment.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap items-center gap-2">
          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            title="Export all machinery logs to CSV"
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs text-white rounded-lg transition-all border border-slate-700/60 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {/* Import CSV input button */}
          {canEdit && (
            <label
              title="Import machinery logs from CSV"
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs text-white rounded-lg transition-all border border-slate-700/60 cursor-pointer shadow-sm relative"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span>Import CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="sr-only"
              />
            </label>
          )}

          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white rounded-lg transition-all shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Log Machinery Delivery</span>
            </button>
          )}
        </div>
      </div>

      {/* GOOGLE SHEETS SYNC CONTROL BAR */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>Google Sheets Machinery Log Streamer</span>
            </h3>
            <p className="text-[10px] text-slate-500">
              {googleUser ? `Connected as ${googleUser.email}` : 'Sync real-time logs from your Google spreadsheets securely'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-2xl justify-end">
          {googleUser ? (
            <>
              <input
                type="text"
                placeholder="Google Spreadsheet URL..."
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white flex-1 min-w-[200px] text-slate-800 shadow-xs"
              />
              <button
                onClick={handleSyncFromGoogleSheet}
                disabled={isSyncingSheet}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 font-bold text-xs text-white rounded-lg transition-all shadow-xs cursor-pointer min-w-[120px]"
              >
                {isSyncingSheet ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Sync Now</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-white hover:bg-slate-50 font-bold text-xs text-slate-700 hover:text-slate-950 rounded-lg transition-all border border-slate-300 shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>Connect Google Sheets</span>
            </button>
          )}
        </div>
      </div>

      {syncStatusMsg && (
        <div className={`p-3 text-xs rounded-lg whitespace-pre-wrap leading-normal ${syncStatusMsg.isError ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
          {syncStatusMsg.text}
        </div>
      )}

      {/* METRIC BENTO CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider uppercase">Fleet Registered</span>
          <span className="text-2xl font-bold text-slate-900 mt-2">{stats.total} units</span>
          <span className="text-[10px] text-indigo-600 font-semibold mt-1">Permanently cataloged</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider uppercase">Operational</span>
          <span className="text-2xl font-bold text-emerald-600 mt-2">{stats.operational} units</span>
          <span className="text-[10px] text-emerald-500 font-semibold mt-1">Running cleanly</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider uppercase">Operational with Problem</span>
          <span className="text-2xl font-bold text-amber-600 mt-2">{stats.problem} units</span>
          <span className="text-[10px] text-amber-500 font-semibold mt-1">Needs attention</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider uppercase">Breakdown</span>
          <span className="text-2xl font-bold text-rose-600 mt-2">{stats.breakdown} units</span>
          <span className="text-[10px] text-rose-500 font-semibold mt-1">Out of order</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 font-mono tracking-wider uppercase">Warranty Active</span>
          <span className="text-2xl font-bold text-blue-600 mt-2">{stats.underWarranty} units</span>
          <span className="text-[10px] text-blue-500 font-semibold mt-1">Secured coverage</span>
        </div>
      </div>

      {/* Tabs navigation for mechanical fleet or associated sales orders */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('registry')}
          className={`px-5 py-3 text-xs font-bold font-sans transition-all border-b-2 tracking-wide cursor-pointer uppercase ${
            activeTab === 'registry'
              ? 'border-indigo-600 text-indigo-700 font-extrabold bg-indigo-50/20'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Machinery Fleet Registry
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('soTracker')}
          className={`px-5 py-3 text-xs font-bold font-sans transition-all border-b-2 tracking-wide cursor-pointer uppercase flex items-center gap-2 ${
            activeTab === 'soTracker'
              ? 'border-indigo-600 text-indigo-700 font-extrabold bg-indigo-50/20'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>Fleet Sales Orders Tracker</span>
          <span className="bg-indigo-100 text-indigo-700 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
            {salesOrders.filter(so => machineLogs.some(log => log.salesOrderId === so.id || log.soNumber === so.soNumber)).length} Linked
          </span>
        </button>
      </div>
      {activeTab === 'registry' ? (
        <>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 xl:grid-cols-5 gap-4 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Serial, Model or Customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white text-xs border border-slate-200 rounded-lg shadow-2xs focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-2 bg-white text-xs border border-slate-200 rounded-lg shadow-2xs focus:outline-hidden font-medium text-slate-700"
              >
                <option value="All">All Statuses</option>
                <option value="Operational">Operational</option>
                <option value="Breakdown">Breakdown</option>
                <option value="Operational with Problem">Operational with Problem</option>
                <option value="Other">Other</option>
                <option value="Deployed">Deployed (Legacy)</option>
                <option value="Active Maintenance">Active Maintenance (Legacy)</option>
                <option value="Warranty Claim">Warranty Claim (Legacy)</option>
                <option value="Retired">Retired (Legacy)</option>
              </select>
            </div>

            {/* Classification Filters */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Log Type:</span>
              <select
                value={selectedClassification}
                onChange={(e) => setSelectedClassification(e.target.value)}
                className="w-full p-2 bg-white text-xs border border-slate-200 rounded-lg shadow-2xs focus:outline-hidden font-medium text-slate-700"
              >
                <option value="All">All Types</option>
                <option value="Service Campaign">Service Campaign</option>
                <option value="Core Product">Core Product</option>
              </select>
            </div>

            {/* Customer Filters */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Client:</span>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full p-2 bg-white text-xs border border-slate-200 rounded-lg shadow-2xs focus:outline-hidden font-medium text-slate-700"
              >
                <option value="All">All Customers</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Warranty Filters */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Warranty:</span>
              <select
                value={selectedWarrantyStatus}
                onChange={(e) => setSelectedWarrantyStatus(e.target.value)}
                className="w-full p-2 bg-white text-xs border border-slate-200 rounded-lg shadow-2xs focus:outline-hidden font-medium text-slate-700"
              >
                <option value="All">All Warranty Programs</option>
                <option value="Warranty/Primecare">warranty/primecare</option>
                <option value="Non-Warranty/Primecare">non-warranty/primecare</option>
                <option value="Non-Warranty/Non-Primecacre">non-warranty/non-primecare</option>
                <option value="Warranty/Non-Primecare">warranty/non-primecare</option>
              </select>
            </div>

            {/* Results Info */}
            <div className="text-right text-xs text-slate-400 italic xl:col-span-1 md:col-span-4">
              Showing {filteredLogs.length} of {machineLogs.length} registry logs
            </div>
          </div>

          {/* MAIN REGISTRY CARDS VIEW */}
          {filteredLogs.length === 0 ? (
            <div className="py-12 bg-white rounded-xl border border-slate-200 border-dashed text-center">
              <Wrench className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
              <p className="text-sm font-semibold text-slate-600 mt-2">No heavy equipment matching filter was found.</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting search parameters or log a new delivery manual entry.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className={`${selectedMachineId ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} space-y-4 text-left`}>
                <div className={`grid grid-cols-1 ${selectedMachineId ? 'md:grid-cols-1 xl:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'} gap-6`}>
                  {filteredLogs.map(log => {
                const warInfo = getWarrantyInfo(log.warrantyStart, log.warrantyEnd);
                return (
                  <div
                    key={log.id}
                    onClick={() => {
                      setSelectedMachineId(log.id);
                      setSimulatedHours(Math.floor(310 + (log.serialNumber.charCodeAt(4) || 6) * 28));
                      setSimulatedRPM(log.status.includes('Breakdown') ? 0 : 1800 + Math.floor(Math.random() * 200));
                      setSimulatedTemp(log.status.includes('Breakdown') ? 32 : 76 + Math.floor(Math.random() * 12));
                      setSubmittingRepairNote('');
                    }}
                    className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col cursor-pointer text-left relative ${
                      selectedMachineId === log.id
                        ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md transform scale-[1.01]'
                        : 'border-slate-200 shadow-2xs hover:shadow-xs hover:border-indigo-100'
                    }`}
                  >
                    {/* Selector indicator dot */}
                    {selectedMachineId === log.id && (
                      <span className="absolute top-0 left-0 right-0 h-1 bg-indigo-500 animate-pulse" />
                    )}
                    {/* Visual Header */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 tracking-wider font-mono block">SERIAL NO</span>
                        <span className="text-xs font-bold text-slate-700 font-mono tracking-tight block truncate">
                          {log.serialNumber}
                        </span>
                      </div>
                      <div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight inline-block ${
                          log.status === 'Operational' || log.status === 'Deployed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          log.status === 'Operational with Problem' || log.status === 'Active Maintenance' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          log.status === 'Breakdown' || log.status === 'Warranty Claim' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                    </div>

                    {/* Model and Details */}
                    <div className="p-5 flex-1 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-snug">
                          {log.model}
                        </h3>
                        <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                            Heavy Machinery
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold font-mono border ${
                            (log.classification || 'Core Product') === 'Service Campaign'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-teal-50 text-teal-700 border-teal-200'
                          }`}>
                            {log.classification || 'Core Product'}
                          </span>
                          <span className="text-[9px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-md font-medium font-mono">
                            {log.warrantyStatus || 'Warranty/Primecare'}
                          </span>
                        </div>
                      </div>

                      {/* Customer Block info */}
                      <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-100">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">Customer: <b className="text-slate-700">{log.customerName}</b></span>
                        </div>
                        {log.soNumber && log.soNumber !== 'N/A' && (
                          <div className="flex flex-col gap-1 text-[10px] text-slate-500 font-medium bg-indigo-50/45 p-2 rounded-lg border border-indigo-150">
                            <div className="flex items-center gap-1.5 font-extrabold text-indigo-900 font-mono text-[10.5px]">
                              <FileLineChart className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>ACTIVE S.O. REF: {log.soNumber}</span>
                            </div>
                            <p className="text-[9.5px] text-indigo-950 font-normal leading-relaxed text-left">
                              Active sales order associated for live troubleshooting, repairs, maintenance support, or warranty diagnostic notes.
                            </p>
                          </div>
                        )}
                        {log.machineLocation && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0 animate-bounce" />
                            <span>Location: <b className="text-indigo-805 font-bold">{log.machineLocation}</b></span>
                          </div>
                        )}
                      </div>

                      {/* Warranty Meter */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-400 font-semibold font-mono">WARRANTY LIFE</span>
                          <span className={`px-2 py-0.5 rounded-md font-bold font-mono text-[9px] border shadow-2xs ${warInfo.badgeClass}`}>
                            {warInfo.label}
                          </span>
                        </div>

                        {/* Progress slider */}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${warInfo.barClass}`}
                            style={{ width: `${warInfo.percent}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[9px] text-slate-400 font-semibold font-mono leading-none">
                          <span>ST: {log.warrantyStart}</span>
                          <span>ED: {log.warrantyEnd}</span>
                        </div>
                      </div>

                      {log.description && (
                        <div className="text-[11px] font-medium text-slate-700 leading-relaxed font-sans bg-slate-100/50 p-2.5 border-l-2 border-slate-500 rounded-r-lg">
                          <span className="text-[9px] font-bold text-slate-500 tracking-wider font-mono block uppercase mb-0.5">Description & Context</span>
                          {log.description}
                        </div>
                      )}

                      {log.notes && (
                        <div className="text-[11px] text-slate-500 leading-relaxed font-sans bg-amber-50/40 p-2 border-l-2 border-amber-300 rounded-r-lg">
                          <span className="text-[9px] font-bold text-amber-600/90 tracking-wider font-mono block uppercase mb-0.5">Repair & Remarks</span>
                          {log.notes}
                        </div>
                      )}
                    </div>

                    {/* Card Action Controls */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-2">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        <span>Delivered: {log.deliveryDate}</span>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEdit(log)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit log entry"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
                </div>
              </div>

              {/* Right Column: Beautiful Interactive Diagnostics Panel */}
              {selectedMachineId && (() => {
                const activeLog = machineLogs.find(l => l.id === selectedMachineId);
                if (!activeLog) return null;
                const warInfo = getWarrantyInfo(activeLog.warrantyStart, activeLog.warrantyEnd);

                // Quick dispatch handlers
                const changeMachineLocation = (newLoc: string) => {
                  const updated = machineLogs.map(l => {
                    if (l.id === activeLog.id) {
                      return { ...l, machineLocation: newLoc };
                    }
                    return l;
                  });
                  onUpdateMachineLogs(updated);
                };

                // Operating state modifiers
                const updateStatus = (newSt: MachineLog['status'], remarks: string) => {
                  const updated = machineLogs.map(l => {
                    if (l.id === activeLog.id) {
                      const existingNotes = l.notes || '';
                      const timestamp = new Date().toLocaleString();
                      return {
                        ...l,
                        status: newSt,
                        notes: `[SYSTEM: ${timestamp}] Status updated to ${newSt}. ${remarks}\n` + existingNotes
                      };
                    }
                    return l;
                  });
                  onUpdateMachineLogs(updated);
                };

                // Diagnostics flow
                const handleRunSelfDiagnostics = () => {
                  setIsDiagnosticRunning(true);
                  setTimeout(() => {
                    setIsDiagnosticRunning(false);
                    const isSuccess = Math.random() > 0.35;
                    const logRem = isSuccess 
                      ? 'Self-check pass. Cylinders OK, oil pressure 142 PSI, manifold balanced.'
                      : 'Self-check failed. Minor carbon build-up in cylinder 3, combustion fluctuation logged.';
                    updateStatus(isSuccess ? 'Operational' : 'Operational with Problem', logRem);
                    if (isSuccess) {
                      setSimulatedTemp(81);
                      setSimulatedRPM(1900);
                    } else {
                      setSimulatedTemp(98);
                    }
                    alert(`🔬 Diagnostic Self-Test Complete!\nReport: ${logRem}`);
                  }, 1100);
                };

                // Simulate Breakdown
                const handleSimulateBreakdown = () => {
                  setSimulatedRPM(0);
                  setSimulatedTemp(32);
                  updateStatus('Breakdown', 'Engine breakdown simulation triggered. Operator reported mechanical stall.');
                };

                // Add manual operator note
                const handleNoteSubmit = (e: FormEvent) => {
                  e.preventDefault();
                  if (!submittingRepairNote.trim()) return;
                  const updated = machineLogs.map(l => {
                    if (l.id === activeLog.id) {
                      const existingNotes = l.notes || '';
                      const stamp = new Date().toLocaleString();
                      return {
                        ...l,
                        notes: `📝 [Operator Log - ${stamp}] ${submittingRepairNote}\n` + existingNotes
                      };
                    }
                    return l;
                  });
                  onUpdateMachineLogs(updated);
                  setSubmittingRepairNote('');
                };

                // Increment hour simulator
                const incrementHours = (amount: number) => {
                  setSimulatedHours(prev => prev + amount);
                };

                return (
                  <div className="lg:col-span-5 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col font-sans animate-in slide-in-from-right duration-250 text-left text-slate-105">
                    {/* Header bar */}
                    <div className="p-4 bg-slate-955/85 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-sans">
                        <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 font-mono tracking-widest block uppercase">Telemetry Control Deck</span>
                          <span className="text-xs font-black text-slate-100 font-mono">{activeLog.serialNumber}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedMachineId(null)}
                        className="p-1 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Close Deck"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Operational Details & Simulated Stats */}
                    <div className="p-5 space-y-6 flex-1 overflow-y-auto max-h-[85vh]">
                      {/* Equipment Model Name */}
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-35 tracking-tight">{activeLog.model}</h4>
                        <div className="flex gap-2 font-sans">
                          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{activeLog.customerName}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-[10px] text-slate-350 font-mono font-bold uppercase tracking-wider">{activeLog.warrantyStatus}</span>
                        </div>
                      </div>

                      {/* Expanded Specification Details Grid */}
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3.5 text-xs font-sans">
                        <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase font-mono">SPECIFICATIONS & LIFETIME METRICS</span>
                          <span className="text-[9px] text-slate-500 font-bold font-mono">ID: {activeLog.id}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block tracking-wider uppercase font-mono">WARRANTY PERIOD</span>
                            <span className="text-slate-200 font-medium">{activeLog.warrantyPeriod || "Generic (2 Years)"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block tracking-wider uppercase font-mono">CURRENT SMR</span>
                            <span className="text-amber-400 font-bold font-mono text-[11px]">{activeLog.currentSmr !== undefined ? `${activeLog.currentSmr} Hrs` : "None Registered"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block tracking-wider uppercase font-mono">UNIT WARRANTY TYPE</span>
                            <span className="text-slate-200 font-medium">{activeLog.unitWarranty || "Standard Warranty"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block tracking-wider uppercase font-mono">UNIT PRIMECARE TYPE</span>
                            <span className="text-slate-200 font-medium">{activeLog.unitPrimecare || "Standard PrimeCare"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block tracking-wider uppercase font-mono">UPDATE DATE</span>
                            <span className="text-slate-205 font-mono text-[11px]">{activeLog.updateDate || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block tracking-wider uppercase font-mono">REGION</span>
                            <span className="text-slate-200 font-semibold">{activeLog.region || "Internal Registry"}</span>
                          </div>
                        </div>

                        <div className="border-t border-slate-850 pt-2.5 space-y-2">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block tracking-wider uppercase font-mono">LAST PMS & HOUR METER</span>
                            <span className="text-slate-300 font-semibold font-mono text-[11px]">{activeLog.lastPmsAndHourMeter || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 block tracking-wider uppercase font-mono">REMARKS / SPECS</span>
                            <p className="text-slate-400 text-[11px] leading-relaxed italic pr-2">{activeLog.remarks || "No active metadata comments."}</p>
                          </div>
                        </div>

                        {/* Customer Live Contacts */}
                        <div className="border-t border-slate-850 pt-2.5 space-y-2">
                          <span className="text-[9px] font-extrabold text-teal-400 tracking-wider uppercase font-mono block">PRIMARY FIELD CONTACT INFORMATION</span>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-[8px] font-bold text-slate-500 block uppercase">CONTACT REPRESENTATIVE</span>
                              <span className="text-slate-200 font-medium truncate block">{activeLog.contactPerson || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-[8px] font-bold text-slate-500 block uppercase">TELEPHONE / HOTLINE</span>
                              <span className="text-slate-200 font-mono font-bold truncate block">{activeLog.contactNo || "N/A"}</span>
                            </div>
                          </div>
                          {activeLog.updatedCustomerContact && (
                            <div>
                              <span className="text-[8px] font-bold text-slate-500 block uppercase">UPDATED CUSTOMER CONTACT LOG</span>
                              <span className="text-teal-300 font-mono text-[10.5px] font-semibold break-all block">{activeLog.updatedCustomerContact}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Equipment Dispatch Relocation Hubs */}
                      <div className="space-y-2 bg-slate-955/30 p-4 rounded-xl border border-slate-850">
                        <span className="text-[10px] font-bold text-slate-400 tracking-widest font-mono block uppercase">Active Logistics Location Relocation</span>
                        <div className="text-[11px] text-slate-400 mb-1 leading-snug">Type custom location of the machine to relocate and log re-assignment:</div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter new active location..."
                            value={activeLog.machineLocation || ''}
                            onChange={(e) => changeMachineLocation(e.target.value)}
                            className="flex-1 p-2 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:border-indigo-500 focus:outline-hidden text-slate-200 font-sans"
                          />
                        </div>
                      </div>

                      {/* Live journal note submission form */}
                      <form onSubmit={handleNoteSubmit} className="space-y-2 pt-2 border-t border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 tracking-widest font-mono block uppercase animate-pulse font-bold">Submit Shift Remark / Diagnostic Event</span>
                        <textarea
                          placeholder="Type maintenance actions, oil checks, or breakdown details..."
                          rows={2}
                          value={submittingRepairNote}
                          onChange={(e) => setSubmittingRepairNote(e.target.value)}
                          className="w-full p-2 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:border-indigo-500 focus:outline-hidden text-slate-100 font-sans"
                        />
                        <button
                          type="submit"
                          disabled={!submittingRepairNote.trim()}
                          className="w-full py-1.5 bg-slate-800 hover:bg-slate-750 disabled:bg-slate-905 font-mono font-bold text-[10px] uppercase rounded-lg border border-slate-700 hover:border-slate-605 disabled:border-slate-850 text-slate-200 disabled:text-slate-600 transition-all cursor-pointer font-extrabold"
                        >
                          ✔ Commit Journal Remark
                        </button>
                      </form>

                      {/* Repair Remarks & Logs History */}
                      <div className="space-y-2 pt-2 border-t border-slate-800 text-left">
                        <span className="text-[10px] font-bold text-slate-400 tracking-widest font-mono block uppercase">Real-Time Maintenance Journal History</span>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-slate-300 font-mono text-[10px] leading-relaxed">
                          {activeLog.notes ? (
                            activeLog.notes.split('\n').filter(Boolean).map((nLine, nIdx) => (
                              <div key={nIdx} className="p-2 bg-slate-950/50 rounded-lg border border-slate-800 text-left">
                                {nLine}
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-500 italic py-2 text-[10px]">No historical diagnostic log comments compiled yet.</div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      ) : (
        /* FLEET SALES ORDERS TRACKER VIEW */
        <>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Client or SO #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white text-xs border border-slate-200 rounded-lg shadow-2xs focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* Link status filter */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Linkage:</span>
              <select
                value={soLinkFilter}
                onChange={(e) => setSoLinkFilter(e.target.value as 'all' | 'linked' | 'pending')}
                className="w-full p-2 bg-white text-xs border border-slate-200 rounded-lg shadow-2xs focus:outline-hidden font-medium"
              >
                <option value="all">All Sales Orders</option>
                <option value="linked">Registered Machines Only</option>
                <option value="pending">Pending Machine Registration</option>
              </select>
            </div>

            {/* Customer Filters */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Client:</span>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full p-2 bg-white text-xs border border-slate-200 rounded-lg shadow-2xs focus:outline-hidden font-medium"
              >
                <option value="All">All Customers</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Sales Order Status filter */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap font-mono">SO Status:</span>
              <select
                value={soStatusFilter}
                onChange={(e) => setSoStatusFilter(e.target.value)}
                className="w-full p-2 bg-white text-xs border border-slate-200 rounded-lg shadow-2xs focus:outline-hidden font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Total count */}
            <div className="text-right text-xs text-slate-400 italic">
              Showing {filteredSalesOrders.length} of {salesOrders.length} Sales Orders
            </div>
          </div>

          {filteredSalesOrders.length === 0 ? (
            <div className="py-12 bg-white rounded-xl border border-slate-200 border-dashed text-center">
              <FileLineChart className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
              <p className="text-sm font-semibold text-slate-600 mt-2">No matching Sales Orders found.</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting order or customer search parameters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSalesOrders.map(so => {
                const linkedLogs = machineLogs.filter(log => log.salesOrderId === so.id || log.soNumber === so.soNumber);
                const hasLinked = linkedLogs.length > 0;

                return (
                  <div key={so.id} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 hover:border-indigo-150 transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: SO Main info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-mono">
                            {so.soNumber}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                            so.status === 'Shipped' ? 'bg-green-100 text-green-800' :
                            so.status === 'Confirmed' ? 'bg-sky-100 text-sky-800' :
                            so.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            SO {so.status}
                          </span>
                          {so.region && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {so.region}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          {so.customerName}
                        </h4>
                        <div className="text-[11px] text-slate-400 font-medium flex items-center gap-2">
                          <span>Ordered: {so.orderDate}</span>
                          <span>•</span>
                          <span>Est. Delivery: {so.shipmentDate || 'N/A'}</span>
                        </div>

                        {/* Interactive metadata tags for Subject and Parts Required */}
                        <div className="space-y-1.5 pt-2 max-w-xs md:max-w-md">
                          <div className="text-left bg-slate-50 border border-slate-100 rounded-lg p-2 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors">
                            <span className="text-[8px] font-extrabold text-indigo-500 font-mono block tracking-wider uppercase">Order Subject / Coverage</span>
                            <span className="text-[11px] text-slate-700 font-medium">{so.subject || "No Contract Subject Registered"}</span>
                          </div>

                          <div className="text-left bg-emerald-50/40 border border-emerald-100 rounded-lg p-2 hover:bg-emerald-50/80 hover:border-emerald-200 transition-colors">
                            <span className="text-[8px] font-extrabold text-emerald-600 font-mono block tracking-wider uppercase">Parts Required</span>
                            <span className="text-[11px] text-slate-700 font-mono font-bold">{so.partsRequired || "No critical replacement parts designated"}</span>
                          </div>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditSO(so)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-wider mt-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Update Order Specs</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Middle: Linked machinery status of this SO */}
                      <div className="flex-1 max-w-md bg-slate-50 border border-slate-100 rounded-lg p-3">
                        <div className="text-[9px] font-extrabold text-slate-400 font-mono tracking-wider uppercase mb-1.5">
                          Registered Fleet Units ({linkedLogs.length})
                        </div>
                        {hasLinked ? (
                          <div className="space-y-2">
                            {linkedLogs.map(log => {
                              const wInfo = getWarrantyInfo(log.warrantyStart, log.warrantyEnd);
                              return (
                                <div key={log.id} className="flex items-center justify-between gap-2 text-xs">
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-800 block truncate">{log.model}</span>
                                    <span className="font-mono text-[10px] text-slate-400 block max-w-xs truncate">
                                      SN: {log.serialNumber} • <span className="text-indigo-600 font-sans font-bold">{log.status}</span>
                                    </span>
                                  </div>
                                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0 border shadow-2xs ${wInfo.badgeClass}`}>
                                    {wInfo.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-amber-650 font-medium py-1">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                            <span>No fleet machinery registered for this shipment yet</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="text-right flex flex-col items-end justify-center min-w-[120px] space-y-2">
                        <span className="text-sm font-bold text-slate-900 font-mono">
                          ₱{so.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>

                        {canEdit && (
                          <div className="flex flex-col gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => handleOpenAddForSO(so)}
                              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-all shadow-3xs cursor-pointer w-full text-center"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Register Machine</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditSO(so)}
                              className="flex items-center justify-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg transition-all cursor-pointer w-full text-center"
                            >
                              <Edit3 className="w-3 h-3 text-slate-400" />
                              <span>Edit SO Info</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* DETAILED DIALOG MODAL */}
      {showAddLogModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden w-full max-w-2xl flex flex-col animate-fade-in">
            {/* Modal Title Banner */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold tracking-tight">
                {editingLog ? 'Modify Heavy Equipment Tracking Log' : 'Configure New Equipment Delivery Check'}
              </h3>
              <button
                onClick={() => setShowAddLogModal(false)}
                className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 flex flex-col">
              <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-2 text-left">
                
                {/* SECTION 1: CORE DETAILS */}
                <div className="space-y-4">
                  <span className="text-[10px] font-black text-indigo-600 tracking-wider uppercase block border-b border-indigo-50 pb-1">1. Core Machinery Details</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Serial Number */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        SERIAL NUMBER *
                      </label>
                      <input
                        type="text"
                        required
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden font-mono"
                        placeholder="e.g. CAT320-994112"
                      />
                    </div>

                    {/* Model */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        MODEL NAME *
                      </label>
                      <input
                        type="text"
                        required
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                        placeholder="e.g. Caterpillar 320 Hydraulic Excavator"
                      />
                    </div>
                  </div>

                  {/* Linked Customer Selection */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                      TAGGED REGISTERED CUSTOMER *
                    </label>
                    <select
                      value={formCustomerId}
                      onChange={(e) => setFormCustomerId(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                    >
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sales Order Referencing & classification */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        LINK TO SALES ORDER (OPTIONAL)
                      </label>
                      <select
                        value={formSalesOrderId}
                        onChange={(e) => setFormSalesOrderId(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden font-mono"
                      >
                        <option value="">-- No linked sales order --</option>
                        {salesOrders.map(s => (
                          <option key={s.id} value={s.id}>{s.soNumber} ({s.customerName})</option>
                        ))}
                      </select>
                    </div>

                    {/* Status Selection */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        TRACKING STATUS *
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as MachineLog['status'])}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
                      >
                        <option value="Operational">Operational</option>
                        <option value="Breakdown">Breakdown</option>
                        <option value="Operational with Problem">Operational with Problem</option>
                        <option value="Other">Other</option>
                        <option value="Deployed">Deployed & Active (Legacy)</option>
                        <option value="Active Maintenance">Active Maintenance (Legacy)</option>
                        <option value="Warranty Claim">Warranty Claim (Legacy)</option>
                        <option value="Retired">Retired / Out of Service (Legacy)</option>
                      </select>
                    </div>

                    {/* Classification */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        CLASSIFICATION *
                      </label>
                      <select
                        value={formClassification}
                        onChange={(e) => setFormClassification(e.target.value as 'Service Campaign' | 'Core Product')}
                        className="w-full text-xs p-2.5 bg-indigo-50 border border-indigo-100 font-bold text-indigo-700 rounded-lg focus:outline-hidden"
                      >
                        <option value="Core Product">Core Product</option>
                        <option value="Service Campaign">Service Campaign</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: WARRANTY TERMS */}
                <div className="space-y-4 pt-1">
                  <span className="text-[10px] font-black text-indigo-600 tracking-wider uppercase block border-b border-indigo-50 pb-1">2. Warranty & Service coverage</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Warranty Period */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        WARRANTY PERIOD RANGE
                      </label>
                      <input
                        type="text"
                        value={warrantyPeriod}
                        onChange={(e) => setWarrantyPeriod(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                        placeholder="e.g. 24 Months / 2000 Hrs"
                      />
                    </div>

                    {/* Warranty Status Combinations */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        WARRANTY / PRIMECARE COVERAGE CODES
                      </label>
                      <select
                        value={warrantyStatus}
                        onChange={(e) => setWarrantyStatus(e.target.value as any)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-[1px] focus:outline-indigo-500 font-semibold text-slate-800"
                      >
                        <option value="warranty/primecare">warranty/primecare</option>
                        <option value="non-warranty/primecare">non-warranty/primecare</option>
                        <option value="non-warranty/non-primecacre">non-warranty/non-primecare</option>
                        <option value="warranty/non-primecare">warranty/non-primecare</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Unit Warranty */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        UNIT WARRANTY TYPE
                      </label>
                      <input
                        type="text"
                        value={unitWarranty}
                        onChange={(e) => setUnitWarranty(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                        placeholder="e.g. Full Machinery Standard"
                      />
                    </div>

                    {/* Unit Primecare */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        UNIT PRIMECARE TYPE
                      </label>
                      <input
                        type="text"
                        value={unitPrimecare}
                        onChange={(e) => setUnitPrimecare(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                        placeholder="e.g. Primecare Plus"
                      />
                    </div>
                  </div>

                  {/* Timeline Dates */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Delivery Date */}
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 tracking-wider block mb-1">
                        DELIVERY DATE
                      </label>
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Warranty Start */}
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 tracking-wider block mb-1">
                        WARRANTY START
                      </label>
                      <input
                        type="date"
                        value={warrantyStart}
                        onChange={(e) => setWarrantyStart(e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Warranty End */}
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 tracking-wider block mb-1">
                        WARRANTY EXPIRY
                      </label>
                      <input
                        type="date"
                        value={warrantyEnd}
                        onChange={(e) => setWarrantyEnd(e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: FIELD SMR & METRICS */}
                <div className="space-y-4 pt-1">
                  <span className="text-[10px] font-black text-indigo-600 tracking-wider uppercase block border-b border-indigo-50 pb-1">3. Field Operations & Telemetry SMR</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Current SMR */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        CURRENT SMR (ENGINE METRIC HOURS)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={currentSmr}
                        onChange={(e) => setCurrentSmr(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden font-mono"
                        placeholder="e.g. 1500"
                      />
                    </div>

                    {/* Update Date */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        UPDATE DATE LOG
                      </label>
                      <input
                        type="text"
                        value={updateDate}
                        onChange={(e) => setUpdateDate(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                        placeholder="e.g. 2026-05-18"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Last PMS & Hour Meter */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        LAST PMS & HOUR METER STATUS
                      </label>
                      <input
                        type="text"
                        value={lastPmsAndHourMeter}
                        onChange={(e) => setLastPmsAndHourMeter(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                        placeholder="e.g. 250H PMS"
                      />
                    </div>

                    {/* Region */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        REGION CODE
                      </label>
                      <input
                        type="text"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                        placeholder="e.g. NCR / Luzon South"
                      />
                    </div>
                  </div>

                  {/* Machine Location */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                      CURRENT FIELD / DEPLOYMENT JOBSITE LOCATION
                    </label>
                    <input
                      type="text"
                      value={machineLocation}
                      onChange={(e) => setMachineLocation(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-[1px] focus:outline-indigo-500 font-semibold"
                      placeholder="e.g. Batangas Petrochemical Complex Block 4"
                    />
                  </div>
                </div>

                {/* SECTION 4: CLIENT CONTACT CONTROLS */}
                <div className="space-y-4 pt-1">
                  <span className="text-[10px] font-black text-indigo-600 tracking-wider uppercase block border-b border-indigo-50 pb-1">4. Secondary Customer Contacts</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Contact Person */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        PRIMARY CONTACT REPRESENTATIVE
                      </label>
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden"
                        placeholder="e.g. Mr. Arthur Pendelton"
                      />
                    </div>

                    {/* Contact No */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                        TELEPHONE NO. / DIRECT CELL
                      </label>
                      <input
                        type="text"
                        value={contactNo}
                        onChange={(e) => setContactNo(e.target.value)}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden font-mono"
                        placeholder="e.g. +63-911-394-4921"
                      />
                    </div>
                  </div>

                  {/* Updated Customer Contact */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                      UPDATED CUSTOMER CONTACT METADATA LOGS
                    </label>
                    <input
                      type="text"
                      value={updatedCustomerContact}
                      onChange={(e) => setUpdatedCustomerContact(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden font-mono"
                      placeholder="e.g. arthur.p@company.com"
                    />
                  </div>
                </div>

                {/* SECTION 5: NOTES & REMARKS */}
                <div className="space-y-4 pt-1">
                  <span className="text-[10px] font-black text-indigo-600 tracking-wider uppercase block border-b border-indigo-50 pb-1">5. Remarks & Diagnostic History</span>
                  
                  {/* Metadata Remarks */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                      FLEET DATABASE REMARKS / NOTES
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden h-16 resize-none"
                      placeholder="Describe high-level structural notes, bucket specs, or primecare tiers..."
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                      LOG DESCRIPTION
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden h-20 resize-none"
                      placeholder="Add descriptions about delivery status or telemetry records..."
                    />
                  </div>

                  {/* Remarks/Notes */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider block mb-1">
                      JOURNAL COMMENTS & LIVE REPAIR REMARKS
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden h-20 resize-none"
                      placeholder="Juan dela Cruz: Delivered via sales order reference..."
                    />
                  </div>
                </div>

              </div>

              {/* Buttons controls */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setShowAddLogModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg shadow-xs cursor-pointer"
                >
                  {editingLog ? 'Update Registry' : 'Save Delivery Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SALES ORDER INTERACTIVE CONFIGURE MODAL */}
      {editingSO && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden w-full max-w-lg flex flex-col animate-fade-in">
            {/* Modal Title Banner */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Interactive Sales Order Specs Builder</h3>
                <p className="text-[10px] text-indigo-300 font-mono font-bold mt-0.5">SO #: {editingSO.soNumber}</p>
              </div>
              <button
                onClick={() => setEditingSO(null)}
                className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSOFields} className="p-6 space-y-4 text-left">
              <div>
                <label className="text-[10.5px] font-black text-slate-600 block mb-1 uppercase tracking-wider">
                  CUSTOMER ACQUISITION & SHIPMENT REPRESENTATIVE
                </label>
                <div className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-700 font-semibold mb-2">
                  {editingSO.customerName}
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-black text-indigo-700 block mb-1 uppercase tracking-wider">
                  CONTRACT SUBJECT / SCOPE OF DISPATCH *
                </label>
                <input
                  type="text"
                  required
                  value={soSubject}
                  onChange={(e) => setSoSubject(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-[1px] focus:outline-indigo-500"
                  placeholder="e.g. Caterpillar 320 Dispatch with Primecare Warranty Package"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-black text-emerald-700 block mb-1 uppercase tracking-wider font-mono">
                  PARTS AND ADDITIONAL ACCESSORIES ATTACHED (IF ANY)
                </label>
                <textarea
                  value={soPartsRequired}
                  onChange={(e) => setSoPartsRequired(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-hidden h-24 resize-none"
                  placeholder="e.g. 1x Excavator Bucket Tip, 2x Fluid Filters, 1x Spare Drive Belt"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSO(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg shadow-xs cursor-pointer"
                >
                  Save Contract Specs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
