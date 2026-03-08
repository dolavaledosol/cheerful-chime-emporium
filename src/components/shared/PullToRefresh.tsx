import { useRef, useState, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  /** Minimum pull distance to trigger refresh (px) */
  threshold?: number;
  /** Whether to enable the feature — defaults to true */
  enabled?: boolean;
}

const PullToRefresh = ({ onRefresh, children, threshold = 80, enabled = true }: PullToRefreshProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const pulling = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const isAtTop = () => {
    if (!containerRef.current) return false;
    // Walk up to find the first scrollable ancestor
    let el: HTMLElement | null = containerRef.current;
    while (el) {
      if (el.scrollTop > 0) return false;
      el = el.parentElement;
    }
    return window.scrollY <= 0;
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || refreshing) return;
      if (isAtTop()) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    },
    [enabled, refreshing],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;
      if (diff > 0) {
        // Apply resistance curve
        const distance = Math.min(diff * 0.4, threshold * 1.6);
        setPullDistance(distance);
      } else {
        pulling.current = false;
        setPullDistance(0);
      }
    },
    [refreshing, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold * 0.5);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, refreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-40 transition-opacity duration-200"
        style={{
          top: -4,
          height: `${Math.max(pullDistance, 0)}px`,
          opacity: progress > 0.1 || refreshing ? 1 : 0,
        }}
      >
        <div
          className="h-8 w-8 rounded-full bg-card border shadow-sm flex items-center justify-center"
          style={{
            transform: refreshing ? "none" : `rotate(${progress * 360}deg)`,
          }}
        >
          <Loader2
            className={`h-4 w-4 text-primary ${refreshing ? "animate-spin" : ""}`}
          />
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : "none",
          transition: pulling.current ? "none" : "transform 0.3s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
