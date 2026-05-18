"use client";

import { useState } from "react";
import {
  MousePointer2, Type, Table2, Pin, ImagePlus, Pencil, Eraser,
  Palette, PaintBucket, Undo2, Redo2, Sun, Moon,
} from "lucide-react";
import ColorPicker from "./ColorPicker";

export type ToolType = "select" | "text" | "table" | "pin" | "image" | "pen" | "eraser";

interface FloatingToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  penColor: string;
  onPenColorChange: (color: string) => void;
  bgColor: string;
  onBgColorChange: (color: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}

export default function FloatingToolbar({
  activeTool, onToolChange,
  penColor, onPenColorChange,
  bgColor, onBgColorChange,
  canUndo, canRedo, onUndo, onRedo,
  isDark, onToggleDark,
}: FloatingToolbarProps) {
  const [showPenColor, setShowPenColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);

  const ICON = 24;

  const toolBtn = (tool: ToolType, Icon: typeof Type, label: string) => (
    <button
      key={tool}
      onClick={() => onToolChange(tool)}
      className={`p-3 rounded-xl transition-all ${
        activeTool === tool
          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] hover:scale-105"
      }`}
      title={label}
    >
      <Icon size={ICON} />
    </button>
  );

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-4 py-3 bg-white/95 dark:bg-[#1e1e2e]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-[#444]">
      {toolBtn("select", MousePointer2, "선택")}
      {toolBtn("text", Type, "텍스트")}
      {toolBtn("table", Table2, "테이블")}
      {toolBtn("pin", Pin, "고정 메모")}
      {toolBtn("image", ImagePlus, "이미지")}

      <div className="w-px h-8 bg-gray-300 dark:bg-[#555] mx-1.5" />

      {toolBtn("pen", Pencil, "펜")}
      {toolBtn("eraser", Eraser, "지우개")}

      <div className="w-px h-8 bg-gray-300 dark:bg-[#555] mx-1.5" />

      {/* 색상 */}
      <div className="relative">
        <button
          onClick={() => { setShowPenColor(!showPenColor); setShowBgColor(false); }}
          className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] hover:scale-105 transition-all"
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
          className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] hover:scale-105 transition-all"
          title="배경색"
        >
          <PaintBucket size={ICON} />
          <span className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#1e1e2e] shadow-sm" style={{ backgroundColor: bgColor }} />
        </button>
        {showBgColor && <ColorPicker color={bgColor} onChange={onBgColorChange} onClose={() => setShowBgColor(false)} />}
      </div>

      <div className="w-px h-8 bg-gray-300 dark:bg-[#555] mx-1.5" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100"
        title="되돌리기 (Ctrl+Z)"
      >
        <Undo2 size={ICON} />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100"
        title="다시실행 (Ctrl+Y)"
      >
        <Redo2 size={ICON} />
      </button>

      <div className="w-px h-8 bg-gray-300 dark:bg-[#555] mx-1.5" />

      <button
        onClick={onToggleDark}
        className="p-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] hover:scale-105 transition-all"
        title={isDark ? "라이트 모드" : "다크 모드"}
      >
        {isDark ? <Sun size={ICON} /> : <Moon size={ICON} />}
      </button>
    </div>
  );
}
