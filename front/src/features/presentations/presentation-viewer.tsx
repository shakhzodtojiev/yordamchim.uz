"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { KeyBlocker } from "@/features/protection/key-blocker";
import { cn } from "@/lib/utils";
import type { PresentationDetail, Slide } from "@/types/api";

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const SWIPE_THRESHOLD = 60;
const WATERMARK = "yordamchim.uz";

type Props = {
  presentation: PresentationDetail;
};

export function PresentationViewer({ presentation }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  // Signed slide URLs expire (~5 min). When one fails to load, re-run the
  // server component to mint fresh URLs instead of leaving a dead skeleton.
  const reloadSignedUrls = useCallback(() => router.refresh(), [router]);
  const slides = presentation.slides;
  const total = slides.length;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= total) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
      setZoom(1);
    },
    [index, total],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Keyboard navigation: arrows, Home/End, F = fullscreen, +/- = zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(total - 1);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => clamp(z + ZOOM_STEP));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => clamp(z - ZOOM_STEP));
      } else if (e.key === "0") {
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goTo, total]);

  // Track external fullscreen exits (esc).
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.().catch(() => {});
    } else {
      await document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Touch / pointer swipe.
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (zoom !== 1) return; // disable swipe when zoomed in
    dragStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) next();
    else prev();
  };

  const blockContextMenu = (e: React.MouseEvent) => e.preventDefault();
  const slide = slides[index];

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-black text-white rounded-xl overflow-hidden flex flex-col",
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none"
          // Reserve room for the topbar on desktop; on mobile we also leave
          // space for the bottom nav so the controls aren't covered.
          : "h-[calc(100svh-14rem)] md:h-[calc(100svh-12rem)] min-h-[360px] md:min-h-[480px]",
      )}
      onContextMenu={blockContextMenu}
    >
      <KeyBlocker />
      <div
        className="relative flex-1 overflow-hidden no-select"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {/* Slide */}
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={slide?.id ?? index}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 grid place-items-center p-4"
          >
            {slide ? (
              <SlideImage
                slide={slide}
                zoom={zoom}
                onReload={reloadSignedUrls}
              />
            ) : (
              <div className="text-sm text-white/60">Slayd topilmadi.</div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Watermark — covers the slide diagonally. Per-user, hard to crop out. */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 select-none">
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="text-white/70 text-xs sm:text-sm font-medium tracking-wide rotate-[-30deg] grid place-items-center"
            >
              {WATERMARK}
            </span>
          ))}
        </div>

        {/* Preload neighbors */}
        {slides[index + 1] ? <PreloadImage url={slides[index + 1].image_url} /> : null}
        {slides[index - 1] ? <PreloadImage url={slides[index - 1].image_url} /> : null}
      </div>

      <div className="flex items-center gap-2 p-3 border-t border-white/10 bg-black/40 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={prev}
          disabled={index === 0}
          aria-label="Oldingi slayd"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={next}
          disabled={index === total - 1}
          aria-label="Keyingi slayd"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        <div className="text-sm tabular-nums px-2">
          {index + 1} / {total}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => setZoom((z) => clamp(z - ZOOM_STEP))}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Kichraytirish"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => setZoom((z) => clamp(z + ZOOM_STEP))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Kattalashtirish"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 ml-1"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Chiqish" : "To'liq ekran"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(2))));
}

function SlideImage({
  slide,
  zoom,
  onReload,
}: {
  slide: Slide;
  zoom: number;
  onReload: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Reset when the slide (or its freshly-signed URL) changes.
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [slide.id, slide.image_url]);

  if (errored) {
    return (
      <div className="grid place-items-center gap-3 p-6 text-center">
        <p className="text-sm text-white/70 max-w-xs">
          Slaydni yuklab bo'lmadi — havola muddati tugagan bo'lishi mumkin.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          onClick={onReload}
        >
          Qayta yuklash
        </Button>
      </div>
    );
  }

  return (
    <div
      className="relative max-h-full max-w-full"
      style={{ transform: `scale(${zoom})`, transition: "transform 120ms ease-out" }}
    >
      {!loaded ? (
        <div className="h-72 w-[28rem] max-w-[80vw] rounded bg-white/5 animate-pulse" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.image_url}
        alt={`Slayd ${slide.order}`}
        className={cn(
          "max-h-[80vh] max-w-full rounded shadow-2xl no-select transition-opacity",
          loaded ? "opacity-100" : "opacity-0 absolute",
        )}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </div>
  );
}

function PreloadImage({ url }: { url: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" aria-hidden className="hidden" />
  );
}
