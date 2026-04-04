"use client";

import { useEffect, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2];

export function FullscreenModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [zoomIndex, setZoomIndex] = useState(1); // default 1 = 100%

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
      if (e.key === "-") setZoomIndex((i) => Math.max(i - 1, 0));
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const zoom = ZOOM_LEVELS[zoomIndex];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoomIndex((i) => Math.max(i - 1, 0))}
          disabled={zoomIndex === 0}
        >
          <ZoomOut size={16} />
        </Button>
        <span className="text-sm font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1))}
          disabled={zoomIndex === ZOOM_LEVELS.length - 1}
        >
          <ZoomIn size={16} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X size={24} />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          className="transition-transform duration-200 w-full"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
