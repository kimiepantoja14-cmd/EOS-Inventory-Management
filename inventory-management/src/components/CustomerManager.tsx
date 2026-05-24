/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import { Customer, SalesOrder } from '../types';
import { Search, Plus, User, Mail, Phone, MapPin, Tag, ShieldCheck, Edit3, Trash2, X, CheckCircle, Ban, Briefcase, Download, Printer, QrCode, Camera, RefreshCw, Upload } from 'lucide-react';
import jsQR from 'jsqr';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerManagerProps {
  customers: Customer[];
  salesOrders: SalesOrder[];
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  canEdit: boolean;
  onUpdateSalesOrder?: (order: SalesOrder) => void;
}

export default function CustomerManager({
  customers,
  salesOrders,
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer,
  canEdit,
  onUpdateSalesOrder
}: CustomerManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [focusedCustomer, setFocusedCustomer] = useState<Customer | null>(customers[0] || null);

  // States for comments entry in audit panels
  const [tempCommentText, setTempCommentText] = useState<Record<string, string>>({});
  const [tempCommentUser, setTempCommentUser] = useState<Record<string, string>>({});

  // States for filtering Focused Customer's Historical Sales Orders
  const [soSearch, setSoSearch] = useState('');
  const [soStatusFilter, setSoStatusFilter] = useState<'All' | 'Draft' | 'Confirmed' | 'Shipped' | 'Cancelled'>('All');
  const [expandedAuditSOId, setExpandedAuditSOId] = useState<string | null>(null);

  // Reset SO filters when focused customer changes
  useEffect(() => {
    setSoSearch('');
    setSoStatusFilter('All');
    setExpandedAuditSOId(null);
    setAuditLogSearch({});
    setAuditLogSortBy({});
    setAuditLogSortDir({});
  }, [focusedCustomer?.id]);

  // Hidden file input reference for CSV Corporate Clients parsing
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for interactive notifications, inline scanner controls, and media stream
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const qrImageInputRef = useRef<HTMLInputElement>(null);
  const [auditLogSearch, setAuditLogSearch] = useState<Record<string, string>>({});
  const [auditLogSortBy, setAuditLogSortBy] = useState<Record<string, 'date' | 'status'>>({});
  const [auditLogSortDir, setAuditLogSortDir] = useState<Record<string, 'asc' | 'desc'>>({});
  const [expandedAuditRowId, setExpandedAuditRowId] = useState<string | null>(null);
  const [auditLogDensity, setAuditLogDensity] = useState<Record<string, 'compact' | 'comfortable'>>({});
  const [temporaryRemarks, setTemporaryRemarks] = useState<Record<string, string>>({});

  // Auto-expire notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Real-time camera stream parsing for QR scanner with robust cascading fallback
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let animationFrameId: number | null = null;
    let scanThrottleTimeout: any = null;

    if (isScanning) {
      setScanError(null);

      const startCamera = (constraints: MediaStreamConstraints) => {
        return navigator.mediaDevices.getUserMedia(constraints)
          .then((stream) => {
            activeStream = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
              videoRef.current.play().catch((err) => {
                console.error('Video play failed:', err);
                setScanError('Could not start camera preview playback.');
              });
            }

            // Frame extraction canvas
            const scanCanvas = document.createElement('canvas');
            const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });

            const tick = () => {
              if (!videoRef.current || !ctx || !isScanning) return;

              if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const width = videoRef.current.videoWidth;
                const height = videoRef.current.videoHeight;
                scanCanvas.width = width;
                scanCanvas.height = height;
                ctx.drawImage(videoRef.current, 0, 0, width, height);

                const imageData = ctx.getImageData(0, 0, width, height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'dontInvert',
                });

                if (code && code.data) {
                  const decodedText = code.data.trim();
                  playScanBeep();
                  setSoSearch(decodedText);

                  // Auto match and expand sales order
                  const matchedSO = salesOrders
                    .filter(so => so.customerId === focusedCustomer?.id)
                    .find(so => so.soNumber.toLowerCase() === decodedText.toLowerCase() || so.id === decodedText);

                  if (matchedSO) {
                    setExpandedAuditSOId(matchedSO.id);
                    setNotification({
                      message: `QR Scanned: Found Order ${matchedSO.soNumber}!`,
                      type: 'success',
                    });
                  } else {
                    setNotification({
                      message: `QR Scanned value loaded: "${decodedText}"`,
                      type: 'success',
                    });
                  }

                  // Stop scanner
                  setIsScanning(false);
                  return;
                }
              }

              // Continue loop with a throttle of roughly 150ms to keep frames CPU efficient
              scanThrottleTimeout = setTimeout(() => {
                animationFrameId = requestAnimationFrame(tick);
              }, 150);
            };

            // Start scanning loop
            animationFrameId = requestAnimationFrame(tick);
          });
      };

      // Try environment facing camera first, cascading down to any default video hardware
      startCamera({ video: { facingMode: 'environment' } })
        .catch((err) => {
          console.warn('Fallback constraint retry due to:', err);
          return startCamera({ video: true });
        })
        .catch((err) => {
          console.error('Camera capture error final:', err);
          setScanError('Webcam/Camera hardware not detected or browser device request is occupied. Feel free to upload a QR barcode image or search manually below!');
        });
    }

    return () => {
      // Clean up and stop camera streams strictly
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (scanThrottleTimeout) {
        clearTimeout(scanThrottleTimeout);
      }
    };
  }, [isScanning, focusedCustomer?.id, salesOrders]);

  // Modal open triggers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Forms
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tin: '',
    status: 'Active' as 'Active' | 'Inactive'
  });

  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    tin: '',
    status: 'Active' as 'Active' | 'Inactive'
  });

  // KPI Statistics
  const totalCount = customers.length;
  const activeCount = customers.filter(c => c.status === 'Active').length;
  
  const getCustomerStats = (customerId: string) => {
    const orders = salesOrders.filter(so => so.customerId === customerId);
    const totalVolume = orders.reduce((sum, so) => sum + so.total, 0);
    return {
      orderCount: orders.length,
      totalVolume
    };
  };

  const globalTotalVolume = salesOrders.reduce((sum, so) => sum + so.total, 0);

  // Filtered customers
  const filteredCustomers = customers.filter(cust => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      cust.name.toLowerCase().includes(term) ||
      cust.email.toLowerCase().includes(term) ||
      cust.phone.toLowerCase().includes(term) ||
      (cust.tin && cust.tin.toLowerCase().includes(term));
    
    const matchesStatus = statusFilter === 'All' || cust.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const headers = [
      'Customer ID',
      'Name',
      'Email',
      'Phone',
      'Address',
      'TIN',
      'Status',
      'Total Volume (PHP)',
      'Orders/Jobs Count'
    ];

    const rows = filteredCustomers.map(cust => {
      const stats = getCustomerStats(cust.id);
      const escape = (val: string | number) => {
        const text = String(val).replace(/"/g, '""');
        return `"${text}"`;
      };

      return [
        escape(cust.id),
        escape(cust.name),
        escape(cust.email),
        escape(cust.phone || ''),
        escape(cust.address || ''),
        escape(cust.tin || ''),
        escape(cust.status),
        stats.totalVolume,
        stats.orderCount
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = searchTerm || statusFilter !== 'All'
      ? `customers_filtered_${timestamp}.csv`
      : `customers_all_${timestamp}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAuditLogCSV = (so: SalesOrder) => {
    const logs = ((so.statusHistory && so.statusHistory.length > 0) ? so.statusHistory : [
      { status: 'Draft' as const, date: so.orderDate || 'Created Date', note: 'Sales order record drafted inside CRM pipeline.', user: 'Sales Rep' }
    ]);
    const query = (auditLogSearch[so.id] || '').trim().toLowerCase();
    
    // Filter
    let processed = logs.filter((log) => {
      if (!query) return true;
      return (
        log.status.toLowerCase().includes(query) ||
        log.note.toLowerCase().includes(query) ||
        (log.user || '').toLowerCase().includes(query) ||
        log.date.toLowerCase().includes(query)
      );
    });

    // Sort
    const sortBy = auditLogSortBy[so.id] || 'date';
    const sortDir = auditLogSortDir[so.id] || 'desc';
    processed = [...processed].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else {
        comparison = a.date.localeCompare(b.date);
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    // Build CSV Content
    const csvRows = [
      ['Status', 'Transition Date / Timestamp', 'Audit Remarks & Comments', 'Registered Officer / Operator'],
      ...processed.map(log => [
        log.status,
        log.date,
        log.note,
        log.user || 'N/A'
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + csvRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Audit_Log_${so.soNumber}_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setNotification({
      message: `Exported Audit Log for ${so.soNumber} successfully!`,
      type: 'success'
    });
  };

  const handleCSVBatchImport = (e: React.ChangeEvent<HTMLInputElement>, soId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        if (!csvText) return;

        const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length <= 1) {
          alert("The CSV file is empty or contains only headers.");
          return;
        }

        // Read headers
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const statusIdx = headers.indexOf('status');
        const dateIdx = headers.indexOf('date');
        const noteIdx = headers.indexOf('note');
        const userIdx = headers.indexOf('user');

        const importedEntries: any[] = [];
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(val => val.trim().replace(/^["']|["']$/g, ''));
          if (row.length === 0 || row[0] === '') continue;

          const statusValue = statusIdx !== -1 && row[statusIdx] ? row[statusIdx] : 'Audit';
          const dateValue = dateIdx !== -1 && row[dateIdx] ? row[dateIdx] : nowStr;
          const noteValue = noteIdx !== -1 && row[noteIdx] ? row[noteIdx] : row.join(' ');
          const userValue = userIdx !== -1 && row[userIdx] ? row[userIdx] : 'Batch Importer';

          importedEntries.push({
            status: statusValue,
            date: dateValue,
            note: noteValue,
            user: userValue
          });
        }

        if (importedEntries.length === 0) {
          alert("Could not extract any valid audit records from CSV.");
          return;
        }

        const matchedSO = salesOrders.find(s => s.id === soId);
        if (matchedSO) {
          const updatedHistory = [...(matchedSO.statusHistory || []), ...importedEntries];
          const updatedSO = {
            ...matchedSO,
            statusHistory: updatedHistory as any
          };
          if (onUpdateSalesOrder) {
            onUpdateSalesOrder(updatedSO);
            setNotification({
              message: `Successfully batch-imported ${importedEntries.length} audit log entries from CSV!`,
              type: 'success'
            });
          } else {
            matchedSO.statusHistory = updatedHistory as any;
            setNotification({
              message: `Imported ${importedEntries.length} log transactions (Local Mode).`,
              type: 'success'
            });
          }
        }
      } catch (err: any) {
        alert(`⚠️ CSV Import Error: ${err.message || err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset uploader input
  };

  // Handler for manual QR code image uploads
  const handleQrImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setScanError('Failed to initialize 2D decoding canvas context.');
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            const decodedText = code.data.trim();
            playScanBeep();
            setSoSearch(decodedText);

            // Auto match and expand sales order
            const matchedSO = salesOrders
              .filter(so => so.customerId === focusedCustomer?.id)
              .find(so => so.soNumber.toLowerCase() === decodedText.toLowerCase() || so.id === decodedText);

            if (matchedSO) {
              setExpandedAuditSOId(matchedSO.id);
              setNotification({
                message: `QR Processed from Image: Found Order ${matchedSO.soNumber}!`,
                type: 'success',
              });
            } else {
              setNotification({
                message: `QR code parsed: "${decodedText}"`,
                type: 'success',
              });
            }
            setIsScanning(false);
          } else {
            setScanError('Could not detect a valid QR code in the uploaded image. Please ensure sufficient contrast, high resolution, and minimal blur.');
          }
        } catch (err) {
          console.error('Error scanning uploaded QR image:', err);
          setScanError('An error occurred while processing the QR image. Make sure it is a valid image format.');
        } finally {
          e.target.value = '';
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Helper inside CustomerManager to play a custom decoded sweep tone
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // high pure frequency pitch
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.start();
      setTimeout(() => {
        osc.stop();
        audioCtx.close();
      }, 150);
    } catch (e) {
      console.warn('Scan beep audio feedback could not initialize:', e);
    }
  };

  // CSV Import handler for corporate customer profiles
  const handleImportCustomersCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      if (lines.length <= 1) return;

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let curVal = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(curVal.trim());
            curVal = '';
          } else {
            curVal += char;
          }
        }
        result.push(curVal.trim());
        return result;
      };

      let addedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCSVLine(line);
        if (cols.length >= 3) {
          // If imported from output, index 1 is Name, 2 is Email, 3 is Phone, 4 is Address, 5 is TIN, 6 is Status
          const name = cols[1];
          const email = cols[2];
          const phone = cols[3] || '';
          const address = cols[4] || '';
          const tin = cols[5] || '';
          const status = (cols[6] === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive';

          if (name) {
            onAddCustomer({
              name,
              email: email || `${name.toLowerCase().replace(/\s+/g, '')}@corp-import.ph`,
              phone,
              address,
              tin,
              status
            });
            addedCount++;
          }
        }
      }

      setNotification({ message: `Successfully parsed CSV & registered ${addedCount} corporate profiles.`, type: 'success' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // CSV Export handler for selected corporate account's sales orders in PHP currency
  const handleExportSelectedCustomerOrdersCSV = () => {
    if (!focusedCustomer) return;
    const orders = salesOrders.filter(so => so.customerId === focusedCustomer.id);
    if (orders.length === 0) {
      setNotification({ message: 'No registered orders found to export for this account.', type: 'error' });
      return;
    }

    const headers = [
      'Sales Order Reference',
      'Order Date',
      'Shipment Date',
      'Status',
      'Subtotal (PHP ₱)',
      'Tax (PHP ₱)',
      'Grand Total (PHP ₱)',
      'Is Paid',
      'Payment Status',
      'Is Invoiced',
      'Invoice Status',
      'Status History Transition Notes'
    ];

    const rows = orders.map(so => {
      const escape = (val: string | number | boolean) => {
        const text = String(val === undefined || val === null ? '' : val).replace(/"/g, '""');
        return `"${text}"`;
      };

      const historySummary = (so.statusHistory || [])
        .map(h => `[${h.date}] ${h.status}: ${h.note} (${h.user || 'Officer'})`)
        .join(' | ');

      return [
        escape(so.soNumber),
        escape(so.orderDate),
        escape(so.shipmentDate),
        escape(so.status),
        `PHP ${(so.subtotal ?? so.total).toFixed(2)}`,
        `PHP ${(so.tax ?? 0).toFixed(2)}`,
        `PHP ${so.total.toFixed(2)}`,
        escape(so.isPaid ?? false),
        escape(so.paymentStatus || 'Unpaid'),
        escape(so.isInvoiced ?? false),
        escape(so.invoiceStatus || 'Uninvoiced'),
        escape(historySummary)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `so_log_${focusedCustomer.name.replace(/\s+/g, '_')}_${timestamp}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotification({ message: 'Successfully exported Sales Logs in standard PHP (₱) currency format.', type: 'success' });
  };

  // CSV Import handler for synchronizing Sales Logs / Orders
  const handleImportSalesOrdersCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!focusedCustomer) {
      setNotification({ message: 'Select a corporate client to import sales logs into.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      if (lines.length <= 1) return;

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let curVal = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(curVal.trim());
            curVal = '';
          } else {
            curVal += char;
          }
        }
        result.push(curVal.trim());
        return result;
      };

      let addedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseCSVLine(line);
        if (cols.length >= 4) {
          const soNumber = cols[0];
          const orderDate = cols[1];
          const shipmentDate = cols[2];
          const status = (cols[3] || 'Draft') as any;
          const subtotalStr = cols[4] || '0';
          const taxStr = cols[5] || '0';
          const totalStr = cols[6] || '0';

          const cleanFloat = (str: string) => parseFloat(str.replace(/[^\d\.]/g, '')) || 0;
          const subtotal = cleanFloat(subtotalStr);
          const tax = cleanFloat(taxStr);
          const total = cleanFloat(totalStr) || (subtotal + tax);

          if (soNumber && onUpdateSalesOrder) {
            const existingSO = salesOrders.find(so => so.soNumber.toLowerCase() === soNumber.toLowerCase());
            if (existingSO) {
              const updated: SalesOrder = {
                ...existingSO,
                orderDate: orderDate || existingSO.orderDate,
                shipmentDate: shipmentDate || existingSO.shipmentDate,
                status: status as any,
                subtotal,
                tax,
                total,
              };
              onUpdateSalesOrder(updated);
            } else {
              const newSO: SalesOrder = {
                id: 'so_imported_' + Math.random().toString(36).substr(2, 9),
                soNumber,
                customerName: focusedCustomer.name,
                customerId: focusedCustomer.id,
                orderDate: orderDate || new Date().toISOString().split('T')[0],
                shipmentDate: shipmentDate || new Date().toISOString().split('T')[0],
                status: status as any,
                warehouseId: 'wh-1',
                items: [],
                subtotal,
                tax,
                total,
                notes: 'Imported from CSV database.',
                statusHistory: [
                  { status: 'Draft' as const, date: orderDate || new Date().toISOString().split('T')[0], note: 'Sales order drafted via batch CSV import.', user: 'Operations Ledger' }
                ]
              };
              onUpdateSalesOrder(newSO);
            }
            addedCount++;
          }
        }
      }

      setNotification({ message: `Successfully synchronized ${addedCount} sales log records.`, type: 'success' });
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Targeted printable helper specifically styled for audit transition logs (PHP-compliant)
  const handlePrintAudit = (so: SalesOrder) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const historyHtml = ((so.statusHistory && so.statusHistory.length > 0) ? so.statusHistory : [
      { status: 'Draft' as const, date: so.orderDate || 'Created Date', note: 'Sales order record drafted inside CRM pipeline.', user: 'Sales Rep' }
    ]).map(log => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #edf2f7; font-family: monospace; font-size: 11px; font-weight: bold; color: #4f46e5;">${log.status.toUpperCase()}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #edf2f7; font-size: 11.5px; line-height: 1.4; color: #2d3748;">${log.note}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #edf2f7; font-family: monospace; font-size: 11px; text-align: right; color: #718096;">${log.date}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #edf2f7; font-size: 11px; font-weight: 500; text-align: right; color: #4a5568;">${log.user || 'System Officer'}</td>
      </tr>
    `).join('');

    doc.write(`
      <html>
        <head>
          <title>Audit Logs - ${so.soNumber}</title>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #1a202c; line-height: 1.5; }
            .header { border-bottom: 3px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
            .title { font-size: 24px; font-weight: 800; margin: 0; color: #111827; letter-spacing: -0.025em; }
            .subtitle { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #4f46e5; margin: 0 0 6px 0; }
            .metadata-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 16px; margin-bottom: 30px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; rounded: 8px; }
            .meta-item { font-size: 12px; color: #334155; }
            .meta-item strong { color: #0f172a; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; }
            th { padding: 12px 8px; border-bottom: 2px solid #cbd5e1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; font-weight: 700; background-color: #f1f5f9; }
            .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; font-family: monospace; }
            .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: 700; border-radius: 4px; border: 1px solid #c7d2fe; background: #e0e7ff; color: #3730a3; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div>
            <span class="subtitle">CONFIDENTIAL SYSTEM AUDIT RECORD</span>
            <div class="header">
              <h1 class="title">${so.soNumber} Transition Audit Summary</h1>
              <div style="font-family: monospace; font-size: 11px; color: #64748b; text-align: right;">Generated: ${new Date().toLocaleString()}</div>
            </div>
          </div>
          <div class="metadata-grid">
            <div class="meta-item">
              <strong>Corporate Client name:</strong> ${focusedCustomer?.name}<br/>
              <strong>Registered TIN Code:</strong> ${focusedCustomer?.tin || 'Foreign / VAT exempt'}<br/>
              <strong>Billing/Delivery Address:</strong> ${focusedCustomer?.address || 'N/A'}
            </div>
            <div class="meta-item" style="text-align: right;">
              <strong>Active Document Status:</strong> <span class="badge">${so.status}</span><br/>
              <strong>Order Base Date:</strong> ${so.orderDate || 'Created Base Date'}<br/>
              <strong style="color: #4f46e5;">Grand Document Total (PHP):</strong> ₱${so.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%">Transition Status</th>
                <th style="width: 50%">Logs & Audit Comments</th>
                <th style="width: 18%; text-align: right;">Date & Time</th>
                <th style="width: 17%; text-align: right;">Signature Ref</th>
              </tr>
            </thead>
            <tbody>
              ${historyHtml}
            </tbody>
          </table>
          <div class="footer">
            EOS Inventory Management Core System — Printed secure ledger copy in local PHP format.
          </div>
          <script>
            window.focus();
            window.print();
          </script>
        </body>
      </html>
    `);
    doc.close();
    
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  // Handler for adding a customer
  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customerForm.name || !customerForm.email) return;

    onAddCustomer({
      name: customerForm.name,
      email: customerForm.email,
      phone: customerForm.phone,
      address: customerForm.address,
      tin: customerForm.tin,
      status: customerForm.status
    });

    setCustomerForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      tin: '',
      status: 'Active'
    });
    setIsAddOpen(false);
  };

  // Handler for editing a customer
  const handleEditSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editForm.id || !editForm.name || !editForm.email) return;

    onEditCustomer({
      id: editForm.id,
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      address: editForm.address,
      tin: editForm.tin,
      status: editForm.status
    });

    setIsEditOpen(false);
  };

  const handleOpenEdit = (cust: Customer) => {
    setEditForm({
      id: cust.id,
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      address: cust.address || '',
      tin: cust.tin || '',
      status: cust.status
    });
    setIsEditOpen(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      {/* Toast Notification HUD - fully compatible with sandbox iframes */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-bold transition-all ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100/30'
                : 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100/30'
            }`}
          >
            <span>{notification.type === 'success' ? '✨' : '⚠️'}</span>
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT & CENTER CRM GRID */}
      <div className="lg:col-span-2 space-y-6">
        {/* KPI Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-xs">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block font-mono">Total CRM Portfolio</span>
            <span className="text-2xl font-extrabold text-neutral-900 block mt-1">{totalCount} Client Accounts</span>
            <span className="text-[10px] text-gray-400 block mt-1">Sourced from local database</span>
          </div>
          <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-xs">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block font-mono">Active Pipelines</span>
            <span className="text-2xl font-extrabold text-indigo-600 block mt-1">{activeCount} Engaged Accounts</span>
            <span className="text-[10px] text-gray-400 block mt-1">Available for active sales dispatches</span>
          </div>
          <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-xs bg-indigo-50/10">
            <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wider block font-mono">Global Portfolio Lifetime</span>
            <span className="text-2xl font-extrabold text-emerald-700 block mt-1">
              ₱{globalTotalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-indigo-600 font-medium block mt-1">Gross accounts receivables</span>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-xs p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
          <div className="flex flex-1 items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Corporate clients, billing TIN, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-600 font-semibold"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Clients</option>
              <option value="Inactive">Inactive Clients</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 animate-fade-in">
            {/* Hidden file input for corporate profile CSV import */}
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleImportCustomersCSV}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-150 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer justify-center border border-slate-200 hover:border-slate-300"
              title="Import Corporate Client list via CSV"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="w-full sm:w-auto inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-150 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer justify-center border border-slate-200 hover:border-slate-300"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export CSV</span>
            </button>

            {canEdit && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>Register Corporate Client</span>
              </button>
            )}
          </div>
        </div>

        {/* Corporate Client table ledger */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full divide-y divide-gray-150">
              <thead className="bg-gray-50 text-gray-500 font-mono font-semibold uppercase text-left">
                <tr>
                  <th className="px-6 py-3.5">Client & TIN</th>
                  <th className="px-6 py-3.5">Contact Email</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right font-mono">Invoice Volume</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-24 text-gray-400 select-none">
                      No corporate clients found matching filter state.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(cust => {
                    const stats = getCustomerStats(cust.id);
                    const isFocus = focusedCustomer?.id === cust.id;
                    return (
                      <tr 
                        key={cust.id} 
                        onClick={() => setFocusedCustomer(cust)}
                        className={`hover:bg-indigo-50/10 cursor-pointer transition-colors ${isFocus ? 'bg-indigo-50/30' : ''}`}
                      >
                        <td className="px-6 py-4 space-y-1">
                          <span className="font-bold text-gray-900 text-sm block leading-snug">{cust.name}</span>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400">
                            <Tag className="w-3 h-3 text-gray-300" />
                            <span>TIN: {cust.tin || 'Unrated / Foreign'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 space-y-0.5">
                          <span className="font-semibold block text-gray-800">{cust.email}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{cust.phone || 'N/A Phone'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${cust.status === 'Active' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-150 text-gray-500'}`}>
                            {cust.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono">
                          <span className="font-bold text-gray-900">₱{stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          <div className="text-[10px] text-gray-400 font-normal">{stats.orderCount} orders billed</div>
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              id={`edit-cust-${cust.id}`}
                              onClick={() => handleOpenEdit(cust)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-neutral-100 text-indigo-700 hover:text-indigo-850 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer focus:outline-hidden"
                              title="Edit parameters"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            {canEdit && (
                              <button
                                id={`delete-cust-${cust.id}`}
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete corporate customer record ${cust.name}? This will wipe CRM entries.`)) {
                                    onDeleteCustomer(cust.id);
                                    if (focusedCustomer?.id === cust.id) {
                                      setFocusedCustomer(null);
                                    }
                                  }
                                }}
                                className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT CRM INSPECTION OR ACTIVE ACCOUNT CARD PANEL */}
      <div className="space-y-6">
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          {!focusedCustomer ? (
            <div className="text-center py-24 text-gray-400 text-xs">
              Select any corporate billing profile to inspect delivery histories and CRM logs.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Account Branding summary */}
              <div>
                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase tracking-wider">
                  Corporate Account Ledger
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-2 leading-snug">{focusedCustomer.name}</h3>
                <div className="text-xs text-gray-500 space-y-1.5 pt-2">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span>{focusedCustomer.address || 'No billing address defined'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{focusedCustomer.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{focusedCustomer.phone || 'No phone record'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-gray-400" />
                    <span>Registered TIN Code: <strong className="font-mono text-gray-700">{focusedCustomer.tin || 'Foreign / VAT exempt'}</strong></span>
                  </div>
                </div>
              </div>

              {/* CRM Pipeline Stats */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">Fulfillment Metrics</h4>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-lg">
                    <span className="text-[10px] text-gray-400 block font-semibold">Invoices Billed</span>
                    <strong className="text-sm font-extrabold text-neutral-800">{salesOrders.filter(so => so.customerId === focusedCustomer.id).length}</strong>
                  </div>
                  <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-lg">
                    <span className="text-[10px] text-gray-400 block font-semibold">Avg Order Vol</span>
                    <strong className="text-sm font-extrabold text-indigo-600">
                      ₱{(() => {
                        const orders = salesOrders.filter(so => so.customerId === focusedCustomer.id);
                        if (orders.length === 0) return '0.00';
                        return (orders.reduce((sum, so) => sum + so.total, 0) / orders.length).toLocaleString(undefined, { maximumFractionDigits: 0 });
                      })()}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Shipment Dispatch list */}
              <div id="sales-orders-inspector-panel" className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-mono">Sales Orders Inspector</h4>
                  <div className="flex items-center gap-2">
                    {/* Hidden file input for Sales Orders CSV imports */}
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleImportSalesOrdersCSV}
                      id="so-csv-import-file"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('so-csv-import-file')?.click()}
                      title="Sync Sales Orders from CSV Ledger (PHP ₱)"
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSelectedCustomerOrdersCSV}
                      title="Export Customer Sales Orders Ledger to CSV"
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {salesOrders.filter(so => so.customerId === focusedCustomer.id).length > 0 && (
                      <span className="text-[10px] font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm">
                        {
                          salesOrders.filter(so => so.customerId === focusedCustomer.id).filter(so => {
                            const matchesSearch = so.soNumber.toLowerCase().includes(soSearch.toLowerCase().trim());
                            const matchesStatus = soStatusFilter === 'All' || so.status === soStatusFilter;
                            return matchesSearch && matchesStatus;
                          }).length
                        } of {salesOrders.filter(so => so.customerId === focusedCustomer.id).length} Orders
                      </span>
                    )}
                  </div>
                </div>

                {salesOrders.filter(so => so.customerId === focusedCustomer.id).length > 0 && (
                  <div className="flex gap-1.5 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search SO#..."
                        value={soSearch}
                        onChange={(e) => setSoSearch(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-600 font-medium"
                      />
                      {soSearch && (
                        <button
                          type="button"
                          onClick={() => setSoSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                        </button>
                      )}
                    </div>
                    
                    {/* Device Camera QR scanning trigger */}
                    <button
                      type="button"
                      onClick={() => setIsScanning(!isScanning)}
                      title="Scan Sales Order Barcode/QR Code"
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer inline-flex items-center justify-center ${
                        isScanning
                          ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                          : 'bg-indigo-50 border-indigo-150 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>

                    <select
                      value={soStatusFilter}
                      onChange={(e) => setSoStatusFilter(e.target.value as any)}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-600 font-semibold focus:outline-hidden cursor-pointer"
                    >
                      <option value="All">All Status</option>
                      <option value="Draft">Draft</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                )}

                {/* Embedded Camera Scanner Interface */}
                {isScanning && (
                  <div className="mt-2 p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-white overflow-hidden shadow-inner relative animate-in fade-in zoom-in duration-200 text-left">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-300">Target Laser Scan Active</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsScanning(false);
                          setScanError(null);
                        }}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer animate-fade-in"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {!scanError ? (
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
                        <video
                          ref={videoRef}
                          className="w-full h-full object-cover"
                        />
                        {/* Scanning visual overlay target guides */}
                        <div className="absolute inset-0 border-[20px] border-slate-950/45 flex items-center justify-center pointer-events-none">
                          <div className="w-3/4 h-3/4 border-2 border-dashed border-indigo-400/80 rounded relative flex items-center justify-center">
                            {/* Green scanning beam indicator */}
                            <div className="absolute w-full h-[1.5px] bg-emerald-400 top-0 left-0 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-bounce"></div>
                            <span className="text-[8px] font-mono text-indigo-300/90 font-bold bg-slate-900/80 px-1.5 py-0.5 rounded tracking-wide uppercase">Align QR Code</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 border border-slate-800 bg-slate-950 rounded-lg text-slate-300 text-[10px] space-y-2">
                        <p className="text-amber-400 font-bold">⚠️ Webcam Scan Unavailable: {scanError}</p>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed">
                          This is common in standard virtual testing frames. You can scan seamlessly by uploading an image containing a barcode/QR code or typing reference numbers!
                        </p>
                      </div>
                    )}

                    <div className="text-[9px] text-center text-slate-405 font-medium">
                      {!scanError ? "Ensure adequate lighting. Point camera lens at the Sales Order code tag." : "System fell back to fast file-based QR decoding interface."}
                    </div>

                    {/* Fallback QR Image Upload option */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <span className="text-[10px] text-slate-400 font-mono">Mock Testing Fallback:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          ref={qrImageInputRef}
                          onChange={handleQrImageUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => qrImageInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 text-[9.5px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer shadow-sm"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Barcode / QR Image</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-50 overflow-y-auto max-h-[220px] pr-1">
                  {salesOrders.filter(so => so.customerId === focusedCustomer.id).length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs text-slate-400/80">
                      No order dispatches registered for this company.
                    </div>
                  ) : (
                    (() => {
                      const filtered = salesOrders
                        .filter(so => so.customerId === focusedCustomer.id)
                        .filter(so => {
                          const matchesSearch = so.soNumber.toLowerCase().includes(soSearch.toLowerCase().trim());
                          const matchesStatus = soStatusFilter === 'All' || so.status === soStatusFilter;
                          return matchesSearch && matchesStatus;
                        });

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-400 text-xs">
                            <p className="text-slate-400/90">No matching sales orders found.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSoSearch('');
                                setSoStatusFilter('All');
                              }}
                              className="mt-2 text-[10px] font-bold text-indigo-650 hover:text-indigo-800 underline transition-colors cursor-pointer inline-block"
                            >
                              Reset filters & search
                            </button>
                          </div>
                        );
                      }

                      return filtered.map(so => {
                        const isExpanded = expandedAuditSOId === so.id;
                        return (
                          <div key={so.id} className="py-2.5 border-b border-gray-50 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5 text-left">
                                <span className="font-bold text-gray-900 block">{so.soNumber}</span>
                                <span className="text-[10px] font-mono text-gray-400">{so.orderDate || 'Created Base Date'}</span>
                              </div>
                              <div className="text-right space-y-0.5">
                                <span className="font-mono font-bold text-slate-805 block">₱{so.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className={`inline-block px-1.5 py-0.2 rounded font-semibold text-[9px] ${
                                  so.status === 'Shipped' ? 'bg-emerald-50 text-emerald-700' :
                                  so.status === 'Confirmed' ? 'bg-indigo-50 text-indigo-700' :
                                  so.status === 'Cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {so.status}
                                </span>
                              </div>
                            </div>

                            {/* Audit expansion toggler */}
                            <div className="mt-1.5 text-left">
                              <button
                                type="button"
                                onClick={() => setExpandedAuditSOId(isExpanded ? null : so.id)}
                                className="inline-flex items-center gap-1.5 text-[10px] text-indigo-600 hover:text-indigo-805 font-bold hover:underline transition-all cursor-pointer bg-indigo-50/40 hover:bg-indigo-100/50 p-1 px-2.5 rounded border border-indigo-100/40"
                              >
                                ⏳ {isExpanded ? 'Hide Audit Trail' : 'View Audit History'}
                              </button>
                            </div>

                            {/* Detailed Expanded Audit Trackers with slide & fade animations */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-2.5 p-3 bg-slate-50 border border-gray-150 rounded-lg space-y-3">
                                    <div>
                                      <div className="text-[9px] font-mono text-slate-450 uppercase font-black tracking-widest border-b border-gray-200 pb-1 mb-1.5 flex justify-between items-center text-left">
                                        <span>💸 Price Configuration Audit</span>
                                        <button
                                          type="button"
                                          onClick={() => handlePrintAudit(so)}
                                          className="inline-flex items-center gap-1 text-[8.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 cursor-pointer shadow-3xs transition-all"
                                          title="Generate printer-friendly summary of transitions"
                                        >
                                          <Printer className="w-2.5 h-2.5" />
                                          <span>Print Audit History</span>
                                        </button>
                                      </div>
                                      <div className="space-y-1 text-[10px] text-gray-600 text-left">
                                        <div className="flex justify-between">
                                          <span>Items Base:</span>
                                          <span className="font-mono">₱{(so.subtotal ?? so.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        {so.discountValue ? (
                                          <div className="flex justify-between text-red-600 font-medium">
                                            <span>Discount Apply ({so.discountType}):</span>
                                            <span className="font-mono">-{so.discountType === 'Percentage' ? `${so.discountValue}%` : `₱${so.discountValue.toLocaleString()}`}</span>
                                          </div>
                                        ) : null}
                                        <div className="flex justify-between">
                                          <span>Associated Local Tax:</span>
                                          <span className="font-mono">₱{(so.tax ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-dashed border-gray-200 pt-1 text-slate-900 font-extrabold text-[10.5px]">
                                          <span>Grand Document Total:</span>
                                          <span className="font-mono">₱{so.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-[9px] font-mono text-slate-450 uppercase font-black tracking-widest border-b border-gray-200 pb-1 mb-1.5 flex justify-between items-center text-left">
                                        <span>🗓️ Status Transitions & Comments Audit</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {/* CSV Import Layout */}
                                          <label 
                                            className="inline-flex items-center gap-1 text-[8.5px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer shadow-3xs transition-all"
                                            title="Batch import audit logs from structured CSV"
                                          >
                                            <Upload className="w-2.5 h-2.5" />
                                            <span>Import CSV</span>
                                            <input
                                              type="file"
                                              accept=".csv"
                                              className="hidden"
                                              onChange={(e) => handleCSVBatchImport(e, so.id)}
                                            />
                                          </label>

                                          {/* CSV Export Button */}
                                          <button
                                            type="button"
                                            onClick={() => handleExportAuditLogCSV(so)}
                                            className="inline-flex items-center gap-1 text-[8.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 cursor-pointer shadow-3xs transition-all"
                                            title="Export displayed audit log history to CSV"
                                          >
                                            <Download className="w-2.5 h-2.5" />
                                            <span>Export CSV</span>
                                          </button>

                                          {/* Density Toggle Button (Compact / Comfortable) */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const currentDensity = auditLogDensity[so.id] || 'comfortable';
                                              const nextDensity = currentDensity === 'comfortable' ? 'compact' : 'comfortable';
                                              setAuditLogDensity({
                                                ...auditLogDensity,
                                                [so.id]: nextDensity
                                              });
                                            }}
                                            className="inline-flex items-center gap-1 text-[8.5px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded border border-slate-350 cursor-pointer shadow-3xs transition-all font-mono"
                                            title={`Switch density (currently ${auditLogDensity[so.id] || 'comfortable'})`}
                                          >
                                            <span>Density: <strong className="text-indigo-650 uppercase font-black">{auditLogDensity[so.id] || 'comfortable'}</strong></span>
                                          </button>
                                        </div>
                                      </div>

                                      {/* New inline filter input for searching of log status and keywords inside expanded audit list */}
                                      <div className="relative mb-2 pr-1">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                        <input
                                          type="text"
                                          placeholder="Filter audit logs (e.g. status, officers, notes)..."
                                          value={auditLogSearch[so.id] || ''}
                                          onChange={(e) => setAuditLogSearch({
                                            ...auditLogSearch,
                                            [so.id]: e.target.value
                                          })}
                                          className="w-full pl-6.5 pr-6 py-1 bg-white border border-gray-200 rounded text-[9.5px] placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium text-slate-755 text-left"
                                        />
                                        {(auditLogSearch[so.id] || '') && (
                                          <button
                                            type="button"
                                            onClick={() => setAuditLogSearch({
                                              ...auditLogSearch,
                                              [so.id]: ''
                                            })}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                                          >
                                            <X className="w-2.5 h-2.5 text-slate-400 hover:text-slate-600" />
                                          </button>
                                        )}
                                      </div>

                                      <div className="space-y-2.5 border-l-2 border-indigo-100 ml-1 pl-2 text-left">
                                        {(() => {
                                          const logs = ((so.statusHistory && so.statusHistory.length > 0) ? so.statusHistory : [
                                            { status: 'Draft' as const, date: so.orderDate || 'Created Date', note: 'Sales order record drafted inside CRM pipeline.', user: 'Sales Rep' }
                                          ]);
                                          const query = (auditLogSearch[so.id] || '').trim().toLowerCase();
                                          const filteredLogs = logs.filter((log) => {
                                            if (!query) return true;
                                            return (
                                              log.status.toLowerCase().includes(query) ||
                                              log.note.toLowerCase().includes(query) ||
                                              (log.user || '').toLowerCase().includes(query) ||
                                              log.date.toLowerCase().includes(query)
                                            );
                                          });

                                          const sortedAndMappedLogs = (() => {
                                            const sortBy = auditLogSortBy[so.id] || 'date';
                                            const sortDir = auditLogSortDir[so.id] || 'desc';
                                            return [...filteredLogs].sort((a, b) => {
                                              let comparison = 0;
                                              if (sortBy === 'status') {
                                                comparison = a.status.localeCompare(b.status);
                                              } else {
                                                comparison = a.date.localeCompare(b.date);
                                              }
                                              return sortDir === 'asc' ? comparison : -comparison;
                                            });
                                          })();

                                          if (sortedAndMappedLogs.length === 0) {
                                            return (
                                              <div className="text-center py-4 text-[9px] text-slate-400 font-medium italic select-none">
                                                No matching logs found inside the audit trail.
                                              </div>
                                            );
                                          }

                                          return (
                                            <>
                                              {/* Clickable Header for Sorting */}
                                              <div className="flex items-center justify-between text-[8px] font-mono uppercase font-black tracking-wider text-slate-455 bg-slate-100 border border-slate-200 p-1 px-1.5 rounded mb-2 select-none -ml-2">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const currentDir = auditLogSortDir[so.id] || 'desc';
                                                    const currentBy = auditLogSortBy[so.id] || 'date';
                                                    const nextDir = (currentBy === 'status') ? (currentDir === 'desc' ? 'asc' : 'desc') : 'desc';
                                                    setAuditLogSortBy({ ...auditLogSortBy, [so.id]: 'status' });
                                                    setAuditLogSortDir({ ...auditLogSortDir, [so.id]: nextDir });
                                                  }}
                                                  className={`hover:text-indigo-655 cursor-pointer inline-flex items-center gap-0.5 ${(auditLogSortBy[so.id] || 'date') === 'status' ? 'text-indigo-600 font-black' : ''}`}
                                                >
                                                  Sort Status {(auditLogSortBy[so.id] || 'date') === 'status' ? (auditLogSortDir[so.id] === 'asc' ? '▲' : '▼') : '↕'}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const currentDir = auditLogSortDir[so.id] || 'desc';
                                                    const currentBy = auditLogSortBy[so.id] || 'date';
                                                    const nextDir = (currentBy === 'date') ? (currentDir === 'desc' ? 'asc' : 'desc') : 'desc';
                                                    setAuditLogSortBy({ ...auditLogSortBy, [so.id]: 'date' });
                                                    setAuditLogSortDir({ ...auditLogSortDir, [so.id]: nextDir });
                                                  }}
                                                  className={`hover:text-indigo-655 cursor-pointer inline-flex items-center gap-0.5 ${(auditLogSortBy[so.id] || 'date') === 'date' ? 'text-indigo-600 font-black' : ''}`}
                                                >
                                                  Sort Date {(auditLogSortBy[so.id] || 'date') === 'date' ? ((auditLogSortDir[so.id] || 'desc') === 'asc' ? '▲' : '▼') : '↕'}
                                                </button>
                                              </div>
                                              {sortedAndMappedLogs.map((log, lIdx) => {
                                                const rowKey = `${so.id}-${log.status}-${lIdx}`;
                                                const isRowExpanded = expandedAuditRowId === rowKey;
                                                 const isCompactMode = (auditLogDensity[so.id] || 'comfortable') === 'compact';
                                                 const userRemark = temporaryRemarks[rowKey] || '';
                                                 const displayNoteText = log.note + (userRemark ? ` (Remark: ${userRemark})` : '');
                                                
                                                // Function to get distinct colored dynamic status styles
                                                const getAuditStatusBadgeStyle = (status: string) => {
                                                  const s = status.toLowerCase();
                                                  if (s.includes('received') || s.includes('delivered') || s.includes('shipped') || s.includes('issued')) {
                                                    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
                                                  }
                                                  if (s.includes('draft')) {
                                                    return 'bg-slate-50 text-slate-700 border-slate-200';
                                                  }
                                                  if (s.includes('confirmed') || s.includes('approved')) {
                                                    return 'bg-indigo-50 text-indigo-800 border-indigo-200';
                                                  }
                                                  if (s.includes('invoice')) {
                                                    return 'bg-amber-50 text-amber-800 border-amber-200';
                                                  }
                                                  if (s.includes('cancelled') || s.includes('void')) {
                                                    return 'bg-rose-50 text-rose-800 border-rose-200';
                                                  }
                                                  return 'bg-blue-50 text-blue-800 border-blue-200';
                                                };

                                                const transitionHash = `TX-HASH-${Math.abs(rowKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 1793).toString(16).toUpperCase()}`;

                                                return (
                                                  <div
                                                    key={lIdx}
                                                    onClick={() => setExpandedAuditRowId(isRowExpanded ? null : rowKey)}
                                                    className="group text-[9.5px] pb-2 border-b border-gray-100/60 last:border-b-0 space-y-1 hover:bg-slate-50/50 p-1.5 rounded-lg transition-colors cursor-pointer text-left"
                                                    title="Click to toggle granular transition parameters"
                                                  >
                                                    <div className="flex justify-between items-baseline font-mono text-[9.5px]">
                                                      <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full border ${getAuditStatusBadgeStyle(log.status)} uppercase tracking-wider`}>
                                                        {log.status}
                                                      </span>
                                                      <span className="text-gray-400 text-[8px]">{log.date}</span>
                                                    </div>
                                                    
                                                    {!isCompactMode && (
                                                      <p className="text-gray-600 text-[9px] font-sans leading-tight mt-0.5 select-none">{displayNoteText}</p>
                                                    )}

                                                    {/* Inline Temporary Textarea Remark Input */}
                                                    <div onClick={(e) => e.stopPropagation()} className="mt-1 flex gap-1.5 items-center">
                                                      <span className="text-[7.5px] font-mono text-gray-400 select-none uppercase shrink-0">Remark:</span>
                                                      <textarea
                                                        rows={1}
                                                        placeholder="Add quick remark... (Appends to note)"
                                                        value={temporaryRemarks[rowKey] || ""}
                                                        onChange={(e) => setTemporaryRemarks({
                                                          ...temporaryRemarks,
                                                          [rowKey]: e.target.value
                                                        })}
                                                        className="flex-1 px-1.5 py-0.5 text-[8.5px] border border-gray-200 rounded bg-white text-gray-755 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans leading-normal"
                                                      />
                                                    </div>
                                                    
                                                    {/* Nested Granular Expansion Section */}
                                                    {isRowExpanded ? (
                                                      <div 
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="mt-1.5 p-2 bg-slate-100 rounded border border-slate-200 space-y-1 block animate-in fade-in slide-in-from-top-1 duration-150 text-[8.5px] text-left font-mono"
                                                      >
                                                        <div className="flex justify-between text-slate-500">
                                                          <span>Inspector/Operator User:</span>
                                                          <span className="font-bold text-slate-800">{log.user || 'SYSTEM_ROUTINE_DAEMON'}</span>
                                                        </div>
                                                        <div className="flex justify-between text-slate-500">
                                                          <span>Audit Cryptographic Hash:</span>
                                                          <span className="text-indigo-650 font-semibold">{transitionHash}</span>
                                                        </div>
                                                        <div className="flex justify-between text-slate-500">
                                                          <span>Active SO Item Types:</span>
                                                          <span className="font-bold text-slate-800">{so.items.length} units</span>
                                                        </div>
                                                        <div className="flex justify-between text-slate-500">
                                                          <span>Aggregate Fiscal Value:</span>
                                                          <span className="font-bold text-emerald-700">₱{(so.total || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between text-slate-500">
                                                          <span>Compliance Framework:</span>
                                                          <span className="text-purple-650 font-bold">PH BIR Sec-237 Compliant</span>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      !isCompactMode && (
                                                        <div className="flex items-center justify-between text-[7.5px] text-gray-400 font-mono mt-0.5">
                                                          <span>Ref User: {log.user || 'System'}</span>
                                                          <span className="text-indigo-500 group-hover:underline">Click for parameters ↗</span>
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </>
                                          );
                                        })()}
                                      </div>

                                      {/* Add new dynamic timestamped comment form */}
                                      <div className="mt-4 pt-3.5 border-t border-gray-200/60 space-y-2">
                                        <span className="text-[9px] font-mono text-slate-400 uppercase font-black tracking-wider block text-left">✍️ Append Audit Comment / Remark</span>
                                        <div className="grid grid-cols-3 gap-2">
                                          <input
                                            type="text"
                                            placeholder="User name..."
                                            value={tempCommentUser[so.id] || ""}
                                            onChange={(e) => setTempCommentUser({ ...tempCommentUser, [so.id]: e.target.value })}
                                            className="col-span-1 px-2.5 py-1.5 text-[10px] bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-semibold"
                                          />
                                          <input
                                            type="text"
                                            placeholder="Type order comment detail..."
                                            value={tempCommentText[so.id] || ""}
                                            onChange={(e) => setTempCommentText({ ...tempCommentText, [so.id]: e.target.value })}
                                            className="col-span-2 px-2.5 py-1.5 text-[10px] bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const text = tempCommentText[so.id] || '';
                                            const userStr = tempCommentUser[so.id] || '';
                                            if (!text.trim()) return;

                                            const dateStamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
                                            const newEntry = {
                                              status: so.status,
                                              date: dateStamp,
                                              note: text.trim(),
                                              user: userStr.trim() || 'operator'
                                            };

                                            const updatedHistory = [...(so.statusHistory || []), newEntry];
                                            const updatedSO = {
                                              ...so,
                                              statusHistory: updatedHistory as any
                                            };

                                            if (onUpdateSalesOrder) {
                                              onUpdateSalesOrder(updatedSO);
                                            } else {
                                              so.statusHistory = updatedHistory as any;
                                            }

                                            setTempCommentText({ ...tempCommentText, [so.id]: '' });
                                            setTempCommentUser({ ...tempCommentUser, [so.id]: '' });
                                          }}
                                          className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded border border-indigo-150 transition-all text-center cursor-pointer uppercase tracking-wider"
                                        >
                                          Append Timestamped Comment
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL ZONE */}
      {/* REGISTER CUSTOMER MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-100 rounded-xl w-full max-w-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-600" />
                <span>Register New Corporate Account</span>
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-gray-600">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Philippine National Oil Corp"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-600">Corporate Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="finance@pnoc.gov.ph"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-600">Official Phone</label>
                  <input
                    type="text"
                    placeholder="+63-2-8840-5555"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-600">Registered TIN Code</label>
                <input
                  type="text"
                  placeholder="e.g. 058-293-111-000"
                  value={customerForm.tin}
                  onChange={(e) => setCustomerForm({ ...customerForm, tin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-600">Billing Address</label>
                <textarea
                  placeholder="Street name, Barangay, Building, City, Philippines"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-600">Account status</label>
                <select
                  value={customerForm.status}
                  onChange={(e) => setCustomerForm({ ...customerForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650 bg-white"
                >
                  <option value="Active">Active / Engaged</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-500 font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-100 rounded-xl w-full max-w-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>Modify Corporate parameters</span>
              </h3>
              <button onClick={() => setIsEditOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-gray-600">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Company Name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-600">Corporate Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="email@address"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-600">Official Phone</label>
                  <input
                    type="text"
                    placeholder="Phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-600">Registered TIN Code</label>
                <input
                  type="text"
                  placeholder="TIN Code"
                  value={editForm.tin}
                  onChange={(e) => setEditForm({ ...editForm, tin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-600">Billing Address</label>
                <textarea
                  placeholder="Billing address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-600">Account status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-650 bg-white"
                >
                  <option value="Active">Active / Engaged</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 hover:bg-gray-100 text-gray-500 font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
