"use client";

import { useRef, useEffect } from "react";

const PRESET_COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#78716c", "#0ea5e9",
  "#14b8a6", "#a3e635", "#fbbf24", "#f87171", "#c084fc", "#fb923c",
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

export default function ColorPicker({ color, onChange, onClose }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 p-3 bg-white dark:bg-[#2a2a3e] rounded-xl shadow-xl border border-gray-200 dark:border-[#444] z-50"
    >
      <div className="grid grid-cols-6 gap-1.5 mb-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => { onChange(c); onClose(); }}
            className={`w-7 h-7 rounded-md border-2 transition-transform hover:scale-110 ${
              color === c ? "border-blue-500 scale-110" : "border-gray-300 dark:border-[#555]"
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-[#444]">
        <input
          type="color"
          value={color}
          onChange={(e) => { onChange(e.target.value); onClose(); }}
          className="w-8 h-8 cursor-pointer rounded border-0"
        />
        <span className="text-xs text-gray-500">{color}</span>
      </div>
    </div>
  );
}
