"use client";

import { useRef, useEffect } from "react";

const PRESET_COLORS = [
  "#1f2937", "#ffffff", "#c07070", "#d4956b", "#b8a060",
  "#6ba37a", "#6b8db5", "#8b7ab5", "#b57b9d", "#8b8b8b",
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
      className="absolute bottom-full mb-3 p-4 bg-white dark:bg-[#2a2a3e] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#444] z-50"
    >
      <div className="grid grid-cols-5 gap-2 mb-3">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => { onChange(c); onClose(); }}
            className={`w-9 h-9 rounded-lg border-2 transition-colors ${
              color === c ? "border-blue-500 shadow-md ring-1 ring-blue-300/50" : "border-gray-200 dark:border-[#555] hover:border-gray-400 dark:hover:border-gray-400"
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 pt-3 border-t border-gray-200 dark:border-[#444]">
        <input
          type="color"
          value={color}
          onChange={(e) => { onChange(e.target.value); onClose(); }}
          className="w-10 h-10 cursor-pointer rounded-lg border-0"
        />
        <span className="text-sm text-gray-500 font-mono">{color}</span>
      </div>
    </div>
  );
}
