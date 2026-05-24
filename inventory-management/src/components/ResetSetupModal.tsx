/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Warehouse, Item, Supplier, Customer } from '../types';
import { Building, Package, User, Plus, X, Globe, DollarSign } from 'lucide-react';

interface ResetSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteSetup: (setupData: {
    warehouse: Warehouse;
    item: Item;
    supplier: Supplier;
    customer: Customer;
  }) => void;
  onLoadDefaults: () => void;
}

export function ResetSetupModal({ isOpen, onClose, onCompleteSetup, onLoadDefaults }: ResetSetupModalProps) {
  const [activeStep, setActiveStep] = useState<'warehouse' | 'item' | 'supplier' | 'customer'>('warehouse');

  // Form states
  const [warehouseForm, setWarehouseForm] = useState({
    name: 'Main Distribution Center',
    code: 'MDC-MNL',
    location: 'Metro Manila, PH',
    contactEmail: 'mdc@enterprise.com',
    maxCapacity: 1000
  });

  const [itemForm, setItemForm] = useState({
    name: 'Premium Engine Block 2.5L',
    sku: 'ENG-25-BLK',
    description: 'High pressure cast aluminum heavy machinery engine cylinder block.',
    unit: 'pcs',
    purchasePrice: 2450.00,
    sellingPrice: 3890.00,
    reorderPoint: 5,
    category: 'Engine Components',
    brand: 'ProCore Fleet'
  });

  const [supplierForm, setSupplierForm] = useState({
    name: 'Global Machining Group Co.',
    currency: 'USD',
    contactPerson: 'Director Dennis Reyes',
    email: 'procurement@globalmachine.com',
    phone: '+63 917 555 8899',
    leadTimeDays: 14,
    supplierType: 'International' as 'Local' | 'International',
    address: 'Tokyo Logistics Port Suite A, JP'
  });

  const [customerForm, setCustomerForm] = useState({
    name: 'Davao Mining Operations Inc.',
    email: 'accounts@davaomining.com',
    phone: '+63 82 233 4455',
    address: 'Mining Zone Rd, Davao City, Philippines',
    tin: '123-456-789-000'
  });

  if (!isOpen) return null;

  const steps = [
    { id: 'warehouse', label: '1. Store / Warehouse', icon: Building },
    { id: 'item', label: '2. Inventory Component', icon: Package },
    { id: 'supplier', label: '3. Machine Supplier', icon: User },
    { id: 'customer', label: '4. Fleet Customer', icon: User },
  ] as const;

  const handleFinish = () => {
    // Generate valid UUIDs
    const whId = `wh-manual-${Date.now()}`;
    const itemId = `item-manual-${Date.now()}`;
    const suppId = `supp-manual-${Date.now()}`;
    const custId = `cust-manual-${Date.now()}`;

    // Map to formal business models
    const warehouse: Warehouse = {
      id: whId,
      name: warehouseForm.name.trim(),
      code: warehouseForm.code.trim().toUpperCase(),
      location: warehouseForm.location.trim(),
      contactEmail: warehouseForm.contactEmail.trim(),
      status: 'Active',
      maxCapacity: Number(warehouseForm.maxCapacity) || 1000
    };

    const item: Item = {
      id: itemId,
      sku: itemForm.sku.trim().toUpperCase(),
      name: itemForm.name.trim(),
      description: itemForm.description.trim(),
      unit: itemForm.unit.trim() || 'pcs',
      purchasePrice: Number(itemForm.purchasePrice) || 0,
      sellingPrice: Number(itemForm.sellingPrice) || 0,
      reorderPoint: Number(itemForm.reorderPoint) || 0,
      category: itemForm.category.trim(),
      brand: itemForm.brand.trim() || 'Generic',
      status: 'Active',
      stockByWarehouse: {
        [whId]: 0  // start with 0 stock
      }
    };

    const supplier: Supplier = {
      id: suppId,
      name: supplierForm.name.trim(),
      currency: supplierForm.currency.trim().toUpperCase() || 'USD',
      exchangeRate: 1.0,
      contactPerson: supplierForm.contactPerson.trim(),
      email: supplierForm.email.trim(),
      phone: supplierForm.phone.trim(),
      leadTimeDays: Number(supplierForm.leadTimeDays) || 7,
      supplierType: supplierForm.supplierType,
      address: supplierForm.address.trim()
    };

    const customer: Customer = {
      id: custId,
      name: customerForm.name.trim(),
      email: customerForm.email.trim(),
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim(),
      tin: customerForm.tin.trim() || '000-000-000-000',
      status: 'Active'
    };

    // Trigger full registration setup
    onCompleteSetup({ warehouse, item, supplier, customer });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col text-slate-100">
        
        {/* Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400 animate-spin-slow" />
            <div>
              <h3 className="text-sm font-black font-mono tracking-wider uppercase text-left">Hard Reset setup wizard</h3>
              <p className="text-[10.5px] text-indigo-300 font-mono text-left mt-0.5">Initialize your custom core enterprise registry</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Steps Nav Header */}
        <div className="bg-slate-950/50 border-b border-slate-800 grid grid-cols-4 text-center">
          {steps.map(step => {
            const IconComp = step.icon;
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`py-3 px-1 text-[10px] font-bold font-mono tracking-wider transition-colors border-b-2 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  isActive 
                    ? 'border-indigo-500 text-white bg-slate-900/40' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <IconComp className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          
          {/* Step 1: Warehouse Form */}
          {activeStep === 'warehouse' && (
            <div className="space-y-4 text-left animate-in fade-in duration-200">
              <span className="text-[10px] font-extrabold text-indigo-400 font-mono tracking-widest uppercase block">&lt; Warehouse Registry Setup /&gt;</span>
              <p className="text-gray-400 text-xs">Enter your primary storage warehouse where all received purchase components will be physically located.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Warehouse Name *</label>
                  <input
                    type="text"
                    value={warehouseForm.name}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-medium focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Warehouse Code *</label>
                  <input
                    type="text"
                    value={warehouseForm.code}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono font-bold uppercase focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Physical Address Location</label>
                  <input
                    type="text"
                    value={warehouseForm.location}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Contact Email Address</label>
                  <input
                    type="email"
                    value={warehouseForm.contactEmail}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, contactEmail: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Maximum Capacity Limit (Total Item Units) *</label>
                <input
                  type="number"
                  value={warehouseForm.maxCapacity}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, maxCapacity: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-505 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Step 2: Item Form */}
          {activeStep === 'item' && (
            <div className="space-y-4 text-left animate-in fade-in duration-200">
              <span className="text-[10px] font-extrabold text-indigo-400 font-mono tracking-widest uppercase block">&lt; Inventory Material Specification /&gt;</span>
              <p className="text-gray-400 text-xs">Enter your primary spare part catalog item unit to receive, dispense, and lot track.</p>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Item / Material Description Name *</label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-semibold focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">SKU ID Part Code *</label>
                  <input
                    type="text"
                    value={itemForm.sku}
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono uppercase focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Category Group</label>
                  <input
                    type="text"
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Unit Measure (base)</label>
                  <input
                    type="text"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Reorder Buffer Point</label>
                  <input
                    type="number"
                    value={itemForm.reorderPoint}
                    onChange={(e) => setItemForm({ ...itemForm, reorderPoint: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Brand / Maker</label>
                  <input
                    type="text"
                    value={itemForm.brand}
                    onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Purchase Cost (USD) *</label>
                  <input
                    type="number"
                    value={itemForm.purchasePrice}
                    onChange={(e) => setItemForm({ ...itemForm, purchasePrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Selling Price (USD) *</label>
                  <input
                    type="number"
                    value={itemForm.sellingPrice}
                    onChange={(e) => setItemForm({ ...itemForm, sellingPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Material Engineering Description</label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-indigo-505 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Step 3: Supplier Form */}
          {activeStep === 'supplier' && (
            <div className="space-y-4 text-left animate-in fade-in duration-200">
              <span className="text-[10px] font-extrabold text-indigo-400 font-mono tracking-widest uppercase block">&lt; Master Supplier Registry /&gt;</span>
              <p className="text-gray-400 text-xs">Enter your primary manufacturer or vendor to place heavy machinery component purchase orders from.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Supplier Venture Name *</label>
                  <input
                    type="text"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-semibold focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Billing Currency Selection</label>
                  <select
                    value={supplierForm.currency}
                    onChange={(e) => setSupplierForm({ ...supplierForm, currency: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="PHP">PHP (₱)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Primary Contact Officer</label>
                  <input
                    type="text"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Supplier Lead Time (Days)</label>
                  <input
                    type="number"
                    value={supplierForm.leadTimeDays}
                    onChange={(e) => setSupplierForm({ ...supplierForm, leadTimeDays: Math.max(1, parseInt(e.target.value) || 7) })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Supplier Classification</label>
                  <select
                    value={supplierForm.supplierType}
                    onChange={(e) => setSupplierForm({ ...supplierForm, supplierType: e.target.value as any })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="Local">Local PH Supplier</option>
                    <option value="International">International Manufacturer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Vendor Registered Email</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Operator Telephone</label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Billing / Business Office Address</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* Step 4: Customer Form */}
          {activeStep === 'customer' && (
            <div className="space-y-4 text-left animate-in fade-in duration-200">
              <span className="text-[10px] font-extrabold text-indigo-400 font-mono tracking-widest uppercase block">&lt; Corporate Customer Registry /&gt;</span>
              <p className="text-gray-400 text-xs">Enter your primary active mining or civil engineering customer to sell fleet equipment or maintenance parts to.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Company / Entity Name *</label>
                  <input
                    type="text"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-semibold focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Business TIN Number (PH)</label>
                  <input
                    type="text"
                    value={customerForm.tin}
                    onChange={(e) => setCustomerForm({ ...customerForm, tin: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Accounts Email Address *</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Finance Contacts / Hotline</label>
                  <input
                    type="text"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 font-mono">Corporate Headquarters Address</label>
                <input
                  type="text"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            <button
              type="button"
              onClick={onLoadDefaults}
              className="text-slate-400 hover:text-white font-mono text-[10px] uppercase tracking-wider font-extrabold hover:underline cursor-pointer"
            >
              Skip & Load Standard Demo Seed Data instead
            </button>
          </div>
          <div className="flex gap-2">
            {activeStep === 'warehouse' && (
              <button
                type="button"
                onClick={() => setActiveStep('item')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg font-mono transition-colors cursor-pointer uppercase"
              >
                Next Step &gt;
              </button>
            )}
            {activeStep === 'item' && (
              <button
                type="button"
                onClick={() => setActiveStep('supplier')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg font-mono transition-colors cursor-pointer uppercase"
              >
                Next Step &gt;
              </button>
            )}
            {activeStep === 'supplier' && (
              <button
                type="button"
                onClick={() => setActiveStep('customer')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg font-mono transition-colors cursor-pointer uppercase"
              >
                Next Step &gt;
              </button>
            )}
            {activeStep === 'customer' && (
              <button
                type="button"
                onClick={handleFinish}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg font-mono transition-all duration-150 cursor-pointer uppercase shadow-md hover:scale-102 flex items-center gap-1"
              >
                <Plus className="w-4 h-4 text-emerald-200" />
                <span>Initialize Custom Registry</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
