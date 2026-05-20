"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, IText, FabricImage, PencilBrush, FabricObject, Point, util } from "fabric";
import { io, Socket } from "socket.io-client";
import { Home, Trash2, Maximize2, X, History } from "lucide-react";
import FloatingToolbar, { type ToolType } from "./FloatingToolbar";
import TableOverlay, { type TableData } from "./TableOverlay";
import PinMemoOverlay, { type PinMemoData } from "./PinMemoOverlay";

// Fabric.js v6: 커스텀 프로퍼티를 직렬화에 포함
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

const HEADER_H = 52;

export default function MemoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isRemoteAction = useRef(false);
  const skipFlushRef = useRef(false);
  const zoomRef = useRef(1);

  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [isFitAll, setIsFitAll] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [penColor, setPenColor] = useState("#ffffff");
  const [bgColor, setBgColor] = useState(() => {
    if (typeof window === "undefined") return "#ffffff";
    return localStorage.getItem("memo-theme") === "dark" ? "#1e1e2e" : "#ffffff";
  });
  const [tables, setTables] = useState<TableData[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const dark = localStorage.getItem("memo-theme") === "dark";
    if (dark) document.documentElement.classList.add("dark");
    return dark;
  });
  const [eraserSize, setEraserSize] = useState(25);
  const [textInput, setTextInput] = useState<{ x: number; y: number; sceneX: number; sceneY: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  const [textSize, setTextSize] = useState(32);
  const [pinMemos, setPinMemos] = useState<PinMemoData[]>([]);
  const [deleteBtn, setDeleteBtn] = useState<{ x: number; y: number } | null>(null);
  const [selectedTextInfo, setSelectedTextInfo] = useState<{
    obj: IText; x: number; y: number;
  } | null>(null);
  const pinMemosRef = useRef<PinMemoData[]>([]);
  pinMemosRef.current = pinMemos;
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const tablesRef = useRef<TableData[]>([]);
  tablesRef.current = tables;
  const bgColorRef = useRef(bgColor);
  bgColorRef.current = bgColor;
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── 다크모드 ───
  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("memo-theme", next ? "dark" : "light");
      if (next) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      const fc = fabricRef.current;
      if (fc) {
        const newBg = next ? "#1e1e2e" : "#ffffff";
        setBgColor(newBg);
        fc.backgroundColor = newBg;
        fc.renderAll();
      }
      return next;
    });
  }, []);


  // ─── 스냅샷 ───
  const saveSnapshot = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    const json = JSON.stringify(fc.toJSON());
    setUndoStack((prev) => [...prev.slice(-49), json]);
    setRedoStack([]);
  }, []);

  // ─── 즉시 저장 (flush) ───
  const flushSave = useCallback(() => {
    if (skipFlushRef.current) return;
    const fc = fabricRef.current;
    if (!fc) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    try {
      const payload = {
        canvas_json: JSON.stringify(fc.toJSON()),
        overlay_data: JSON.stringify({ tables: tablesRef.current, pins: pinMemosRef.current }),
        updated_by: "",
      };
      // sendBeacon은 페이지 종료 시에도 확실히 전송됨
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon("/api/memo", blob);
      if (socketRef.current) {
        socketRef.current.emit("canvas:sync", {
          canvas_json: payload.canvas_json,
          overlay_data: payload.overlay_data,
        });
      }
    } catch { /* ignore */ }
  }, []);
  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;

  // ─── 자동저장 (변경 시 1.5초 뒤 저장) ───
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const fc = fabricRef.current;
      if (!fc) return;
      try {
        const payload = {
          canvas_json: JSON.stringify(fc.toJSON()),
          overlay_data: JSON.stringify({ tables: tablesRef.current, pins: pinMemosRef.current }),
          updated_by: "",
        };
        await fetch("/api/memo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (socketRef.current) {
          socketRef.current.emit("canvas:sync", {
            canvas_json: payload.canvas_json,
            overlay_data: payload.overlay_data,
          });
        }
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 1500);
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
    let disposed = false;

    const handleResize = () => {
      fc.setDimensions({ width: window.innerWidth, height: window.innerHeight - HEADER_H });
      fc.renderAll();
    };
    window.addEventListener("resize", handleResize);

    // 페이지 종료/새로고침 시 미저장 데이터 즉시 저장
    const handleBeforeUnload = () => { flushRef.current(); };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // ─── 마우스 휠 줌 & 가로 스크롤 ───
    fc.on("mouse:wheel", (opt) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();
      if (e.altKey) {
        // Alt+휠 → 가로 스크롤
        fc.relativePan(new Point(-e.deltaY, 0));
      } else {
        const delta = e.deltaY;
        let zoom = fc.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 5) zoom = 5;
        if (zoom < 0.3) zoom = 0.3;
        fc.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom);
        zoomRef.current = zoom;
      }
    });

    // ─── 캔버스 패닝 (Alt+드래그 / 가운데 버튼 / 손바닥 도구) ───
    let isPanning = false;
    let panLastPos = { x: 0, y: 0 };
    fc.on("mouse:down", (opt) => {
      const e = opt.e as MouseEvent;
      if (e.altKey || e.button === 1 || activeToolRef.current === "hand") {
        isPanning = true;
        panLastPos = { x: e.clientX, y: e.clientY };
        fc.selection = false;
        fc.defaultCursor = "grabbing";
        e.preventDefault();
      }
    });
    fc.on("mouse:move", (opt) => {
      if (!isPanning) return;
      const e = opt.e as MouseEvent;
      fc.relativePan(new Point(e.clientX - panLastPos.x, e.clientY - panLastPos.y));
      panLastPos = { x: e.clientX, y: e.clientY };
    });
    fc.on("mouse:up", () => {
      if (!isPanning) return;
      isPanning = false;
      if (activeToolRef.current === "hand") {
        fc.defaultCursor = "grab";
      } else {
        fc.selection = true;
        fc.defaultCursor = "default";
      }
    });

    // ─── 오버레이(핀메모/표) 동기화: 캔버스 줌·팬에 맞춰 CSS 변환 ───
    const syncOverlay = () => {
      if (!overlayRef.current) return;
      const vt = fc.viewportTransform;
      if (!vt) return;
      const zoom = vt[0], panX = vt[4], panY = vt[5];
      zoomRef.current = zoom;
      const ty = HEADER_H * (1 - zoom) + panY;
      if (zoom === 1 && panX === 0 && ty === 0) {
        overlayRef.current.style.transform = "";
      } else {
        overlayRef.current.style.transform = `matrix(${zoom},0,0,${zoom},${panX},${ty})`;
        overlayRef.current.style.transformOrigin = "0 0";
      }
    };
    fc.on("after:render", syncOverlay);

    // ─── Fabric 이벤트 ───
    fc.on("object:modified", (e) => {
      if (!e.target) return;
      saveSnapshot();
      scheduleSave();
      emitIfLocal("object:modified", { id: getObjId(e.target), data: e.target.toJSON() });
      updateSelection();
    });

    fc.on("object:removed", (e) => {
      if (!e.target) return;
      scheduleSave();
      emitIfLocal("object:removed", { id: getObjId(e.target) });
    });

    // ─── 선택 시 삭제 버튼 + 텍스트 서식 도구바 표시 ───
    const updateSelection = () => {
      const active = fc.getActiveObject();
      if (active) {
        const bound = active.getBoundingRect();
        setDeleteBtn({ x: bound.left + bound.width + 4, y: bound.top - 4 });
        if (active.type === "i-text") {
          setSelectedTextInfo({
            obj: active as IText,
            x: bound.left + bound.width / 2,
            y: bound.top - 10,
          });
        } else {
          setSelectedTextInfo(null);
        }
      } else {
        setDeleteBtn(null);
        setSelectedTextInfo(null);
      }
    };
    fc.on("selection:created", updateSelection);
    fc.on("selection:updated", updateSelection);
    fc.on("selection:cleared", () => { setDeleteBtn(null); setSelectedTextInfo(null); });

    fc.on("path:created", (e) => {
      const path = (e as unknown as { path: FabricObject }).path;
      if (path) {
        setObjId(path);
        if (activeToolRef.current !== "handwriting") {
          emitIfLocal("drawing:path", { id: getObjId(path), data: path.toJSON() });
          scheduleSave();
        }
        // 스트로크 간 끊김 방지: 스냅샷을 다음 프레임으로 지연
        requestAnimationFrame(() => saveSnapshot());
      }
    });

    // ─── 이미지 붙여넣기 ───
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
            FabricImage.fromURL(reader.result as string).then((img) => {
              if (img.width && img.width > 800) img.scaleToWidth(800);
              img.set({ left: 100, top: 100 });
              setObjId(img);
              fc.add(img);
              fc.setActiveObject(img);
              fc.renderAll();
              saveSnapshot();
              scheduleSave();
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
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); undoRef.current(); return; }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); redoRef.current(); return; }
      if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        const fc2 = fabricRef.current;
        if (fc2) { fc2.setViewportTransform([1, 0, 0, 1, 0, 0]); fc2.renderAll(); }
        return;
      }
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
          scheduleSave();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // ─── 터치 핀치 줌 + 패닝 ───
    let lastDist = 0;
    let lastCenter = { x: 0, y: 0 };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (lastDist > 0) {
          let zoom = fc.getZoom() * (dist / lastDist);
          if (zoom > 5) zoom = 5;
          if (zoom < 0.3) zoom = 0.3;
          fc.zoomToPoint(new Point(cx, cy - HEADER_H), zoom);
          zoomRef.current = zoom;
          // 두 손가락 동시 패닝
          fc.relativePan(new Point(cx - lastCenter.x, cy - lastCenter.y));
        }
        lastDist = dist;
        lastCenter = { x: cx, y: cy };
      }
    };
    const handleTouchEnd = () => { lastDist = 0; lastCenter = { x: 0, y: 0 }; };
    const canvasEl = fc.getSelectionElement();
    canvasEl?.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvasEl?.addEventListener("touchend", handleTouchEnd);

    // ─── 서버 로드 ───
    fetch("/api/memo")
      .then((r) => r.json())
      .then((data) => {
        if (disposed) return;
        if (data.canvas_json) {
          try {
            fc.loadFromJSON(JSON.parse(data.canvas_json)).then(() => {
              if (disposed) return;
              fc.getObjects().forEach((obj) => {
                const j = obj.toJSON() as { _customId?: string };
                if (j._customId) setObjId(obj, j._customId);
                else setObjId(obj);
              });
              // 배경색 동기화 (지우개가 올바른 색 사용하도록)
              if (fc.backgroundColor) setBgColor(fc.backgroundColor as string);
              fc.renderAll();
              saveSnapshot();
            });
          } catch { /* ignore */ }
        }
        if (data.overlay_data) {
          try {
            const overlay = JSON.parse(data.overlay_data);
            if (Array.isArray(overlay)) { setTables(overlay); } // 이전 형식 호환
            else { setTables(overlay.tables || []); setPinMemos(overlay.pins || []); }
          } catch { /* ignore */ }
        }
      })
      .catch(() => {});

    // ─── Socket.IO ───
    const socket = io({ transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("canvas:state", (data) => {
      if (disposed) return;
      isRemoteAction.current = true;
      if (data.overlay_data) {
        try {
          const overlay = typeof data.overlay_data === "string" ? JSON.parse(data.overlay_data) : data.overlay_data;
          if (Array.isArray(overlay)) { setTables(overlay); }
          else { setTables(overlay.tables || []); setPinMemos(overlay.pins || []); }
        } catch { /* ignore */ }
      }
      if (data.canvas_json) {
        try {
          const parsed = typeof data.canvas_json === "string" ? JSON.parse(data.canvas_json) : data.canvas_json;
          fc.loadFromJSON(parsed).then(() => {
            if (disposed) return;
            fc.getObjects().forEach((obj) => {
              const j = obj.toJSON() as { _customId?: string };
              if (j._customId) setObjId(obj, j._customId);
            });
            fc.renderAll();
            isRemoteAction.current = false;
          }).catch(() => { isRemoteAction.current = false; });
        } catch { isRemoteAction.current = false; }
      } else {
        isRemoteAction.current = false;
      }
    });

    socket.on("object:added", (data) => {
      if (disposed) return;
      isRemoteAction.current = true;
      util.enlivenObjects([data.data]).then((objects) => {
        if (disposed) return;
        const obj = objects[0] as FabricObject;
        if (obj) {
          setObjId(obj, data.id);
          fc.add(obj);
          fc.renderAll();
        }
        isRemoteAction.current = false;
      }).catch(() => { isRemoteAction.current = false; });
    });

    socket.on("object:modified", (data) => {
      if (disposed) return;
      isRemoteAction.current = true;
      const target = fc.getObjects().find((o) => getObjId(o) === data.id);
      if (target) {
        const idx = fc.getObjects().indexOf(target);
        fc.remove(target);
        util.enlivenObjects([data.data]).then((objects) => {
          if (disposed) return;
          const obj = objects[0] as FabricObject;
          if (obj) {
            setObjId(obj, data.id);
            fc.add(obj);
            if (idx < fc.getObjects().length - 1) fc.moveObjectTo(obj, idx);
            fc.renderAll();
          }
          isRemoteAction.current = false;
        }).catch(() => { isRemoteAction.current = false; });
      } else {
        isRemoteAction.current = false;
      }
    });

    socket.on("object:removed", (data) => {
      if (disposed) return;
      isRemoteAction.current = true;
      const t = fc.getObjects().find((o) => getObjId(o) === data.id);
      if (t) { fc.remove(t); fc.renderAll(); }
      isRemoteAction.current = false;
    });

    socket.on("drawing:path", (data) => {
      if (disposed) return;
      isRemoteAction.current = true;
      util.enlivenObjects([data.data]).then((objects) => {
        if (disposed) return;
        const obj = objects[0] as FabricObject;
        if (obj) {
          setObjId(obj, data.id);
          fc.add(obj);
          fc.renderAll();
        }
        isRemoteAction.current = false;
      }).catch(() => { isRemoteAction.current = false; });
    });

    socket.on("table:added", (d) => setTables((p) => [...p, d]));
    socket.on("table:update", (d) => setTables((p) => p.map((t) => (t.id === d.id ? d : t))));
    socket.on("table:removed", (d) => setTables((p) => p.filter((t) => t.id !== d.id)));

    socket.on("pin:added", (d) => setPinMemos((p) => [...p, d]));
    socket.on("pin:update", (d) => setPinMemos((p) => p.map((m) => (m.id === d.id ? d : m))));
    socket.on("pin:removed", (d) => setPinMemos((p) => p.filter((m) => m.id !== d.id)));

    socket.on("canvas:clear", () => {
      if (disposed) return;
      isRemoteAction.current = true;
      fc.getObjects().forEach((obj) => fc.remove(obj));
      fc.discardActiveObject();
      fc.renderAll();
      setTables([]);
      setPinMemos([]);
      isRemoteAction.current = false;
    });

    // ─── 화면 꺼짐 방지 (Wake Lock) ───
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try { wakeLock = await navigator.wakeLock.request("screen"); } catch { /* ignore */ }
    };
    requestWakeLock();
    const handleVisibilityChange = () => { if (document.visibilityState === "visible") requestWakeLock(); };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      wakeLock?.release();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("keydown", handleKeyDown);
      canvasEl?.removeEventListener("touchmove", handleTouchMove);
      canvasEl?.removeEventListener("touchend", handleTouchEnd);
      fc.off("selection:created", updateSelection);
      fc.off("selection:updated", updateSelection);
      fc.off("selection:cleared");
      fc.off("after:render", syncOverlay);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      socket.disconnect();
      fc.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Undo/Redo refs ───
  undoRef.current = () => {
    const fc = fabricRef.current;
    if (!fc || undoStack.length <= 1) return;
    const newUndo = [...undoStack];
    const cur = newUndo.pop()!;
    setRedoStack((p) => [...p, cur]);
    setUndoStack(newUndo);
    const prev = newUndo[newUndo.length - 1];
    if (prev) {
      isRemoteAction.current = true;
      fc.loadFromJSON(JSON.parse(prev)).then(() => { fc.renderAll(); isRemoteAction.current = false; });
    }
  };
  redoRef.current = () => {
    const fc = fabricRef.current;
    if (!fc || redoStack.length === 0) return;
    const newRedo = [...redoStack];
    const next = newRedo.pop()!;
    setRedoStack(newRedo);
    setUndoStack((p) => [...p, next]);
    isRemoteAction.current = true;
    fc.loadFromJSON(JSON.parse(next)).then(() => { fc.renderAll(); isRemoteAction.current = false; });
  };

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
      brush.decimate = 2; // 포인트를 더 많이 유지 → 부드러운 곡선
      fc.freeDrawingBrush = brush;
    } else if (activeTool === "eraser") {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.color = bgColor;
      brush.width = eraserSize;
      fc.freeDrawingBrush = brush;
    } else if (activeTool === "handwriting") {
      fc.isDrawingMode = true;
      const brush = new PencilBrush(fc);
      brush.color = penColor;
      brush.width = 3;
      brush.decimate = 2;
      fc.freeDrawingBrush = brush;
    } else if (activeTool === "hand") {
      fc.selection = false;
      fc.defaultCursor = "grab";
    } else if (["text", "pin", "table", "image"].includes(activeTool)) {
      fc.selection = false;
      fc.defaultCursor = "crosshair";
    }
  }, [activeTool, penColor, bgColor, eraserSize]);

  useEffect(() => {
    const fc = fabricRef.current;
    if (fc) { fc.backgroundColor = bgColor; fc.renderAll(); }
  }, [bgColor]);

  // ─── 스마트펜: 캔버스에 직접 쓰고 Google 필기 인식 ───
  useEffect(() => {
    if (activeTool !== "handwriting") return;
    const fc = fabricRef.current;
    if (!fc) return;

    let strokes: Array<{ xs: number[]; ys: number[] }> = [];
    let curXs: number[] = [];
    let curYs: number[] = [];
    let drawnPaths: FabricObject[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let firstScene: { x: number; y: number } | null = null;

    const getPoint = (e: Event) => {
      const me = e as MouseEvent | TouchEvent;
      const el = fc.getSelectionElement();
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const cx = "touches" in me ? me.touches[0]?.clientX ?? 0 : me.clientX;
      const cy = "touches" in me ? me.touches[0]?.clientY ?? 0 : me.clientY;
      return { x: cx - rect.left, y: cy - rect.top };
    };

    const onDown = (opt: { e: Event; scenePoint?: { x: number; y: number } }) => {
      const pt = getPoint(opt.e);
      if (!pt) return;
      curXs = [pt.x];
      curYs = [pt.y];
      if (!firstScene && opt.scenePoint) firstScene = { x: opt.scenePoint.x, y: opt.scenePoint.y };
      if (timer) { clearTimeout(timer); timer = null; }
    };
    const onMove = (opt: { e: Event }) => {
      if (curXs.length === 0) return;
      const pt = getPoint(opt.e);
      if (pt) { curXs.push(pt.x); curYs.push(pt.y); }
    };
    const onUp = () => {
      if (curXs.length > 1) strokes.push({ xs: [...curXs], ys: [...curYs] });
      curXs = []; curYs = [];
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => recognize(), 2000);
    };
    const onPath = (e: unknown) => {
      const path = (e as { path: FabricObject }).path;
      if (path) drawnPaths.push(path);
    };

    const recognize = async () => {
      if (strokes.length === 0) return;
      try {
        const ink = strokes.map((s) => [s.xs, s.ys, []]);
        const res = await fetch("/api/handwriting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ink, language: "ko" }),
        });
        const data = await res.json();
        if (data.text) {
          for (const path of drawnPaths) {
            emitIfLocal("object:removed", { id: getObjId(path) });
            fc.remove(path);
          }
          const pos = firstScene || { x: 100, y: 100 };
          const text = new IText(data.text, {
            left: pos.x, top: pos.y, fontSize: 32,
            fill: penColor, fontFamily: "sans-serif", editable: true,
          });
          setObjId(text);
          fc.add(text);
          fc.setActiveObject(text);
          fc.renderAll();
          saveSnapshot();
          scheduleSave();
          emitIfLocal("object:added", { id: getObjId(text), data: text.toJSON() });
        }
      } catch (err) {
        console.error("필기 인식 실패:", err);
      }
      strokes = []; drawnPaths = []; firstScene = null;
    };

    fc.on("mouse:down", onDown);
    fc.on("mouse:move", onMove);
    fc.on("mouse:up", onUp);
    fc.on("path:created", onPath);
    return () => {
      if (timer) clearTimeout(timer);
      fc.off("mouse:down", onDown);
      fc.off("mouse:move", onMove);
      fc.off("mouse:up", onUp);
      fc.off("path:created", onPath);
    };
  }, [activeTool, penColor, saveSnapshot, scheduleSave, emitIfLocal]);

  // ─── 캔버스 클릭 → 객체 생성 ───
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;

    const handleMouseDown = (opt: { e: MouseEvent | TouchEvent; scenePoint?: { x: number; y: number }; viewportPoint?: { x: number; y: number } }) => {
      // 패닝 중 오브젝트 생성 방지
      const rawE = opt.e as MouseEvent;
      if (rawE.altKey || rawE.button === 1 || activeTool === "hand") return;
      const pointer = opt.scenePoint || opt.viewportPoint;
      if (!pointer) return;

      // 지우개로 오브젝트 탭 → 해당 오브젝트 삭제
      if (activeTool === "eraser") {
        const objects = fc.getObjects();
        for (let i = objects.length - 1; i >= 0; i--) {
          if (objects[i].containsPoint(new Point(pointer.x, pointer.y))) {
            emitIfLocal("object:removed", { id: getObjId(objects[i]) });
            fc.remove(objects[i]);
            fc.discardActiveObject();
            fc.renderAll();
            saveSnapshot();
            scheduleSave();
            return;
          }
        }
        return;
      }

      if (activeTool === "text") {
        // HTML textarea 오버레이로 입력받기 (자연스러운 입력 + 가상 키보드 지원)
        const e = opt.e as MouseEvent | TouchEvent;
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
        setTextInput({ x: clientX, y: clientY, sceneX: pointer.x, sceneY: pointer.y });
        return;
      } else if (activeTool === "pin") {
        const e = opt.e as MouseEvent | TouchEvent;
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
        // 화면 좌표 → 캔버스 좌표 변환
        const fc2 = fabricRef.current;
        const vt = fc2?.viewportTransform || [1, 0, 0, 1, 0, 0];
        const zm = vt[0], px = vt[4], py = vt[5];
        const ty = HEADER_H * (1 - zm) + py;
        const canvasX = (clientX - px) / zm - 144;
        const canvasY = (clientY - ty) / zm - 20;
        const newPin: PinMemoData = { id: genId(), x: canvasX, y: canvasY, title: "", body: "" };
        setPinMemos((p) => [...p, newPin]);
        scheduleSave();
        emitIfLocal("pin:added", newPin);
        setActiveTool("select");
      } else if (activeTool === "table") {
        // 현재 보이는 화면 중앙 → 캔버스 좌표로 변환
        const fc2 = fabricRef.current;
        const vt = fc2?.viewportTransform || [1, 0, 0, 1, 0, 0];
        const zm = vt[0], px = vt[4], py = vt[5];
        const tableW = 400, tableH = 140;
        const screenCX = window.innerWidth / 2;
        const screenCY = window.innerHeight / 2;
        const ty = HEADER_H * (1 - zm) + py;
        const centerX = (screenCX - px) / zm - tableW / 2;
        const centerY = (screenCY - ty) / zm - tableH / 2;
        const newTable: TableData = {
          id: genId(), x: centerX, y: centerY, width: tableW, height: tableH,
          rows: [["", "", ""], ["", "", ""], ["", "", ""]],
          headerColor: "#3b82f6",
        };
        setTables((p) => [...p, newTable]);
        scheduleSave();
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
            FabricImage.fromURL(reader.result as string).then((img) => {
              if (img.width && img.width > 800) img.scaleToWidth(800);
              img.set({ left: pointer.x, top: pointer.y });
              setObjId(img);
              fc.add(img);
              fc.setActiveObject(img);
              fc.renderAll();
              saveSnapshot();
              scheduleSave();
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
  }, [activeTool, penColor, saveSnapshot, scheduleSave, emitIfLocal]);

  const handleUndo = useCallback(() => undoRef.current(), []);
  const handleRedo = useCallback(() => redoRef.current(), []);

  // 텍스트 입력 확정
  const commitText = useCallback((value: string) => {
    const fc = fabricRef.current;
    if (!fc || !textInput || !value.trim()) { setTextInput(null); return; }
    const text = new IText(value.trim(), {
      left: textInput.sceneX, top: textInput.sceneY, fontSize: textSize,
      fill: penColor, fontFamily: "sans-serif", editable: true,
      fontWeight: textBold ? "bold" : "normal",
      fontStyle: textItalic ? "italic" : "normal",
      underline: textUnderline,
    });
    setObjId(text);
    fc.add(text);
    fc.setActiveObject(text);
    fc.renderAll();
    saveSnapshot();
    scheduleSave();
    emitIfLocal("object:added", { id: getObjId(text), data: text.toJSON() });
    setTextInput(null);
    setActiveTool("select");
  }, [textInput, penColor, textSize, textBold, textItalic, textUnderline, saveSnapshot, scheduleSave, emitIfLocal]);

  const handleTableUpdate = useCallback((updated: TableData) => {
    setTables((p) => p.map((t) => (t.id === updated.id ? updated : t)));
    scheduleSave();
    emitIfLocal("table:update", updated);
  }, [scheduleSave, emitIfLocal]);

  const handleTableRemove = useCallback((id: string) => {
    setTables((p) => p.filter((t) => t.id !== id));
    scheduleSave();
    emitIfLocal("table:removed", { id });
  }, [scheduleSave, emitIfLocal]);

  const handlePinUpdate = useCallback((updated: PinMemoData) => {
    setPinMemos((p) => p.map((m) => (m.id === updated.id ? updated : m)));
    scheduleSave();
    emitIfLocal("pin:update", updated);
  }, [scheduleSave, emitIfLocal]);

  const handlePinRemove = useCallback((id: string) => {
    setPinMemos((p) => p.filter((m) => m.id !== id));
    scheduleSave();
    emitIfLocal("pin:removed", { id });
  }, [scheduleSave, emitIfLocal]);

  const handleFitAll = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    // 토글: 이미 축소 상태면 원래 크기로 복귀
    if (isFitAll) {
      fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
      fc.renderAll();
      setIsFitAll(false);
      return;
    }
    // 뷰포트 리셋 후 모든 콘텐츠 범위 계산
    fc.setViewportTransform([1, 0, 0, 1, 0, 0]);
    let maxX = 0, maxY = 0;
    fc.getObjects().forEach((obj) => {
      const bound = obj.getBoundingRect();
      maxX = Math.max(maxX, bound.left + bound.width);
      maxY = Math.max(maxY, bound.top + bound.height);
    });
    pinMemosRef.current.forEach((pin) => {
      maxX = Math.max(maxX, pin.x + 288);
      maxY = Math.max(maxY, pin.y + 200);
    });
    tablesRef.current.forEach((t) => {
      maxX = Math.max(maxX, t.x + t.width);
      maxY = Math.max(maxY, t.y + t.height);
    });
    if (maxX <= 0 && maxY <= 0) { fc.renderAll(); return; }
    const canvasW = fc.getWidth();
    const canvasH = fc.getHeight();
    const padding = 40;
    const scaleX = (maxX + padding) > canvasW ? canvasW / (maxX + padding) : 1;
    const scaleY = (maxY + padding) > canvasH ? canvasH / (maxY + padding) : 1;
    const scale = Math.min(scaleX, scaleY, 1);
    fc.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    fc.renderAll();
    setIsFitAll(true);
  }, [isFitAll]);

  const handleZoomIn = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    setIsFitAll(false);
    let zoom = fc.getZoom() * 1.2;
    if (zoom > 5) zoom = 5;
    fc.zoomToPoint(new Point(fc.getWidth() / 2, fc.getHeight() / 2), zoom);
    zoomRef.current = zoom;
    fc.renderAll();
  }, []);

  const handleZoomOut = useCallback(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    setIsFitAll(false);
    let zoom = fc.getZoom() / 1.2;
    if (zoom < 0.3) zoom = 0.3;
    fc.zoomToPoint(new Point(fc.getWidth() / 2, fc.getHeight() / 2), zoom);
    zoomRef.current = zoom;
    fc.renderAll();
  }, []);

  const handleClear = useCallback(async () => {
    if (!confirm("메모판을 전체삭제 하시겠습니까?")) return;
    const fc = fabricRef.current;
    if (fc) { fc.getObjects().forEach((obj) => fc.remove(obj)); fc.discardActiveObject(); fc.renderAll(); }
    setTables([]);
    setPinMemos([]);
    setUndoStack([]);
    setRedoStack([]);
    socketRef.current?.emit("canvas:clear");
    try { await fetch("/api/memo/clear", { method: "POST" }); } catch { /* ignore */ }
  }, [isDark]);

  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<{ id: number; backed_up_at: string }[]>([]);

  const handleOpenHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/memo/history");
      const data = await res.json();
      setHistoryList(Array.isArray(data) ? data : []);
      setShowHistory(true);
    } catch { setHistoryList([]); setShowHistory(true); }
  }, []);

  const handleSaveHistory = useCallback(async () => {
    try {
      await fetch("/api/memo/history", { method: "POST" });
      const res = await fetch("/api/memo/history");
      const data = await res.json();
      setHistoryList(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);

  const handleRestoreHistory = useCallback(async (backupId: number) => {
    if (!confirm("이 시점으로 되돌리시겠습니까?")) return;
    try {
      const res = await fetch("/api/memo/history/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });
      const data = await res.json();
      if (data.success) {
        skipFlushRef.current = true;
        if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        setShowHistory(false);
        window.location.reload();
      } else { alert("복구 실패"); }
    } catch { alert("복구 실패"); }
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-white dark:bg-[#121218]">
      {/* ─── 상단 헤더 ─── */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-center gap-6" style={{ height: HEADER_H }}>
        <a
          href="http://192.168.107.6:3501"
          className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-sky-500 dark:hover:text-sky-400 transition-colors"
          title="쿠라레 메인 포탈"
        >
          <Home size={15} className="text-sky-400" />
          <span>쿠라레 메인 포탈</span>
        </a>
        <span className="text-gray-300 dark:text-gray-600 text-xs">/</span>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">메모장</span>
        <span className="text-gray-300 dark:text-gray-600 text-xs">/</span>
        <button
          onClick={handleFitAll}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-sky-500 dark:hover:text-sky-400 transition-colors"
          title="모든 메모가 보이도록 화면 맞춤"
        >
          <Maximize2 size={12} />
          전체보기
        </button>
        <span className="text-gray-300 dark:text-gray-600 text-xs">/</span>
        <button
          onClick={handleClear}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} />
          전체삭제
        </button>
        <span className="text-gray-300 dark:text-gray-600 text-xs">/</span>
        <button
          onClick={handleOpenHistory}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
        >
          <History size={12} />
          이력
        </button>
      </div>

      <div className="absolute left-0 w-full" style={{ top: HEADER_H, height: `calc(100vh - ${HEADER_H}px)` }}>
        <canvas ref={canvasRef} />
      </div>

      {/* 텍스트 입력 오버레이 */}
      {textInput && (
        <div className="absolute inset-0 z-50" onClick={() => commitText(textareaRef.current?.value || "")}>
          {/* 서식 미니 툴바 */}
          <div
            className="absolute flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#2a2a3e] rounded-lg shadow-lg border border-gray-200 dark:border-[#444]"
            style={{ left: textInput.x, top: textInput.y - 44 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setTextBold(!textBold)}
              className={`px-2 py-0.5 rounded text-sm font-bold transition-colors ${textBold ? "bg-blue-500 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"}`}
            >B</button>
            <button
              onClick={() => setTextItalic(!textItalic)}
              className={`px-2 py-0.5 rounded text-sm italic transition-colors ${textItalic ? "bg-blue-500 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"}`}
            >I</button>
            <button
              onClick={() => setTextUnderline(!textUnderline)}
              className={`px-2 py-0.5 rounded text-sm underline transition-colors ${textUnderline ? "bg-blue-500 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"}`}
            >U</button>
            <div className="w-px h-5 bg-gray-300 dark:bg-[#555]" />
            <div className="flex items-center gap-1">
              {[16, 20, 24, 32, 40].map((s) => (
                <button
                  key={s}
                  onClick={() => setTextSize(s)}
                  className={`w-7 h-7 rounded text-xs transition-colors ${textSize === s ? "bg-blue-500 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"}`}
                >{s}</button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-300 dark:bg-[#555]" />
            <div className="flex items-center gap-1">
              {["#ffffff", "#ff3b30", "#007aff", "#34c759", "#ffcc00", "#ff9500"].map((c) => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-colors ${penColor === c ? "border-blue-500 ring-1 ring-blue-300/50" : "border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <textarea
            ref={textareaRef}
            autoFocus
            className="absolute bg-transparent border-none outline-none resize-none caret-blue-500"
            style={{
              left: textInput.x,
              top: textInput.y,
              minWidth: 200,
              minHeight: 40,
              fontSize: textSize,
              fontWeight: textBold ? "bold" : "normal",
              fontStyle: textItalic ? "italic" : "normal",
              textDecoration: textUnderline ? "underline" : "none",
              color: penColor,
              fontFamily: "sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); commitText(e.currentTarget.value); }
            }}
            placeholder="텍스트 입력... (Esc로 확정)"
            inputMode="text"
          />
        </div>
      )}

      {/* 선택된 텍스트 서식 도구바 */}
      {selectedTextInfo && (
        <div
          className="absolute z-50 flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#2a2a3e] rounded-lg shadow-lg border border-gray-200 dark:border-[#444]"
          style={{
            left: Math.max(10, Math.min(selectedTextInfo.x, window.innerWidth - 400)),
            top: Math.max(HEADER_H + 4, selectedTextInfo.y - 44),
            transform: "translateX(-50%)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Bold */}
          <button
            onClick={() => {
              const obj = selectedTextInfo.obj;
              const next = obj.fontWeight === "bold" ? "normal" : "bold";
              obj.set("fontWeight", next);
              fabricRef.current?.renderAll();
              saveSnapshot(); scheduleSave();
              emitIfLocal("object:modified", { id: getObjId(obj), data: obj.toJSON() });
              setSelectedTextInfo({ ...selectedTextInfo });
            }}
            className={`px-2 py-0.5 rounded text-sm font-bold transition-colors ${selectedTextInfo.obj.fontWeight === "bold" ? "bg-blue-500 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"}`}
          >B</button>
          {/* Italic */}
          <button
            onClick={() => {
              const obj = selectedTextInfo.obj;
              const next = obj.fontStyle === "italic" ? "normal" : "italic";
              obj.set("fontStyle", next);
              fabricRef.current?.renderAll();
              saveSnapshot(); scheduleSave();
              emitIfLocal("object:modified", { id: getObjId(obj), data: obj.toJSON() });
              setSelectedTextInfo({ ...selectedTextInfo });
            }}
            className={`px-2 py-0.5 rounded text-sm italic transition-colors ${selectedTextInfo.obj.fontStyle === "italic" ? "bg-blue-500 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"}`}
          >I</button>
          {/* Underline */}
          <button
            onClick={() => {
              const obj = selectedTextInfo.obj;
              obj.set("underline", !obj.underline);
              fabricRef.current?.renderAll();
              saveSnapshot(); scheduleSave();
              emitIfLocal("object:modified", { id: getObjId(obj), data: obj.toJSON() });
              setSelectedTextInfo({ ...selectedTextInfo });
            }}
            className={`px-2 py-0.5 rounded text-sm underline transition-colors ${selectedTextInfo.obj.underline ? "bg-blue-500 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"}`}
          >U</button>

          <div className="w-px h-5 bg-gray-300 dark:bg-[#555]" />

          {/* Font Size */}
          <div className="flex items-center gap-1">
            {[16, 20, 24, 32, 40].map((s) => (
              <button
                key={s}
                onClick={() => {
                  const obj = selectedTextInfo.obj;
                  obj.set("fontSize", s);
                  fabricRef.current?.renderAll();
                  saveSnapshot(); scheduleSave();
                  emitIfLocal("object:modified", { id: getObjId(obj), data: obj.toJSON() });
                  // 위치 재계산
                  const bound = obj.getBoundingRect();
                  setSelectedTextInfo({ obj, x: bound.left + bound.width / 2, y: bound.top - 10 });
                }}
                className={`w-7 h-7 rounded text-xs transition-colors ${selectedTextInfo.obj.fontSize === s ? "bg-blue-500 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]"}`}
              >{s}</button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-300 dark:bg-[#555]" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {["#ffffff", "#ff3b30", "#007aff", "#34c759", "#ffcc00", "#ff9500"].map((c) => (
              <button
                key={c}
                onClick={() => {
                  const obj = selectedTextInfo.obj;
                  obj.set("fill", c);
                  fabricRef.current?.renderAll();
                  saveSnapshot(); scheduleSave();
                  emitIfLocal("object:modified", { id: getObjId(obj), data: obj.toJSON() });
                  setSelectedTextInfo({ ...selectedTextInfo });
                }}
                className={`w-6 h-6 rounded-full border-2 transition-colors ${String(selectedTextInfo.obj.fill) === c ? "border-blue-500 ring-1 ring-blue-300/50" : "border-gray-300 dark:border-gray-600 hover:border-gray-400"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 선택된 오브젝트 삭제 버튼 */}
      {deleteBtn && (
        <button
          className="absolute z-50 w-9 h-9 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
          style={{ left: deleteBtn.x, top: HEADER_H + deleteBtn.y - 12 }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            const fc = fabricRef.current;
            if (!fc) return;
            const active = fc.getActiveObjects();
            active.forEach((obj) => {
              emitIfLocal("object:removed", { id: getObjId(obj) });
              fc.remove(obj);
            });
            fc.discardActiveObject();
            fc.renderAll();
            saveSnapshot();
            scheduleSave();
            setDeleteBtn(null);
            setSelectedTextInfo(null);
          }}
          title="삭제"
        >
          <X size={18} />
        </button>
      )}

      {/* 이력 모달 */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowHistory(false)}>
          <div className="bg-white dark:bg-[#2a2a3e] rounded-lg shadow-2xl w-[680px] max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-200 dark:border-[#444]">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">이력 관리</h3>
              <div className="flex items-center gap-4">
                <button onClick={handleSaveHistory} className="px-7 py-3 text-base font-semibold bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors">
                  현재 상태 저장
                </button>
                <button onClick={() => setShowHistory(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[65vh] p-6">
              {historyList.length === 0 ? (
                <p className="text-center text-lg text-gray-400 py-16">저장된 이력이 없습니다.</p>
              ) : (
                historyList.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-6 py-5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#333] transition-colors mb-3 border border-gray-100 dark:border-[#3a3a45]">
                    <span className="text-lg text-gray-800 dark:text-gray-200">
                      {(() => {
                        const d = new Date(h.backed_up_at.replace(" ", "T") + "+09:00");
                        return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
                      })()}
                    </span>
                    <button
                      onClick={() => handleRestoreHistory(h.id)}
                      className="px-7 py-3 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors shrink-0 ml-6"
                    >
                      되돌리기
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={overlayRef}>
        {tables.map((table) => (
          <TableOverlay key={table.id} table={table} zoom={zoomRef.current} onUpdate={handleTableUpdate} onRemove={handleTableRemove} />
        ))}

        {pinMemos.map((memo) => (
          <PinMemoOverlay key={memo.id} memo={memo} zoom={zoomRef.current} onUpdate={handlePinUpdate} onRemove={handlePinRemove} />
        ))}
      </div>

      <FloatingToolbar
        activeTool={activeTool} onToolChange={(tool) => {
          if (tool === "image") {
            // 이미지 도구: 바로 파일 선택 다이얼로그 열기
            const fc = fabricRef.current;
            if (!fc) return;
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                FabricImage.fromURL(reader.result as string).then((img) => {
                  if (img.width && img.width > 800) img.scaleToWidth(800);
                  const cx = fc.getWidth() / 2, cy = fc.getHeight() / 2;
                  const vt = fc.viewportTransform || [1, 0, 0, 1, 0, 0];
                  img.set({ left: (cx - vt[4]) / vt[0], top: (cy - vt[5]) / vt[3] });
                  setObjId(img);
                  fc.add(img);
                  fc.setActiveObject(img);
                  fc.renderAll();
                  saveSnapshot();
                  scheduleSave();
                  emitIfLocal("object:added", { id: getObjId(img), data: img.toJSON() });
                });
              };
              reader.readAsDataURL(file);
            };
            input.click();
            return;
          }
          setActiveTool(tool);
        }}
        penColor={penColor} onPenColorChange={setPenColor}
        bgColor={bgColor} onBgColorChange={setBgColor}
        eraserSize={eraserSize} onEraserSizeChange={setEraserSize}
        canUndo={undoStack.length > 1} canRedo={redoStack.length > 0}
        onUndo={handleUndo} onRedo={handleRedo}
        onZoomIn={handleZoomIn} onZoomOut={handleZoomOut}
        isDark={isDark} onToggleDark={toggleDark}
      />
    </div>
  );
}
