import React, { useMemo } from 'react';

const barcodePatterns: Record<string, string> = {
  '0': '101001101101',
  '1': '110100101011',
  '2': '101100101011',
  '3': '110110010101',
  '4': '101001101011',
  '5': '110100110101',
  '6': '101100110101',
  '7': '101001011011',
  '8': '110100101101',
  '9': '101100101101',
  'A': '110101001011',
  'B': '101101001011',
  'C': '110110100101',
  'D': '101011001011',
  'E': '110101100101',
  'F': '101101100101',
  'G': '101010011011',
  'H': '110101001101',
  'I': '101101001101',
  'J': '101011001101',
  'K': '110101010011',
  'L': '101101010011',
  'M': '110110101001',
  'N': '101011010011',
  'O': '110101101001',
  'P': '101101101001',
  'Q': '101010110011',
  'R': '110101011001',
  'S': '101101011001',
  'T': '101011011001',
  'U': '110010101011',
  'V': '100110101011',
  'W': '110011010101',
  'X': '100101101011',
  'Y': '110010110101',
  'Z': '100110110101',
  '-': '101001101001',
  '.': '110100110100',
  ' ': '100110100101',
  '*': '100101101101' // Start/stop character
};

function getSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function VisualBarcode({ value, height = 45 }: { value: string; height?: number }) {
  const binary = useMemo(() => {
    let result = "1001011011010"; // Start character '*'
    const cleanValue = value.replace(/[^A-Z0-9\-\.\s]/gi, '').toUpperCase();
    for (let i = 0; i < cleanValue.length; i++) {
      const char = cleanValue[i];
      const pattern = barcodePatterns[char] || barcodePatterns['-'];
      result += pattern + "0";
    }
    result += "100101101101"; // Stop character '*'
    return result;
  }, [value]);

  return (
    <svg viewBox={`0 0 ${binary.length} ${height}`} className="w-full h-full text-slate-900" preserveAspectRatio="none">
      {binary.split("").map((bit, idx) => (
        bit === "1" ? (
          <rect key={idx} x={idx} y={0} width={1} height={height} fill="currentColor" />
        ) : null
      ))}
    </svg>
  );
}

export function VisualQRCode({ value, size = 21 }: { value: string; size?: number }) {
  const grid = useMemo(() => {
    const arr: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
    let seed = getSeed(value);

    // Helper to draw corner finders
    const drawFinder = (matrix: boolean[][], startRow: number, startCol: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[startRow + r][startCol + c] = isBorder || isInner;
        }
      }
    };

    // Fill procedural bits
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Skip corner finders (7x7 blocks in top-left, top-right, bottom-left)
        const isTopLeft = r < 7 && c < 7;
        const isTopRight = r < 7 && c >= size - 7;
        const isBottomLeft = r >= size - 7 && c < 7;
        if (isTopLeft || isTopRight || isBottomLeft) {
          continue;
        }

        // Skip standard timing patterns (line 6 index for rows and columns)
        if (r === 6 || c === 6) {
          arr[r][c] = (r % 2 === 0 || c % 2 === 0);
          continue;
        }

        // Draw alignment pattern around bottom-right for size >= 21
        if (size >= 21 && r >= size - 9 && r <= size - 5 && c >= size - 9 && c <= size - 5) {
          const dc = Math.max(Math.abs(r - (size - 7)), Math.abs(c - (size - 7)));
          arr[r][c] = (dc !== 1);
          continue;
        }

        // Seeded random boolean
        const rand = seededRandom(seed);
        seed += 17; // advance seed
        arr[r][c] = rand > 0.44;
      }
    }

    // Embed top-left finder (7x7)
    drawFinder(arr, 0, 0);

    // Embed top-right finder
    drawFinder(arr, 0, size - 7);

    // Embed bottom-left finder
    drawFinder(arr, size - 7, 0);

    return arr;
  }, [value, size]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full text-slate-900" shapeRendering="crispEdges">
      {grid.map((row, rIdx) => 
        row.map((val, cIdx) => 
          val ? (
            <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width={1} height={1} fill="currentColor" />
          ) : null
        )
      )}
    </svg>
  );
}

interface LogisticsBarcodeCardProps {
  orderNumber: string;
  type?: 'Purchase Order' | 'Sales Order';
  dateStr?: string;
  sourceHub?: string;
}

export function LogisticsBarcodeCard({ 
  orderNumber, 
  type = 'Purchase Order', 
  dateStr, 
  sourceHub 
}: LogisticsBarcodeCardProps) {
  return (
    <div className="bg-white border border-gray-150 rounded-xl p-4 space-y-4 shadow-3xs text-left animate-in fade-in duration-200">
      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
        <div className="space-y-0.5">
          <span className="text-[10px] font-black tracking-widest uppercase text-indigo-650 font-mono block">
            {type} BARCODE PASSPORT
          </span>
          <span className="text-xs font-bold text-gray-900 font-mono">
            {orderNumber}
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded uppercase">
          Scan Track Active
        </span>
      </div>

      <div className="grid grid-cols-12 gap-4 items-center">
        {/* QR Section */}
        <div className="col-span-4 flex flex-col items-center justify-center bg-gray-50 border border-gray-150 rounded-lg p-2.5 h-20 w-20 mx-auto">
          <div className="w-full h-full text-slate-800">
            <VisualQRCode value={orderNumber} />
          </div>
        </div>

        {/* 1D Barcode Section */}
        <div className="col-span-8 flex flex-col justify-between h-20 pl-2">
          <div className="h-10 w-full hover:opacity-90 transition-opacity">
            <VisualBarcode value={orderNumber} />
          </div>
          <div className="space-y-1 mt-1">
            <div className="text-[9px] font-mono text-center tracking-[4px] text-gray-800 font-bold select-all">
              *{orderNumber}*
            </div>
            <div className="flex justify-between text-[8.5px] text-gray-400 font-sans mt-0.5 font-medium">
              <span>{dateStr || 'N/A'}</span>
              <span className="truncate max-w-[120px]">{sourceHub || 'CODA Central Distribution'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
