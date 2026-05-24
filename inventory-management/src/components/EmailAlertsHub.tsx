/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, FormEvent } from 'react';
import { Mail, Calendar, User, Search, Play, CheckCircle2, AlertTriangle, ShieldCheck, Trash2, MailOpen, Terminal, RefreshCw } from 'lucide-react';
import { Item } from '../types';

interface EmailAlertLog {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  previousStock: number;
  currentStock: number;
  reorderPoint: number;
  dateTriggered: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: 'Sent' | 'Failed';
  serviceType: 'Firebase Function (Simulated)';
}

interface EmailAlertsHubProps {
  emailAlertLogs: EmailAlertLog[];
  items: Item[];
  onTriggerMockAlert: (item: Item, customStockValue: number) => void;
  onClearLogs: () => void;
}

export default function EmailAlertsHub({
  emailAlertLogs = [],
  items = [],
  onTriggerMockAlert,
  onClearLogs
}: EmailAlertsHubProps) {
  const [selectedMail, setSelectedMail] = useState<EmailAlertLog | null>(emailAlertLogs[0] || null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Simulation states
  const [simItemId, setSimItemId] = useState(items[0]?.id || '');
  const [simQty, setSimQty] = useState(3);

  const filteredMails = emailAlertLogs.filter(mail => 
    mail.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mail.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mail.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mail.recipientEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    const targetedItem = items.find(i => i.id === simItemId);
    if (!targetedItem) return;
    onTriggerMockAlert(targetedItem, simQty);
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-905">Email Alerts Hub</h1>
          <p className="text-sm text-gray-500">View real-time notifications fired automatically via simulated serverless Firebase triggers when items drop below Reorder Levels.</p>
        </div>
        <div className="flex items-center gap-2">
          {emailAlertLogs.length > 0 && (
            <button
              onClick={() => {
                onClearLogs();
                setSelectedMail(null);
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-rose-650 bg-rose-50 border border-rose-200 hover:bg-rose-100/80 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Notification Archive</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Left column (Simulation Trigger Console), Right column (Split-Screen Email Inbox) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Simulation Sandbox Console */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-gray-150/80 shadow-xs space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-indigo-650" />
              Trigger Event simulator
            </h3>
            <p className="text-[11px] text-gray-400">Trigger low-stock dispatch alerts manually on any parts SKU to check custom integration rules.</p>
          </div>

          <form onSubmit={handleSimulate} className="space-y-4 pt-2 border-t border-gray-100">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-650">Select Target Inventory SKU *</label>
              <select
                value={simItemId}
                onChange={(e) => setSimItemId(e.target.value)}
                className="w-full text-xs px-2.5 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                {items.map(item => {
                  const totalWhQty = Object.values(item.stockByWarehouse).reduce((a, b) => a + b, 0);
                  return (
                    <option key={item.id} value={item.id}>
                      {item.sku} - {item.name} (Current Qty: {totalWhQty} {item.unit}, Min: {item.reorderPoint})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-650">Simulated Target Stock level *</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={simQty}
                  onChange={(e) => setSimQty(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 text-xs px-3 py-2 border border-gray-250 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                />
                <span className="text-[11.5px] text-slate-500 self-center">
                  units
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Specify an amount lower than the item's reorder point to trigger the Firebase Cloud trigger alert rules.</p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-xs font-bold text-white rounded-lg transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Simulate Firebase Drop Event</span>
            </button>
          </form>

          {/* Rules Indicator Grid */}
          <div className="pt-4 border-t border-gray-100 space-y-2.5">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-450 tracking-wider block">Firebase Functions Config</span>
            <div className="space-y-2">
              <div className="flex gap-2 p-2 bg-indigo-50/40 border border-indigo-100 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-[10.5px] text-indigo-750">
                  <strong className="block font-bold">Cloud Trigger is Active</strong>
                  Endpoint listens for document writes inside 'inventory/sku' in Firestore and runs node-mailer script.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mail SPLIT-SCREEN Inbox */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-4 bg-white rounded-xl border border-gray-150 p-4.5 shadow-xs min-h-[500px]">
          
          {/* Left panel: list of mails */}
          <div className="md:col-span-5 border-r border-gray-100 pr-3 space-y-3 flex flex-col h-full">
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter triggers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-[11px] pl-8 pr-3 py-1.5 bg-gray-50 text-gray-800 rounded-md border border-gray-150 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 font-medium"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50 pr-0.5">
              {filteredMails.length === 0 ? (
                <div className="py-24 text-center text-xs text-gray-400 italic">
                  No alerts triggered. Set an inventory item's stock below its reorder point to trigger!
                </div>
              ) : (
                filteredMails.map(mail => {
                  const isSelected = selectedMail?.id === mail.id;
                  return (
                    <div
                      key={mail.id}
                      onClick={() => setSelectedMail(mail)}
                      className={`p-3 text-left cursor-pointer transition-all rounded-lg space-y-1.5 border border-transparent ${
                        isSelected 
                          ? 'bg-slate-50 border-gray-200 shadow-sm' 
                          : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-mono text-gray-450 font-bold">{mail.sku}</span>
                        <span className="text-[8.5px] text-slate-400 font-mono">{mail.dateTriggered}</span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-800 line-clamp-1 leading-snug">{mail.itemName}</h4>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className="truncate max-w-[120px]">to {mail.recipientEmail}</span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 font-bold font-mono uppercase tracking-wider text-[8px] border border-indigo-100">
                          {mail.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: Detail mail view */}
          <div className="md:col-span-7 pl-1 h-full flex flex-col justify-between">
            {selectedMail ? (
              <div className="space-y-4 text-left h-full flex flex-col">
                <div className="border-b border-gray-100 pb-3 space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-[9.5px] font-bold font-mono bg-rose-50 text-rose-600 rounded border border-rose-100 uppercase tracking-widest flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> System Outage alert
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-medium">{selectedMail.dateTriggered}</span>
                  </div>
                  <h2 className="text-sm font-extrabold text-slate-900 leading-snug">{selectedMail.subject}</h2>
                  <div className="text-xs text-slate-650 space-y-1">
                    <div>
                      <span className="text-slate-400 font-medium">From:</span> <strong className="font-mono text-slate-700">Firebase Cloud Functions (noreply@equiprime.ph)</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Recipient:</span> <strong className="font-mono text-indigo-650">{selectedMail.recipientEmail}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Core Service:</span> <span className="font-bold text-purple-650 bg-purple-50 px-1 py-0.2 rounded shrink-0 text-[10px]">{selectedMail.serviceType}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 bg-slate-50 border border-gray-150 p-4 rounded-xl font-mono text-[11px] leading-relaxed text-slate-800 overflow-y-auto whitespace-pre-wrap select-text">
                  {selectedMail.body}
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
                  <span className="font-mono">Security Check: SPF/DKIM/DMARC Pass</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5" /> Fired Perfectly
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center scroll-pt-12">
                <Mail className="w-12 h-12 text-slate-205 mb-3" />
                <h4 className="font-bold text-slate-550 text-sm">Select Email to Preview</h4>
                <p className="text-xs text-slate-400 max-w-sm mt-1">Select any simulated outbound notification message from the inbox list on the left to read headers and body templates.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
