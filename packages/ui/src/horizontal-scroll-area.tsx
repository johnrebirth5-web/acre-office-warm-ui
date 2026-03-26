"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

type HorizontalScrollAreaProps = {
  className?: string;
  viewportClassName?: string;
  children: ReactNode;
};

type ScrollMetrics = {
  isOverflowing: boolean;
  thumbWidth: number;
  thumbOffset: number;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const HIDDEN_METRICS: ScrollMetrics = {
  isOverflowing: false,
  thumbWidth: 0,
  thumbOffset: 0
};

const HorizontalScrollAreaContext = createContext(false);

export function useHorizontalScrollAreaContext() {
  return useContext(HorizontalScrollAreaContext);
}

export function HorizontalScrollArea(props: HorizontalScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [metrics, setMetrics] = useState<ScrollMetrics>(HIDDEN_METRICS);

  const syncMetrics = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const clientWidth = viewport.clientWidth;
    const scrollWidth = viewport.scrollWidth;
    const overflowDelta = scrollWidth - clientWidth;
    const isColumnResizing =
      typeof document !== "undefined" && document.body.classList.contains("office-table-column-resizing");

    if (clientWidth <= 0) {
      return;
    }

    if (overflowDelta <= 1) {
      setMetrics((current) => {
        if (isColumnResizing && current.isOverflowing) {
          return current;
        }

        return current.isOverflowing ? HIDDEN_METRICS : current;
      });
      return;
    }

    const trackWidth = trackRef.current?.clientWidth ?? clientWidth;
    const thumbWidth = clamp((trackWidth * clientWidth) / scrollWidth, 52, trackWidth);
    const maxOffset = Math.max(trackWidth - thumbWidth, 0);
    const maxScroll = Math.max(scrollWidth - clientWidth, 1);
    const thumbOffset = maxOffset === 0 ? 0 : (viewport.scrollLeft / maxScroll) * maxOffset;

    setMetrics((current) => {
      if (
        current.isOverflowing &&
        Math.abs(current.thumbWidth - thumbWidth) < 0.5 &&
        Math.abs(current.thumbOffset - thumbOffset) < 0.5
      ) {
        return current;
      }

      return {
        isOverflowing: true,
        thumbWidth,
        thumbOffset
      };
    });
  }, []);

  useEffect(() => {
    syncMetrics();

    const viewport = viewportRef.current;

    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      syncMetrics();
    });

    resizeObserver.observe(viewport);

    const content = viewport.firstElementChild;
    if (content instanceof HTMLElement) {
      resizeObserver.observe(content);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [props.children, syncMetrics]);

  useEffect(() => {
    function handlePointerEnd() {
      syncMetrics();
    }

    document.addEventListener("pointerup", handlePointerEnd);
    document.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      document.removeEventListener("pointerup", handlePointerEnd);
      document.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [syncMetrics]);

  function handleTrackPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    const viewport = viewportRef.current;
    const track = trackRef.current;

    if (!viewport || !track || !metrics.isOverflowing) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    const maxOffset = Math.max(track.clientWidth - metrics.thumbWidth, 1);
    const nextOffset = clamp(event.clientX - rect.left - metrics.thumbWidth / 2, 0, maxOffset);

    viewport.scrollLeft = (nextOffset / maxOffset) * maxScroll;
  }

  function handleThumbPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    dragPointerIdRef.current = event.pointerId;
    dragStartXRef.current = event.clientX;
    dragStartScrollLeftRef.current = viewport.scrollLeft;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleThumbPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragPointerIdRef.current !== event.pointerId) {
      return;
    }

    const viewport = viewportRef.current;
    const track = trackRef.current;

    if (!viewport || !track) {
      return;
    }

    const deltaX = event.clientX - dragStartXRef.current;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    const maxOffset = Math.max(track.clientWidth - metrics.thumbWidth, 1);

    viewport.scrollLeft = clamp(dragStartScrollLeftRef.current + deltaX * (maxScroll / maxOffset), 0, maxScroll);
  }

  function handleThumbPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragPointerIdRef.current !== event.pointerId) {
      return;
    }

    dragPointerIdRef.current = null;
    setIsDragging(false);
  }

  return (
    <HorizontalScrollAreaContext.Provider value={true}>
      <div className={cx("office-horizontal-scroll-area", props.className)}>
        <div className={cx("office-horizontal-scroll-viewport", props.viewportClassName)} onScroll={syncMetrics} ref={viewportRef}>
          {props.children}
        </div>

        {metrics.isOverflowing ? (
          <div
            aria-hidden="true"
            className="office-horizontal-scrollbar"
            onPointerDown={handleTrackPointerDown}
            ref={trackRef}
            role="presentation"
          >
            <div
              className="office-horizontal-scrollbar-thumb"
              data-dragging={isDragging ? "true" : "false"}
              onPointerDown={handleThumbPointerDown}
              onPointerMove={handleThumbPointerMove}
              onPointerUp={handleThumbPointerEnd}
              onPointerCancel={handleThumbPointerEnd}
              style={{
                transform: `translateX(${metrics.thumbOffset}px)`,
                width: `${metrics.thumbWidth}px`
              }}
            />
          </div>
        ) : null}
      </div>
    </HorizontalScrollAreaContext.Provider>
  );
}
