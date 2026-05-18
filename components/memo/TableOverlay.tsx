"use client";

import { useRef, useState, useCallback } from "react";
import { Plus, Minus, X, GripVertical } from "lucide-react";

export interface TableData {
  id: string;
  x: number;
  y: number;
  width: number;
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
  const resizeRef = useRef<{ startX: number; origW: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 드래그 이동
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("input, button, .resize-handle")) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: table.x, origY: table.y };
    setIsDragging(true);

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      onUpdate({ ...table, x: dragRef.current.origX + ev.clientX - dragRef.current.startX, y: dragRef.current.origY + ev.clientY - dragRef.current.startY });
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

  // 너비 리사이즈
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, origW: table.width };

    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const newW = Math.max(200, resizeRef.current.origW + ev.clientX - resizeRef.current.startX);
      onUpdate({ ...table, width: newW });
    };
    const handleUp = () => {
      resizeRef.current = null;
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
  const addCol = () => onUpdate({ ...table, rows: table.rows.map((r) => [...r, ""]) });
  const removeCol = () => {
    if ((table.rows[0]?.length || 0) <= 1) return;
    onUpdate({ ...table, rows: table.rows.map((r) => r.slice(0, -1)) });
  };

  const colCount = table.rows[0]?.length || 3;
  const cellW = Math.max(60, (table.width - 2) / colCount);

  return (
    <div
      className="absolute z-30 group"
      style={{ left: table.x, top: table.y, cursor: isDragging ? "grabbing" : "grab" }}
      onMouseDown={handleDragStart}
    >
      {/* 컨트롤 버튼 */}
      <div className="absolute -top-10 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={addRow} className="flex items-center gap-0.5 px-2 py-1 bg-emerald-500 text-white rounded-lg text-xs font-medium shadow-md hover:bg-emerald-600 transition-colors" title="행 추가">
          <Plus size={14} />행
        </button>
        <button onClick={removeRow} className="flex items-center gap-0.5 px-2 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium shadow-md hover:bg-orange-600 transition-colors" title="행 삭제">
          <Minus size={14} />행
        </button>
        <button onClick={addCol} className="flex items-center gap-0.5 px-2 py-1 bg-emerald-500 text-white rounded-lg text-xs font-medium shadow-md hover:bg-emerald-600 transition-colors" title="열 추가">
          <Plus size={14} />열
        </button>
        <button onClick={removeCol} className="flex items-center gap-0.5 px-2 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium shadow-md hover:bg-orange-600 transition-colors" title="열 삭제">
          <Minus size={14} />열
        </button>
        <button onClick={() => onRemove(table.id)} className="flex items-center gap-0.5 px-2 py-1 bg-red-500 text-white rounded-lg text-xs font-medium shadow-md hover:bg-red-600 transition-colors" title="삭제">
          <X size={14} />
        </button>
      </div>

      {/* 테이블 */}
      <table className="border-collapse shadow-xl rounded-xl overflow-hidden text-sm select-none" style={{ width: table.width }}>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`border border-gray-300 dark:border-[#555] px-0 py-0 ${
                    ri === 0 ? "text-white font-bold" : "bg-white dark:bg-[#2a2a3e]"
                  }`}
                  style={{ ...(ri === 0 ? { backgroundColor: table.headerColor } : {}), width: cellW }}
                >
                  <input
                    type="text"
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                    className={`w-full px-3 py-2.5 border-0 outline-none text-center text-sm ${
                      ri === 0
                        ? "bg-transparent text-white placeholder-white/50 font-bold"
                        : "bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600"
                    }`}
                    placeholder={ri === 0 ? "제목" : ""}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 리사이즈 핸들 */}
      <div
        className="resize-handle absolute top-0 -right-3 h-full w-3 cursor-col-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={handleResizeStart}
      >
        <GripVertical size={14} className="text-gray-400" />
      </div>
    </div>
  );
}
