"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, IText, FabricImage, PencilBrush, Group, Rect, FabricObject } from "fabric";
import { io, Socket } from "socket.io-client";
import { Home, Save, Trash2 } from "lucide-react";
import FloatingToolbar, { type ToolType } from "./FloatingToolbar";
import TableOverlay, { type TableData } from "./TableOverlay";

// Fabric.js v6: 커스텀 프로퍼티를 직렬화에 포함시키기
const CUSTOM_PROPS = ["_customId"];
const origToObject = FabricObject.prototype.toObject;
FabricObject.prototype.toObject = function (propertiesToInclude?: string[]) {
  return origToObject.call(this, [...(propertiesToInclude || []), ...CUSTOM_PROPS]);
};

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function setObjId(obj: FabricObject, id?: string) {
  (obj as FabricObject & { _customId: string })._customId = id || genId();
}
function getObjId(obj: FabricObject): string {
  return (obj as FabricObject & { _customId: string })._customId || "";
}

const HEADER_H = 56;

export default function MemoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isRemoteAction = useRef(false);

  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [penColor, setPenColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [tables, setTables] = useState<TableData[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [isDark, setIsDark] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tablesRef = useRef<TableData[]>([]);
  tablesRef.current = tables;

  // ─── 다크모드 ───
  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("memo-theme", next ? "dark" : "light");
      if (next) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      return next;
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("memo-theme");
    if (saved === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  // ─── 캔버스 상태 스냅샷 (Undo/Redo) ───
  const saveSnapshot = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const json = JSON.stringify(fc.toJSON());
    setUndoStack((prev) => [...prev.slice(-49), json]);
    setRedoStack([]);
  }, []);

  // ─── 서버 저장 ───
  const saveToServer = useCallback(async () => {
    const fc = fabricRef.current;
    if (!fc) return;
    try {
      await fetch("/api/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas_json: JSON.stringify(fc.toJSON()),
          overlay_data: JSON.stringify(tablesRef.current),
          updated_by: "",
        }),
      });
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  }, []);

  const emitIfLocal = useCallback((event: string, data: unknown) => {
    if (!isRemoteAction.current && socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  // ─── 캔버스 초기화 ───
  useEffect(() => {
    if (!canvasRef.current) return;

    const fc = new Canvas(canvasRef.current, {
      width: window.innerWidth,
      height: window.innerHeight - HEADER_H,
      backgroundColor: bgColor,
      selection: true,
    });
    fabricRef.current = fc;

    const handleResize = () => {
      fc.setDimensions({ width: window.innerWidth, height: window.innerHeight - HEADER_H });
      fc.renderAll();
    };
    window.addEventListener("resize", handleResize);

    fc.on("object:modified", (e) => {
      if (!e.target) return;
      saveSnapshot();
      emitIfLocal("object:modified", { id: getObjId(e.target), data: e.target.toJSON() });
    });

    fc.on("object:removed", (e) => {
      if (!e.target) return;
      emitIfLocal("object:removed", { id: getObjId(e.target) });
    });

    fc.on("path:created", (e) => {
      const path = (e as unknown as { path: FabricObject }).path;
      if (path) {
        setObjId(path);
        saveSnapshot();
        emitIfLocal("drawing:path", { id: getObjId(path), data: path.toJSON() });
      }
    });

    // ─── 이미지 붙여넣기 (Ctrl+V) ───
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            FabricImage.fromURL(dataUrl).then((img) => {
              if (img.width && img.width > 800) img.scaleToWidth(800);
              img.set({ left: 100, top: 100 });
              setObjId(img);
              fc.add(img);
              fc.setActiveObject(img);
              fc.renderAll();
              saveSnapshot();
              emitIfLocal("object:added", { id: getObjId(img), data: img.toJSON() });
            });
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    document.addEventListener("paste", handlePaste);

    // ─── 키보드 ───
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;

      if (e.ctrlKey && e.key === "z") e.preventDefault();
      if (e.ctrlKey && e.key === "y") e.preventDefault();
      if (e.key === "Delete" || e.key === "Backspace") {
        const active = fc.getActiveObjects();
        if (active.length > 0) {
          active.forEach((obj) => {
            emitIfLocal("object:removed", { id: getObjId(obj) });
            fc.remove(obj);
          });
          fc.discardActiveObject();
          fc.renderAll();
          saveSnapshot();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // ─── 서버 로드 ───
    fetch("/api/memo")
      .then((r) => r.json())
      .then((data) => {
        if (data.canvas_json) {
          try {
            fc.loadFromJSON(JSON.parse(data.canvas_json)).then(() => {
              fc.getObjects().forEach((obj) => {
                const jsonObj = obj.toJSON() as { _customId?: string };
                if (jsonObj._customId) setObjId(obj, jsonObj._customId);
                else setObjId(obj);
              });
              fc.renderAll();
              saveSnapshot();
            });
          } catch { /* ignore */ }
        }
        if (data.overlay_data) {
          try { setTables(JSON.parse(data.overlay_data)); } catch { /* ignore */ }
        }
      })
      .catch(() => {});

    // ─── Socket.IO ───
    const socket = io({ transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("canvas:state", (data) => {
      isRemoteAction.current = true;
      if (data.canvas_json) {
        try {
          const parsed = typeof data.canvas_json === "string" ? JSON.parse(data.canvas_json) : data.canvas_json;
          fc.loadFromJSON(parsed).then(() => {
            fc.getObjects().forEach((obj) => {
              const jsonObj = obj.toJSON() as { _customId?: string };
              if (jsonObj._customId) setObjId(obj, jsonObj._customId);
            });
            fc.renderAll();
          });
        } catch { /* ignore */ }
      }
      if (data.overlay_data) {
        try {
          const parsed = typeof data.overlay_data === "string" ? JSON.parse(data.overlay_data) : data.overlay_data;
          setTables(parsed);
        } catch { /* ignore */ }
      }
      isRemoteAction.current = false;
    });

    socket.on("object:added", (data) => {
      isRemoteAction.current = true;
      fc.loadFromJSON({ version: fc.toJSON().version, objects: [data.data] }).then(() => {
        const objs = fc.getObjects();
        const lastObj = objs[objs.length - 1];
        if (lastObj) setObjId(lastObj, data.id);
        fc.renderAll();
      });
      isRemoteAction.current = false;
    });

    socket.on("object:modified", (data) => {
      isRemoteAction.current = true;
      const target = fc.getObjects().find((obj) => getObjId(obj) === data.id);
      if (target) {
        const idx = fc.getObjects().indexOf(target);
        fc.remove(target);
        fc.loadFromJSON({ version: fc.toJSON().version, objects: [data.data] }).then(() => {
          const objs = fc.getObjects();
          const newObj = objs[objs.length - 1];
          if (newObj) {
            setObjId(newObj, data.id);
            if (idx < objs.length - 1) fc.moveObjectTo(newObj, idx);
          }
          fc.renderAll();
        });
      }
      isRemoteAction.current = false;
    });

    socket.on("object:removed", (data) => {
      isRemoteAction.current = true;
      const target = fc.getObjects().find((obj) => getObjId(obj) === data.id);
      if (target) { fc.remove(target); fc.renderAll(); }
      isRemoteAction.current = false;
    });

    socket.on("drawing:path", (data) => {
      isRemoteAction.current = true;
      fc.loadFromJSON({ version: fc.toJSON().version, objects: [data.data] }).then(() => {
        const objs = fc.getObjects();
        const lastObj = objs[objs.length - 1];
        if (lastObj) setObjId(lastObj, data.id);
        fc.renderAll();
      });
      isRemoteAction.current = false;
    });

    socket.on("table:added", (data) => setTables((prev) => [...prev, data]));
    socket.on("table:update", (data) => setTables((prev) => prev.map((t) => (t.id === data.id ? data : t))));
    socket.on("table:removed", (data) => setTables((prev) => prev.filter((t) => t.id !== data.id)));

    socket.on("canvas:clear", () => {
      isRemoteAction.current = true;
      fc.clear();
      fc.backgroundColor = "#ffffff";
      fc.renderAll();
      setTables([]);
      isRemoteAction.current = false;
    });

    autoSaveTimer.current = setInterval(() => {
      saveToServer();
      if (socketRef.current) {
        socketRef.current.emit("canvas:sync", {
          canvas_json: JSON.stringify(fc.toJSON()),
          overlay_data: JSON.stringify(tablesRef.current),
        });
      }
    }, 30000);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("keydown", handleKeyDown);
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
      socket.disconnect();
      fc.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 도구 변경 ───
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    fc.isDrawingMode = false;
    fc.selection = true;
    fc.defaultCursor = "default";

    if (activeTool === "pen") {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.color = penColor;
      brush.width = 3;
      fc.freeDrawingBrush = brush;
    } else if (activeTool === "eraser") {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.color = bgColor;
      brush.width = 20;
      fc.freeDrawingBrush = brush;
    } else if (activeTool === "text" || activeTool === "pin" || activeTool === "table" || activeTool === "image") {
      fc.selection = false;
      fc.defaultCursor = "crosshair";
    }
  }, [activeTool, penColor, bgColor]);

  useEffect(() => {
    const fc = fabricRef.current;
    if (fc) { fc.backgroundColor = bgColor; fc.renderAll(); }
  }, [bgColor]);

  // ─── 캔버스 클릭 → 객체 생성 ───
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const handleMouseDown = (opt: { e: MouseEvent | TouchEvent; absolutePointer?: { x: number; y: number } }) => {
      const pointer = opt.absolutePointer || fc.getViewportPoint(opt.e as MouseEvent);
      if (!pointer) return;

      if (activeTool === "text") {
        const text = new IText("", {
          left: pointer.x, top: pointer.y, fontSize: 24,
          fill: penColor, fontFamily: "sans-serif", editable: true,
        });
        setObjId(text);
        fc.add(text);
        fc.setActiveObject(text);
        text.enterEditing();
        fc.renderAll();
        saveSnapshot();
        emitIfLocal("object:added", { id: getObjId(text), data: text.toJSON() });
        setActiveTool("select");
      } else if (activeTool === "pin") {
        const pinW = 280;
        const pinH = 140;
        const bg = new Rect({ width: pinW, height: pinH, fill: "#fffde7", rx: 12, ry: 12, stroke: "#fdd835", strokeWidth: 2 });
        const label = new IText("📌 메모", { left: 16, top: 14, fontSize: 18, fill: "#f57f17", fontWeight: "bold", fontFamily: "sans-serif" });
        const body = new IText("", { left: 16, top: 44, fontSize: 15, fill: "#333333", fontFamily: "sans-serif", width: pinW - 32 });
        const group = new Group([bg, label, body], { left: pointer.x, top: pointer.y, subTargetCheck: true, interactive: true });
        setObjId(group);
        fc.add(group);
        fc.setActiveObject(group);
        fc.renderAll();
        saveSnapshot();
        emitIfLocal("object:added", { id: getObjId(group), data: group.toJSON() });
        setActiveTool("select");
      } else if (activeTool === "table") {
        const newTable: TableData = {
          id: genId(), x: pointer.x, y: pointer.y, width: 400,
          rows: [["", "", ""], ["", "", ""], ["", "", ""]],
          headerColor: "#3b82f6",
        };
        setTables((prev) => [...prev, newTable]);
        emitIfLocal("table:added", newTable);
        setActiveTool("select");
      } else if (activeTool === "image") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            FabricImage.fromURL(dataUrl).then((img) => {
              if (img.width && img.width > 800) img.scaleToWidth(800);
              img.set({ left: pointer.x, top: pointer.y });
              setObjId(img);
              fc.add(img);
              fc.setActiveObject(img);
              fc.renderAll();
              saveSnapshot();
              emitIfLocal("object:added", { id: getObjId(img), data: img.toJSON() });
            });
          };
          reader.readAsDataURL(file);
        };
        input.click();
        setActiveTool("select");
      }
    };

    fc.on("mouse:down", handleMouseDown);
    return () => { fc.off("mouse:down", handleMouseDown); };
  }, [activeTool, penColor, saveSnapshot, emitIfLocal]);

  // ─── Undo/Redo ───
  const handleUndo = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc || undoStack.length <= 1) return;
    const newUndo = [...undoStack];
    const current = newUndo.pop()!;
    setRedoStack((prev) => [...prev, current]);
    setUndoStack(newUndo);
    const prevState = newUndo[newUndo.length - 1];
    if (prevState) {
      isRemoteAction.current = true;
      fc.loadFromJSON(JSON.parse(prevState)).then(() => { fc.renderAll(); isRemoteAction.current = false; });
    }
  }, [undoStack]);

  const handleRedo = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc || redoStack.length === 0) return;
    const newRedo = [...redoStack];
    const nextState = newRedo.pop()!;
    setRedoStack(newRedo);
    setUndoStack((prev) => [...prev, nextState]);
    isRemoteAction.current = true;
    fc.loadFromJSON(JSON.parse(nextState)).then(() => { fc.renderAll(); isRemoteAction.current = false; });
  }, [redoStack]);

  const handleTableUpdate = useCallback((updated: TableData) => {
    setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    emitIfLocal("table:update", updated);
  }, [emitIfLocal]);

  const handleTableRemove = useCallback((id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
    emitIfLocal("table:removed", { id });
  }, [emitIfLocal]);

  const handleSave = useCallback(async () => {
    await saveToServer();
    const fc = fabricRef.current;
    if (fc && socketRef.current) {
      socketRef.current.emit("canvas:sync", {
        canvas_json: JSON.stringify(fc.toJSON()),
        overlay_data: JSON.stringify(tablesRef.current),
      });
    }
  }, [saveToServer]);

  const handleClear = useCallback(async () => {
    if (!confirm("메모판을 전체삭제 하시겠습니까?")) return;
    const fc = fabricRef.current;
    if (fc) { fc.clear(); fc.backgroundColor = "#ffffff"; fc.renderAll(); }
    setTables([]);
    setBgColor("#ffffff");
    setUndoStack([]);
    setRedoStack([]);
    socketRef.current?.emit("canvas:clear");
    try { await fetch("/api/memo/clear", { method: "POST" }); } catch { /* ignore */ }
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white dark:bg-[#121218]">
      {/* ─── 상단 헤더 ─── */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-5 bg-white dark:bg-[#1a1a2e] border-b border-gray-200 dark:border-[#333]" style={{ height: HEADER_H }}>
        <div className="flex items-center gap-4">
          <a
            href="http://192.168.107.6:3501"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
            title="쿠라레 메인 포탈"
          >
            <Home size={22} />
            <span className="text-sm font-medium hidden sm:inline">메인 포탈</span>
          </a>
          <div className="w-px h-6 bg-gray-200 dark:bg-[#444]" />
          <span className="text-lg font-bold text-gray-800 dark:text-white">메모장</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors shadow-md shadow-blue-500/20"
          >
            <Save size={18} />
            저장
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shadow-md shadow-red-500/20"
          >
            <Trash2 size={18} />
            전체삭제
          </button>
        </div>
      </div>

      {/* Fabric.js 캔버스 */}
      <canvas ref={canvasRef} className="absolute left-0" style={{ top: HEADER_H }} />

      {/* 테이블 오버레이 */}
      {tables.map((table) => (
        <TableOverlay key={table.id} table={table} onUpdate={handleTableUpdate} onRemove={handleTableRemove} />
      ))}

      {/* 플로팅 툴바 */}
      <FloatingToolbar
        activeTool={activeTool} onToolChange={setActiveTool}
        penColor={penColor} onPenColorChange={setPenColor}
        bgColor={bgColor} onBgColorChange={setBgColor}
        canUndo={undoStack.length > 1} canRedo={redoStack.length > 0}
        onUndo={handleUndo} onRedo={handleRedo}
        isDark={isDark} onToggleDark={toggleDark}
      />
    </div>
  );
}
