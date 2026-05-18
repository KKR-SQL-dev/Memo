"use client";

import { useState } from "react";
import {
  MousePointer2, Type, Table2, Pin, ImagePlus, Pencil, Eraser,
  Palette, PaintBucket, Undo2, Redo2,
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
}

export default function FloatingToolbar({
  activeTool, onToolChange,
  penColor, onPenColorChange,
  bgColor, onBgColorChange,
  canUndo, canRedo, onUndo, onRedo,
}: FloatingToolbarProps) {
  const [showPenColor, setShowPenColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);

  const toolBtn = (tool: ToolType, Icon: typeof Type, label: string) => (
    <button
      key={tool}
      onClick={() => onToolChange(tool)}
      className={`p-2 rounded-lg transition-colors ${
        activeTool === tool
          ? "bg-blue-500 text-white"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"
      }`}
      title={label}
    >
      <Icon className="w-5 h-5" />
    </button>
  );

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 bg-white/95 dark:bg-[#1e1e2e]/95 backdrop-blur rounded-2xl shadow-xl border border-gray-200 dark:border-[#444]">
      {/* 객체 도구 */}
      {toolBtn("select", MousePointer2, "선택")}
      {toolBtn("text", Type, "텍스트")}
      {toolBtn("table", Table2, "테이블")}
      {toolBtn("pin", Pin, "고정 메모")}
      {toolBtn("image", ImagePlus, "이미지")}

      <div className="w-px h-6 bg-gray-300 dark:bg-[#555] mx-1" />

      {/* 드로잉 도구 */}
      {toolBtn("pen", Pencil, "펜")}
      {toolBtn("eraser", Eraser, "지우개")}

      <div className="w-px h-6 bg-gray-300 dark:bg-[#555] mx-1" />

      {/* 색상 */}
      <div className="relative">
        <button
          onClick={() => { setShowPenColor(!showPenColor); setShowBgColor(false); }}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
          title="글자색"
        >
          <Palette className="w-5 h-5" />
          <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-white dark:border-[#1e1e2e]" style={{ backgroundColor: penColor }} />
        </button>
        {showPenColor && <ColorPicker color={penColor} onChange={onPenColorChange} onClose={() => setShowPenColor(false)} />}
      </div>

      <div className="relative">
        <button
          onClick={() => { setShowBgColor(!showBgColor); setShowPenColor(false); }}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
          title="배경색"
        >
          <PaintBucket className="w-5 h-5" />
          <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-white dark:border-[#1e1e2e]" style={{ backgroundColor: bgColor }} />
        </button>
        {showBgColor && <ColorPicker color={bgColor} onChange={onBgColorChange} onClose={() => setShowBgColor(false)} />}
      </div>

      <div className="w-px h-6 bg-gray-300 dark:bg-[#555] mx-1" />

      {/* Undo/Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors disabled:opacity-30"
        title="되돌리기 (Ctrl+Z)"
      >
        <Undo2 className="w-5 h-5" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors disabled:opacity-30"
        title="다시실행 (Ctrl+Y)"
      >
        <Redo2 className="w-5 h-5" />
      </button>
    </div>
  );
}
