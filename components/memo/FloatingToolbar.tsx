"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  MousePointer2, Type, Table2, Pin, ImagePlus, Pencil, Eraser,
  Palette, PaintBucket, Undo2, Redo2, Sun, Moon, GripVertical, Keyboard,
  Hand, ZoomIn, ZoomOut, PenLine,
} from "lucide-react";
import ColorPicker from "./ColorPicker";

export type ToolType = "select" | "hand" | "text" | "handwriting" | "table" | "pin" | "image" | "pen" | "eraser";

interface FloatingToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  penColor: string;
  onPenColorChange: (color: string) => void;
  bgColor: string;
  onBgColorChange: (color: string) => void;
  eraserSize: number;
  onEraserSizeChange: (size: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export default function FloatingToolbar({
  activeTool, onToolChange,
  penColor, onPenColorChange,
  bgColor, onBgColorChange,
  eraserSize, onEraserSizeChange,
  canUndo, canRedo, onUndo, onRedo,
  onZoomIn, onZoomOut,
  isDark, onToggleDark,
}: FloatingToolbarProps) {
  const [showPenColor, setShowPenColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);
  const [showEraserSize, setShowEraserSize] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // 초기 위치 설정 (하단 중앙)
  useEffect(() => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    setPos({ x: (window.innerWidth - rect.width) / 2, y: window.innerHeight - rect.height - 24 });
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const cur = pos || { x: 0, y: 0 };
    dragRef.current = { startX: clientX, startY: clientY, origX: cur.x, origY: cur.y };
    setIsDragging(true);

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const cx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const cy = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      setPos({
        x: dragRef.current.origX + cx - dragRef.current.startX,
        y: dragRef.current.origY + cy - dragRef.current.startY,
      });
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
  }, [pos]);

  const ICON = 32;

  const toolBtn = (tool: ToolType, Icon: typeof Type, label: string) => (
    <button
      key={tool}
      onClick={() => onToolChange(tool)}
      className={`p-3 rounded-xl transition-colors ${
        activeTool === tool
          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"
      }`}
      title={label}
    >
      <Icon size={ICON} />
    </button>
  );

  return (
    <div
      ref={barRef}
      className="absolute z-50 flex items-center gap-1.5 px-4 py-3 bg-white/95 dark:bg-[#1e1e2e]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-[#444]"
      style={pos ? { left: pos.x, top: pos.y, cursor: isDragging ? "grabbing" : undefined } : { bottom: 24, left: "50%", transform: "translateX(-50%)" }}
    >
      {/* 드래그 핸들 */}
      <div
        className="flex items-center justify-center cursor-grab active:cursor-grabbing px-1 py-2 -ml-1 mr-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        title="드래그하여 이동"
      >
        <GripVertical size={24} />
      </div>
      {toolBtn("select", MousePointer2, "선택")}
      {toolBtn("hand", Hand, "화면 이동")}
      {toolBtn("text", Type, "텍스트")}
      {toolBtn("table", Table2, "테이블")}
      {toolBtn("pin", Pin, "고정 메모")}
      {toolBtn("image", ImagePlus, "이미지")}

      <div className="w-px h-10 bg-gray-300 dark:bg-[#555] mx-1.5" />

      {toolBtn("pen", Pencil, "펜")}
      {toolBtn("handwriting", PenLine, "스마트펜")}
      <div className="relative">
        <button
          onClick={() => { onToolChange("eraser"); setShowEraserSize(!showEraserSize); setShowPenColor(false); setShowBgColor(false); }}
          className={`p-3 rounded-xl transition-colors ${
            activeTool === "eraser"
              ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"
          }`}
          title="지우개"
        >
          <Eraser size={ICON} />
        </button>
        {showEraserSize && activeTool === "eraser" && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex items-end gap-3 px-4 py-3 bg-white dark:bg-[#2a2a3e] rounded-xl shadow-xl border border-gray-200 dark:border-[#444]">
            {[
              { size: 10, label: "S", display: 12 },
              { size: 25, label: "M", display: 18 },
              { size: 50, label: "L", display: 26 },
              { size: 80, label: "XL", display: 34 },
            ].map((opt) => (
              <button
                key={opt.size}
                onClick={() => { onEraserSizeChange(opt.size); setShowEraserSize(false); }}
                className={`flex flex-col items-center gap-1.5 transition-all ${eraserSize === opt.size ? "opacity-100" : "opacity-50 hover:opacity-80"}`}
              >
                <div
                  className={`rounded-full ${eraserSize === opt.size ? "bg-blue-500" : "bg-gray-400 dark:bg-gray-500"}`}
                  style={{ width: opt.display, height: opt.display }}
                />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-10 bg-gray-300 dark:bg-[#555] mx-1.5" />

      {/* 색상 */}
      <div className="relative">
        <button
          onClick={() => { setShowPenColor(!showPenColor); setShowBgColor(false); }}
          className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
          title="글자색"
        >
          <Palette size={ICON} />
          <span className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#1e1e2e] shadow-sm" style={{ backgroundColor: penColor }} />
        </button>
        {showPenColor && <ColorPicker color={penColor} onChange={onPenColorChange} onClose={() => setShowPenColor(false)} />}
      </div>

      <div className="relative">
        <button
          onClick={() => { setShowBgColor(!showBgColor); setShowPenColor(false); }}
          className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
          title="배경색"
        >
          <PaintBucket size={ICON} />
          <span className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#1e1e2e] shadow-sm" style={{ backgroundColor: bgColor }} />
        </button>
        {showBgColor && <ColorPicker color={bgColor} onChange={onBgColorChange} onClose={() => setShowBgColor(false)} />}
      </div>

      <div className="w-px h-10 bg-gray-300 dark:bg-[#555] mx-1.5" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors disabled:opacity-30"
        title="되돌리기 (Ctrl+Z)"
      >
        <Undo2 size={ICON} />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors disabled:opacity-30"
        title="다시실행 (Ctrl+Y)"
      >
        <Redo2 size={ICON} />
      </button>

      <div className="w-px h-10 bg-gray-300 dark:bg-[#555] mx-1.5" />

      <button
        onClick={onZoomOut}
        className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
        title="축소"
      >
        <ZoomOut size={ICON} />
      </button>
      <button
        onClick={onZoomIn}
        className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
        title="확대"
      >
        <ZoomIn size={ICON} />
      </button>

      <div className="w-px h-10 bg-gray-300 dark:bg-[#555] mx-1.5" />

      <button
        onClick={() => {
          // Windows 터치 키보드(TabTip.exe) 실행
          fetch("/api/keyboard", { method: "POST" });
        }}
        className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
        title="가상 키보드"
      >
        <Keyboard size={ICON} />
      </button>

      <button
        onClick={onToggleDark}
        className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
        title={isDark ? "라이트 모드" : "다크 모드"}
      >
        {isDark ? <Sun size={ICON} /> : <Moon size={ICON} />}
      </button>
    </div>
  );
}
