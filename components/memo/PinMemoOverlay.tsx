"use client";

import { useRef, useState, useCallback } from "react";
import { X, GripHorizontal } from "lucide-react";

export interface PinMemoData {
  id: string;
  x: number;
  y: number;
  title: string;
  body: string;
}

interface PinMemoOverlayProps {
  memo: PinMemoData;
  onUpdate: (memo: PinMemoData) => void;
  onRemove: (id: string) => void;
}

export default function PinMemoOverlay({ memo, onUpdate, onRemove }: PinMemoOverlayProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("textarea, input, button")) return;
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX, startY: clientY, origX: memo.x, origY: memo.y };
    setIsDragging(true);

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const cx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const cy = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      onUpdate({ ...memo, x: dragRef.current.origX + cx - dragRef.current.startX, y: dragRef.current.origY + cy - dragRef.current.startY });
    };
    const handleUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
  }, [memo, onUpdate]);

  return (
    <div
      className="absolute z-30 group"
      style={{ left: memo.x, top: memo.y, cursor: isDragging ? "grabbing" : "grab" }}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
    >
      <div className="w-72 bg-[#fffde7] rounded-xl shadow-lg border border-yellow-300 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 bg-yellow-100/80 border-b border-yellow-200">
          <div className="flex items-center gap-1.5">
            <span className="text-base">📌</span>
            <input
              type="text"
              value={memo.title}
              onChange={(e) => onUpdate({ ...memo, title: e.target.value })}
              className="bg-transparent border-none outline-none text-sm font-bold text-yellow-800 w-36 placeholder-yellow-600/50"
              placeholder="제목"
            />
          </div>
          <button
            onClick={() => onRemove(memo.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-yellow-600 hover:text-red-500 transition-all"
          >
            <X size={14} />
          </button>
        </div>
        {/* 본문 */}
        <textarea
          ref={bodyRef}
          value={memo.body}
          onChange={(e) => {
            onUpdate({ ...memo, body: e.target.value });
            // 자동 높이 조절
            if (bodyRef.current) {
              bodyRef.current.style.height = "auto";
              bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
            }
          }}
          className="w-full px-3 py-2 bg-transparent border-none outline-none text-sm text-gray-700 resize-none placeholder-yellow-600/40"
          style={{ minHeight: 60 }}
          placeholder="메모 입력..."
          inputMode="text"
        />
      </div>
    </div>
  );
}
