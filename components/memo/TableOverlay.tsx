"use client";

import { useRef, useState, useCallback } from "react";
import { Plus, Minus, X } from "lucide-react";

export interface TableData {
  id: string;
  x: number;
  y: number;
  rows: string[][];
  headerColor: string;
}

interface TableOverlayProps {
  table: TableData;
  onUpdate: (table: TableData) => void;
  onRemove: (id: string) => void;
}

export default function TableOverlay({ table, onUpdate, onRemove }: TableOverlayProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("input, button")) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: table.x, origY: table.y };
    setIsDragging(true);

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onUpdate({ ...table, x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };

    const handleUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [table, onUpdate]);

  const updateCell = (row: number, col: number, value: string) => {
    const newRows = table.rows.map((r, ri) => r.map((c, ci) => (ri === row && ci === col ? value : c)));
    onUpdate({ ...table, rows: newRows });
  };

  const addRow = () => {
    const cols = table.rows[0]?.length || 3;
    onUpdate({ ...table, rows: [...table.rows, Array(cols).fill("")] });
  };

  const removeRow = () => {
    if (table.rows.length <= 1) return;
    onUpdate({ ...table, rows: table.rows.slice(0, -1) });
  };

  const addCol = () => {
    onUpdate({ ...table, rows: table.rows.map((r) => [...r, ""]) });
  };

  const removeCol = () => {
    if ((table.rows[0]?.length || 0) <= 1) return;
    onUpdate({ ...table, rows: table.rows.map((r) => r.slice(0, -1)) });
  };

  return (
    <div
      ref={tableRef}
      className="absolute z-30 group"
      style={{ left: table.x, top: table.y, cursor: isDragging ? "grabbing" : "grab" }}
      onMouseDown={handleDragStart}
    >
      {/* 컨트롤 버튼 */}
      <div className="absolute -top-8 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={addRow} className="p-1 bg-green-500 text-white rounded text-xs" title="행 추가">
          <Plus className="w-3 h-3" />R
        </button>
        <button onClick={removeRow} className="p-1 bg-orange-500 text-white rounded text-xs" title="행 삭제">
          <Minus className="w-3 h-3" />R
        </button>
        <button onClick={addCol} className="p-1 bg-green-500 text-white rounded text-xs" title="열 추가">
          <Plus className="w-3 h-3" />C
        </button>
        <button onClick={removeCol} className="p-1 bg-orange-500 text-white rounded text-xs" title="열 삭제">
          <Minus className="w-3 h-3" />C
        </button>
        <button onClick={() => onRemove(table.id)} className="p-1 bg-red-500 text-white rounded text-xs" title="테이블 삭제">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* 테이블 */}
      <table className="border-collapse shadow-lg rounded-lg overflow-hidden text-sm select-none">
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`border border-gray-300 dark:border-[#555] px-0 py-0 ${
                    ri === 0 ? "text-white font-bold" : "bg-white dark:bg-[#2a2a3e]"
                  }`}
                  style={ri === 0 ? { backgroundColor: table.headerColor } : undefined}
                >
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                    className={`w-full min-w-[80px] px-2 py-1.5 border-0 outline-none text-center ${
                      ri === 0
                        ? "bg-transparent text-white placeholder-white/60 font-bold"
                        : "bg-transparent text-gray-800 dark:text-gray-200"
                    }`}
                    placeholder={ri === 0 ? `열 ${ci + 1}` : ""}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
