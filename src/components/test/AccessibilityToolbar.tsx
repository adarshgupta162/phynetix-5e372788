import { useState, useEffect } from "react";
import { Accessibility, Search, Moon, X, ZoomIn, ZoomOut, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessibilityToolbarProps {
  className?: string;
  inline?: boolean;
}

export default function AccessibilityToolbar({ className, inline }: AccessibilityToolbarProps) {
  const [open, setOpen] = useState(false);
  const [magnifierOn, setMagnifierOn] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Dark mode — invert entire page; images stay inverted (user wants negative filter on images)
  useEffect(() => {
    document.documentElement.classList.toggle("a11y-dark-mode", darkMode);
    return () => document.documentElement.classList.remove("a11y-dark-mode");
  }, [darkMode]);

  // Magnifier — CSS zoom on test content area
  useEffect(() => {
    const contentArea = document.querySelector('[data-test-content]') as HTMLElement;
    const supportsZoom = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("zoom", "1.1");
    if (contentArea) {
      if (magnifierOn) {
        if (supportsZoom) {
          contentArea.style.zoom = String(zoomLevel);
          contentArea.style.transform = "";
          contentArea.style.transformOrigin = "";
          contentArea.style.width = "";
        } else {
          contentArea.style.zoom = "1";
          contentArea.style.transform = `scale(${zoomLevel})`;
          contentArea.style.transformOrigin = "top left";
          contentArea.style.width = `${100 / zoomLevel}%`;
        }
      } else {
        contentArea.style.zoom = "1";
        contentArea.style.transform = "";
        contentArea.style.transformOrigin = "";
        contentArea.style.width = "";
      }
    }
    return () => {
      if (contentArea) {
        contentArea.style.zoom = "1";
        contentArea.style.transform = "";
        contentArea.style.transformOrigin = "";
        contentArea.style.width = "";
      }
    };
  }, [magnifierOn, zoomLevel]);

  const increaseZoom = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const decreaseZoom = () => setZoomLevel(prev => Math.max(prev - 0.25, 1));
  const toggleMagnifier = (on: boolean) => {
    setMagnifierOn(on);
    if (on && zoomLevel === 1) setZoomLevel(1.5);
  };

  return (
    <>
      <div className={cn("relative", className)} style={{ zIndex: 9990 }}>
        <button
          onClick={() => setOpen(p => !p)}
          style={{
            width: 28, height: 28, borderRadius: "50%", border: "none",
            background: open ? "#fff" : "rgba(255,255,255,0.15)",
            color: open ? "#1a1a2e" : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 14, transition: "all .15s",
          }}
          title="Accessibility Options"
        >
          {open ? <X style={{ width: 14, height: 14 }} /> : <Accessibility style={{ width: 14, height: 14 }} />}
        </button>

        {open && (
          <div data-a11y-popup style={{
            position: "absolute", top: 34, right: 0, width: 240,
            background: "#fff", border: "1px solid #ccc", borderRadius: 8,
            boxShadow: "0 6px 24px rgba(0,0,0,.2)", padding: "14px 16px",
            fontFamily: "Arial,sans-serif", zIndex: 9999,
          }}>
            <div style={{ fontSize: 13, fontWeight: "bold", color: "#222", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Accessibility style={{ width: 14, height: 14 }} /> Accessibility
            </div>

            {/* Screen Magnifier */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444" }}>
                <Search style={{ width: 13, height: 13, opacity: .6 }} /> Screen Magnifier
              </div>
              <label style={{ position: "relative", width: 36, height: 20, cursor: "pointer" }}>
                <input type="checkbox" checked={magnifierOn} onChange={e => toggleMagnifier(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                <span style={{
                  position: "absolute", inset: 0, borderRadius: 10,
                  background: magnifierOn ? "#2979c5" : "#ccc", transition: "background .2s",
                }} />
                <span style={{
                  position: "absolute", top: 2, left: magnifierOn ? 18 : 2,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                }} />
              </label>
            </div>

            {magnifierOn && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                <button onClick={decreaseZoom} disabled={zoomLevel <= 1}
                  style={{ width: 24, height: 24, border: "1px solid #ccc", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ZoomOut style={{ width: 12, height: 12 }} />
                </button>
                <span style={{ fontSize: 12, fontWeight: "bold", minWidth: 36, textAlign: "center" }}>{Math.round(zoomLevel * 100)}%</span>
                <button onClick={increaseZoom} disabled={zoomLevel >= 3}
                  style={{ width: 24, height: 24, border: "1px solid #ccc", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ZoomIn style={{ width: 12, height: 12 }} />
                </button>
              </div>
            )}

            <div style={{ height: 1, background: "#e0e0e0", margin: "6px 0" }} />

            {/* Dark Mode */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444" }}>
                <Moon style={{ width: 13, height: 13, opacity: .6 }} /> Dark Mode
              </div>
              <label style={{ position: "relative", width: 36, height: 20, cursor: "pointer" }}>
                <input type="checkbox" checked={darkMode} onChange={e => setDarkMode(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                <span style={{
                  position: "absolute", inset: 0, borderRadius: 10,
                  background: darkMode ? "#2979c5" : "#ccc", transition: "background .2s",
                }} />
                <span style={{
                  position: "absolute", top: 2, left: darkMode ? 18 : 2,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                }} />
              </label>
            </div>
            {darkMode && (
              <p style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
                Dark interface with inverted image colors.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 
        Dark mode: invert entire page (white→black, black text→white).
        Images, video, canvas — do NOT re-invert, so they appear as negatives (user wants inverted images).
        Only re-invert SVG icons (lucide) so they remain readable.
        The accessibility popup itself is re-inverted to stay white.
      */}
      <style>{`
        .a11y-dark-mode {
          filter: invert(1) hue-rotate(180deg) !important;
        }
        .a11y-dark-mode .lucide {
          filter: invert(1) hue-rotate(180deg) !important;
        }
        /* Keep the accessibility popup readable */
        .a11y-dark-mode [data-a11y-popup] {
          filter: invert(1) hue-rotate(180deg) !important;
        }
      `}</style>
    </>
  );
}
