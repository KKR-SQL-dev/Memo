"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { X, Bold, Italic, Underline, ChevronDown, Pin } from "lucide-react";

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

const COLORS = ["#000000", "#ffffff", "#ef4444", "#2563eb", "#16a34a", "#f59e0b"];
const SIZES = [14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 72, 80, 96];

export default function PinMemoOverlay({ memo, onUpdate, onRemove }: PinMemoOverlayProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const fontSize = memo.fontSize || 32;
  const fontWeight = memo.fontWeight || "normal";
  const fontStyle = memo.fontStyle || "normal";
  const textDecoration = memo.textDecoration || "none";
  const color = memo.color || "#000000";

  // 로드 시 또는 본문/폰트 변경 시 textarea 높이 자동 맞춤
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = "auto";
      bodyRef.current.style.height = bodyRef.current.scrollHeight + "px";
    }
  }, [memo.body, fontSize]);

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
      <div className="w-80 bg-amber-50 dark:bg-[#2a2a35] rounded-xl shadow-lg border border-amber-200 dark:border-[#3a3a45] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-100/60 dark:bg-[#32323e] border-b border-amber-200 dark:border-[#3a3a45]">
          <div className="flex items-center gap-2">
            <Pin size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <input
              type="text"
              value={memo.title}
              onChange={(e) => onUpdate({ ...memo, title: e.target.value })}
              className="bg-transparent border-none outline-none text-base font-semibold text-amber-900 dark:text-amber-100 w-44 placeholder-amber-400/60 dark:placeholder-amber-500/40"
              placeholder="제목"
            />
          </div>
          <button
            onClick={() => onRemove(memo.id)}
            className="opacity-60 group-hover:opacity-100 p-1.5 text-amber-500 dark:text-amber-400 hover:text-red-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 서식 도구바 */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50/60 dark:bg-[#2e2e3a] border-b border-amber-200 dark:border-[#3a3a45]">
          {/* Bold */}
          <button
            onClick={() => onUpdate({ ...memo, fontWeight: fontWeight === "bold" ? "normal" : "bold" })}
            className={`p-1.5 rounded-md transition-colors ${fontWeight === "bold" ? "bg-amber-300/50 dark:bg-amber-600/30 text-amber-900 dark:text-amber-200" : "text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-[#3a3a45]"}`}
          >
            <Bold size={16} />
          </button>
          {/* Italic */}
          <button
            onClick={() => onUpdate({ ...memo, fontStyle: fontStyle === "italic" ? "normal" : "italic" })}
            className={`p-1.5 rounded-md transition-colors ${fontStyle === "italic" ? "bg-amber-300/50 dark:bg-amber-600/30 text-amber-900 dark:text-amber-200" : "text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-[#3a3a45]"}`}
          >
            <Italic size={16} />
          </button>
          {/* Underline */}
          <button
            onClick={() => onUpdate({ ...memo, textDecoration: textDecoration === "underline" ? "none" : "underline" })}
            className={`p-1.5 rounded-md transition-colors ${textDecoration === "underline" ? "bg-amber-300/50 dark:bg-amber-600/30 text-amber-900 dark:text-amber-200" : "text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-[#3a3a45]"}`}
          >
            <Underline size={16} />
          </button>

          <div className="w-px h-5 bg-amber-300/60 dark:bg-[#444] mx-0.5" />

          {/* Font Size */}
          <div className="relative">
            <button
              onClick={() => setShowSizeMenu(!showSizeMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-sm text-amber-800 dark:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-[#3a3a45] transition-colors"
            >
              {fontSize}px
              <ChevronDown size={12} />
            </button>
            {showSizeMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#2a2a3e] rounded-lg shadow-lg border border-amber-200 dark:border-[#444] py-1 z-50 max-h-52 overflow-y-auto">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { onUpdate({ ...memo, fontSize: s }); setShowSizeMenu(false); }}
                    className={`block w-full px-4 py-1.5 text-left text-sm hover:bg-amber-100 dark:hover:bg-[#333] transition-colors ${fontSize === s ? "font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-[#333]" : "text-gray-600 dark:text-gray-300"}`}
                  >
                    {s}px
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-amber-300/60 dark:bg-[#444] mx-0.5" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onUpdate({ ...memo, color: c })}
                className={`w-5 h-5 rounded-full border-2 transition-colors ${color === c ? "border-amber-700 dark:border-amber-300 ring-1 ring-amber-400/50" : c === "#ffffff" ? "border-gray-300 dark:border-[#555] hover:border-amber-400" : "border-amber-300/60 dark:border-[#555] hover:border-amber-400 dark:hover:border-amber-400"}`}
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
          className="w-full px-4 py-3 bg-transparent border-none outline-none resize-none text-gray-700 dark:text-gray-200 placeholder-amber-400/40 dark:placeholder-amber-500/30"
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
