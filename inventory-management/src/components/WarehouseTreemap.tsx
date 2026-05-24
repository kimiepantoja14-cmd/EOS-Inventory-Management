/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Warehouse, Item, StockTransfer } from '../types';
import { Package, ArrowLeftRight, Search, Move } from 'lucide-react';

interface WarehouseTreemapProps {
  warehouses: Warehouse[];
  items: Item[];
  onSelectWarehouse?: (wh: Warehouse) => void;
  onExecuteStockTransfer?: (transfer: Omit<StockTransfer, 'id' | 'transferNumber' | 'status'>) => void;
}

export default function WarehouseTreemap({ warehouses, items, onSelectWarehouse, onExecuteStockTransfer }: WarehouseTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 280 });
  const [dragQtyOption, setDragQtyOption] = useState<'1' | '5' | '10' | 'all'>('5');
  const [itemSearch, setItemSearch] = useState('');

  // Handle Resize of Treemap SVG
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        // Keep it responsive, leaving space for the side-car if screen is wide
        const calculatedWidth = width > 768 ? Math.floor(width * 0.62) : width;
        setDimensions({
          width: Math.max(300, calculatedWidth),
          height: 240
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute Draggable Stock Pills (items with live stock)
  const stockPills = useMemo(() => {
    const list: { itemId: string; itemSku: string; itemName: string; warehouseId: string; warehouseName: string; qty: number }[] = [];
    items.forEach(item => {
      if (item.stockByWarehouse) {
        Object.entries(item.stockByWarehouse).forEach(([whId, qty]) => {
          if (qty > 0) {
            const wh = warehouses.find(w => w.id === whId);
            list.push({
              itemId: item.id,
              itemSku: item.sku,
              itemName: item.name,
              warehouseId: whId,
              warehouseName: wh ? wh.code : 'Unknown',
              qty
            });
          }
        });
      }
    });

    if (itemSearch.trim()) {
      const q = itemSearch.toLowerCase();
      return list.filter(p => 
        p.itemSku.toLowerCase().includes(q) || 
        p.itemName.toLowerCase().includes(q) || 
        p.warehouseName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, warehouses, itemSearch]);

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || warehouses.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Setup Hierarchical data structure
    const data = {
      name: "Root",
      children: warehouses.map(wh => {
        const totalQty = items.reduce((sum, item) => sum + (item.stockByWarehouse?.[wh.id] || 0), 0);
        const maxCap = wh.maxCapacity || 1000;
        const utilization = Math.min(100, Math.round((totalQty / maxCap) * 100));
        return {
          id: wh.id,
          name: wh.name,
          code: wh.code,
          value: Math.max(150, maxCap), // area proportional to warehouse capacity
          totalQty,
          maxCap,
          utilization
        };
      })
    };

    const rootNode = d3.hierarchy(data)
      .sum(d => (d as any).value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.treemap()
      .size([width, height])
      .paddingInner(4)
      .paddingOuter(2)
      .round(true)(rootNode);

    // Green -> Amber -> Red utilization colors
    const selectColor = (pct: number) => {
      const interpolator = d3.interpolateRgbBasis([
        "rgb(34, 197, 94)",  // safe emerald-500
        "rgb(245, 158, 11)", // warning amber-500
        "rgb(239, 68, 68)"   // hazard rose-500
      ]);
      return interpolator(Math.min(100, Math.max(0, pct)) / 100);
    };

    const leaves = rootNode.leaves();

    const cell = svg.selectAll("g")
      .data(leaves)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${(d as any).x0},${(d as any).y0})`);

    // Rectangles for Treemap leaves
    cell.append("rect")
      .attr("width", d => Math.max(0, (d as any).x1 - (d as any).x0))
      .attr("height", d => Math.max(0, (d as any).y1 - (d as any).y0))
      .attr("fill", d => selectColor((d.data as any).utilization))
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("class", "transition-all duration-200 stroke-white/20 stroke-1 cursor-pointer hover:opacity-90 hover:stroke-white/80")
      .on("click", (event, d) => {
        const wh = warehouses.find(w => w.id === (d.data as any).id);
        if (wh && onSelectWarehouse) {
          onSelectWarehouse(wh);
        }
      });

    // INTEGRATE THE HTML5 DRAG EVENTS OVER THE D3 NODES
    // This allows seamless dragging of cargo lists and dropping directly into physical depots
    cell.on("dragover", function(event) {
      event.preventDefault();
      d3.select(this).select("rect")
        .attr("stroke", "#4f46e5")
        .attr("stroke-width", "3px")
        .attr("stroke-dasharray", "4 2")
        .attr("class", "opacity-95 shadow-lg shadow-indigo-500/20");
    })
    .on("dragleave", function() {
      d3.select(this).select("rect")
        .attr("stroke", "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", "1px")
        .attr("stroke-dasharray", null)
        .attr("class", "transition-all duration-200 stroke-white/20 stroke-1 cursor-pointer hover:opacity-90 hover:stroke-white/80");
    })
    .on("drop", function(event, d) {
      event.preventDefault();
      d3.select(this).select("rect")
        .attr("stroke", "rgba(255, 255, 255, 0.2)")
        .attr("stroke-width", "1px")
        .attr("stroke-dasharray", null);

      try {
        const dataStr = event.dataTransfer.getData("application/json");
        if (!dataStr) return;
        
        const dragData = JSON.parse(dataStr);
        const destWhId = (d.data as any).id;

        if (dragData.sourceWarehouseId === destWhId) {
          return;
        }

        const maxAvailable = dragData.quantity;
        let transQty = 0;
        if (dragQtyOption === 'all') {
          transQty = maxAvailable;
        } else {
          transQty = Math.min(maxAvailable, Number(dragQtyOption));
        }

        if (transQty <= 0) return;

        if (onExecuteStockTransfer) {
          onExecuteStockTransfer({
            sourceWarehouseId: dragData.sourceWarehouseId,
            destinationWarehouseId: destWhId,
            transferDate: new Date().toISOString().split('T')[0],
            notes: `DND Treemap Balance Reallocation: Shifted ${transQty} units to ${(d.data as any).code}`,
            items: [{
              itemId: dragData.itemId,
              quantity: transQty
            }]
          });
        }
      } catch (err) {
        console.error("DND execution failed inside Treemap drop handler", err);
      }
    });

    // Site Code Name text
    cell.append("text")
      .attr("x", 8)
      .attr("y", 18)
      .attr("fill", "#ffffff")
      .attr("font-size", "11px")
      .attr("font-weight", "800")
      .attr("font-family", "Inter, sans-serif")
      .attr("class", "pointer-events-none drop-shadow-sm select-none")
      .text(d => (d.data as any).code);

    // Site descriptive name text
    cell.append("text")
      .attr("x", 8)
      .attr("y", 30)
      .attr("fill", "rgba(255,255,255,0.85)")
      .attr("font-size", "8.5px")
      .attr("font-weight", "500")
      .attr("font-family", "Inter, sans-serif")
      .attr("class", "pointer-events-none drop-shadow-sm select-none")
      .text(d => {
        const name = (d.data as any).name;
        return name.length > 18 ? name.substring(0, 18) + '...' : name;
      });

    // Utilization statistics label
    cell.append("text")
      .attr("x", 8)
      .attr("y", 44)
      .attr("fill", "rgba(255, 255, 255, 0.95)")
      .attr("font-size", "9px")
      .attr("font-weight", "700")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("class", "pointer-events-none select-none")
      .text(d => {
        const dData = d.data as any;
        return `${dData.totalQty.toLocaleString()} / ${dData.maxCap.toLocaleString()} (${dData.utilization}%)`;
      });

  }, [dimensions, warehouses, items, dragQtyOption, onExecuteStockTransfer]);

  return (
    <div ref={containerRef} className="w-full bg-slate-50 p-4 rounded-xl border border-gray-200/60 shadow-2xs">
      {/* Title block */}
      <div className="w-full flex items-center justify-between mb-4 border-b border-gray-200/50 pb-2.5">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-indigo-600 animate-pulse" />
          <h3 className="text-xs font-mono font-black text-slate-800 uppercase tracking-widest">
            Holographic Cargo Relocation Terminal
          </h3>
        </div>
        <span className="text-[9px] font-mono text-slate-550 shrink-0 flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 bg-emerald-500 rounded-sm h-2" /> &lt;35%</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 bg-amber-500 rounded-sm h-2" /> 35%-75%</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 bg-rose-500 rounded-sm h-2" /> &gt;75%</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left column: Draggable stock manager deck */}
        <div className="md:col-span-4 bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-3xs flex flex-col space-y-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-indigo-600 block">
              💡 Drag & Drop Re-Allocation
            </span>
            <span className="text-[9px] text-slate-450 block leading-tight mt-0.5">
              Drag SKU cards directly over any warehouse node inside the Treemap to execute local stock transfers.
            </span>
          </div>

          {/* Transfer Quantity Unit configuration */}
          <div className="space-y-1 bg-slate-50 p-2 rounded-md border border-slate-100">
            <label className="text-[9px] font-bold uppercase text-slate-500 tracking-wider font-mono">
              Drag Transfer Quantity:
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(['1', '5', '10', 'all'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDragQtyOption(opt)}
                  className={`py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                    dragQtyOption === opt
                      ? 'bg-indigo-600 text-white font-black'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {opt === 'all' ? 'All' : `${opt}`}
                </button>
              ))}
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter draggable SKU..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full text-[10px] pl-8 pr-2 py-1.5 bg-slate-50 text-slate-700 rounded border border-slate-200/80 focus:outline-none focus:bg-white placeholder-slate-405 font-mono"
            />
          </div>

          {/* Draggable list container */}
          <div className="space-y-1 px-0.5 max-h-[160px] overflow-y-auto divide-y divide-slate-100 pr-1">
            {stockPills.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-[10px] italic">
                {itemSearch ? "No matching stock pills." : "No live stock available for transfer."}
              </div>
            ) : (
              stockPills.map((pill, i) => (
                <div
                  key={`${pill.itemId}-${pill.warehouseId}-${i}`}
                  draggable={true}
                  onDragStart={(e) => {
                    const dataPayload = {
                      itemId: pill.itemId,
                      itemSku: pill.itemSku,
                      sourceWarehouseId: pill.warehouseId,
                      quantity: pill.qty
                    };
                    e.dataTransfer.setData("application/json", JSON.stringify(dataPayload));
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="py-1.5 px-2 bg-slate-50/50 hover:bg-indigo-50/45 border border-slate-150 rounded cursor-grab active:cursor-grabbing hover:border-indigo-200 transition-all flex items-center justify-between text-[10px]"
                >
                  <div className="flex items-center gap-1.5 select-none font-mono">
                    <Move className="w-3 h-3 text-slate-450 cursor-grab shrink-0" />
                    <div>
                      <strong className="text-slate-800 tracking-tight">{pill.itemSku}</strong>
                      <span className="text-slate-450 font-normal block text-[9px] -mt-0.5">
                        origin: {pill.warehouseName}
                      </span>
                    </div>
                  </div>
                  <span className="bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.2 rounded font-mono text-[9px]">
                    {pill.qty}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column: Interactive D3 Treemap Node */}
        <div className="md:col-span-8 flex flex-col items-center">
          <svg 
            ref={svgRef} 
            width={dimensions.width} 
            height={dimensions.height}
            className="rounded-lg border border-gray-200 bg-white/40 shadow-inner select-none max-w-full"
          />
          <div className="text-[10px] text-gray-400 mt-2 font-mono flex items-center gap-1">
            <span>💡 Hint: Click any node box to see site blueprints. Drop cargo files into boxes to transfer.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
