"use client";

import { useRef, useState, useCallback } from "react";
import { X, Bold, Italic, Underline, ChevronDown } from "lucide-react";

export interface PinMemoData {
  id: string;
  x: number;
  y: number;
  title: string;
  body: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
}

interface PinMemoOverlayProps {
  memo: PinMemoData;
  onUpdate: (memo: PinMemoData) => void;
  onRemove: (id: string) => void;
}

const COLORS = ["#374151", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];
const SIZES = [12, 14, 16, 20, 24];

export default function PinMemoOverlay({ memo, onUpdate, onRemove }: PinMemoOverlayProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const fontSize = memo.fontSize || 14;
  const fontWeight = memo.fontWeight || "normal";
  const fontStyle = memo.fontStyle || "normal";
  const textDecoration = memo.textDecoration || "none";
  const color = memo.color || "#374151";

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

        {/* 서식 도구바 */}
        <div className="flex items-center gap-1 px-2 py-1.5 bg-yellow-50/80 border-b border-yellow-200">
          {/* Bold */}
          <button
            onClick={() => onUpdate({ ...memo, fontWeight: fontWeight === "bold" ? "normal" : "bold" })}
            className={`p-1 rounded transition-colors ${fontWeight === "bold" ? "bg-yellow-400/60 text-yellow-900" : "text-yellow-700 hover:bg-yellow-200/60"}`}
          >
            <Bold size={14} />
          </button>
          {/* Italic */}
          <button
            onClick={() => onUpdate({ ...memo, fontStyle: fontStyle === "italic" ? "normal" : "italic" })}
            className={`p-1 rounded transition-colors ${fontStyle === "italic" ? "bg-yellow-400/60 text-yellow-900" : "text-yellow-700 hover:bg-yellow-200/60"}`}
          >
            <Italic size={14} />
          </button>
          {/* Underline */}
          <button
            onClick={() => onUpdate({ ...memo, textDecoration: textDecoration === "underline" ? "none" : "underline" })}
            className={`p-1 rounded transition-colors ${textDecoration === "underline" ? "bg-yellow-400/60 text-yellow-900" : "text-yellow-700 hover:bg-yellow-200/60"}`}
          >
            <Underline size={14} />
          </button>

          <div className="w-px h-4 bg-yellow-300 mx-0.5" />

          {/* Font Size */}
          <div className="relative">
            <button
              onClick={() => setShowSizeMenu(!showSizeMenu)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs text-yellow-800 hover:bg-yellow-200/60 transition-colors"
            >
              {fontSize}px
              <ChevronDown size={10} />
            </button>
            {showSizeMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-yellow-300 py-1 z-50">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { onUpdate({ ...memo, fontSize: s }); setShowSizeMenu(false); }}
                    className={`block w-full px-3 py-1 text-left text-xs hover:bg-yellow-100 transition-colors ${fontSize === s ? "font-bold text-yellow-800 bg-yellow-50" : "text-gray-700"}`}
                  >
                    {s}px
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-yellow-300 mx-0.5" />

          {/* Colors */}
          <div className="flex items-center gap-0.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onUpdate({ ...memo, color: c })}
                className={`w-4 h-4 rounded-full border transition-transform ${color === c ? "border-yellow-700 scale-125" : "border-yellow-400 hover:scale-110"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* 본문 */}
        <textarea
          ref={bodyRef}
          value={memo.body}
          onChange={(e) => {
            onUpdate({ ...memo, body: e.target.value });
            if (bodyRef.current) {
              bodyRef.current.style.height = "auto";
              bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
            }
          }}
          className="w-full px-3 py-2 bg-transparent border-none outline-none resize-none placeholder-yellow-600/40"
          style={{
            minHeight: 60,
            fontSize,
            fontWeight,
            fontStyle,
            textDecoration,
            color,
          }}
          placeholder="메모 입력..."
          inputMode="text"
        />
      </div>
    </div>
  );
}
