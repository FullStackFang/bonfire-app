"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

const CANVAS_SIZE = 1600;
const DRAG_THRESHOLD = 5; // px the pointer can move before it's a drag, not a tap

type DragState = { wasDragging: () => boolean };
const DragContext = createContext<DragState>({ wasDragging: () => false });

/** Hook for child components (markers) to know whether the user just dragged. */
export function useDragState() {
  return useContext(DragContext);
}

type Props = {
  imageSrc: string;
  children: ReactNode;
  /** Called when the user taps the map background (not a marker). */
  onTap?: () => void;
};

/**
 * Full-screen viewport with a draggable canvas. Children are positioned
 * absolutely within the canvas (using percentage `left`/`top`) and ride
 * along with the pan transform.
 *
 * Distinguishes a tap on a child from a drag of the map: pointer movement
 * over DRAG_THRESHOLD pixels suppresses the click event that follows.
 */
export function PannableMap({ imageSrc, children, onTap }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Mutable state lives in a ref so it doesn't trigger re-renders
  // and stays accessible across pointer events.
  const state = useRef({
    isPointerDown: false,
    wasDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    translateX: 0,
    translateY: 0,
  });

  const clampAndApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = state.current;

    if (cw <= vw) s.translateX = (vw - cw) / 2;
    else s.translateX = Math.min(0, Math.max(vw - cw, s.translateX));

    if (ch <= vh) s.translateY = (vh - ch) / 2;
    else s.translateY = Math.min(0, Math.max(vh - ch, s.translateY));

    canvas.style.transform = `translate(${s.translateX}px, ${s.translateY}px)`;
  };

  const recenter = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = state.current;
    s.translateX = (window.innerWidth - canvas.offsetWidth) / 2;
    s.translateY = (window.innerHeight - canvas.offsetHeight) / 2;
    clampAndApply();
  };

  useEffect(() => {
    recenter();
    const onResize = () => clampAndApply();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    const s = state.current;
    s.isPointerDown = true;
    s.wasDragging = false;
    s.startX = s.lastX = e.clientX;
    s.startY = s.lastY = e.clientY;
    try {
      viewportRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // some browsers throw on capture for non-primary pointers; safe to ignore
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.isPointerDown) return;

    if (!s.wasDragging) {
      const dx = Math.abs(e.clientX - s.startX);
      const dy = Math.abs(e.clientY - s.startY);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        s.wasDragging = true;
        viewportRef.current?.classList.add("dragging");
      } else {
        return;
      }
    }

    s.translateX += e.clientX - s.lastX;
    s.translateY += e.clientY - s.lastY;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    clampAndApply();
  };

  const endDrag = () => {
    state.current.isPointerDown = false;
    viewportRef.current?.classList.remove("dragging");
    // wasDragging stays true through the click that follows;
    // it resets on the next pointerdown.
  };

  const onClick = () => {
    if (state.current.wasDragging) return;
    onTap?.();
  };

  return (
    <DragContext.Provider
      value={{ wasDragging: () => state.current.wasDragging }}
    >
      <div
        ref={viewportRef}
        className="viewport fixed inset-0 overflow-hidden touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={onClick}
      >
        <div
          ref={canvasRef}
          className="absolute will-change-transform"
          style={{
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          {children}
        </div>
      </div>
    </DragContext.Provider>
  );
}
