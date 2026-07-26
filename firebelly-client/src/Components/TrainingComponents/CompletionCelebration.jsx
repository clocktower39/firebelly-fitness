import React, { useEffect, useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { CheckCircle } from "@mui/icons-material";

const COLORS = ["#f97316", "#facc15", "#4ade80", "#38bdf8", "#f472b6", "#a78bfa"];
const PIECES = 26;

// Brief full-screen celebration when a workout is marked complete: check pop + confetti
// burst, ~1.4s, then gone. Skips the confetti when the user prefers reduced motion.
export default function CompletionCelebration({ open, onDone }) {
  const reducedMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false,
    []
  );

  // Random-ish but stable per open: vary by index only (no re-randomizing every render).
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        color: COLORS[i % COLORS.length],
        left: 8 + ((i * 37) % 84),
        delay: (i % 7) * 55,
        drift: ((i * 53) % 120) - 60,
        spin: ((i * 97) % 540) - 270,
        size: 7 + (i % 4) * 2,
      })),
    []
  );

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => onDone?.(), reducedMotion ? 900 : 1500);
    return () => clearTimeout(t);
  }, [open, onDone, reducedMotion]);

  if (!open) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "@keyframes fbPop": {
          "0%": { transform: "scale(0.3)", opacity: 0 },
          "45%": { transform: "scale(1.15)", opacity: 1 },
          "70%": { transform: "scale(0.98)" },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        "@keyframes fbFall": {
          "0%": { transform: "translateY(-8vh) translateX(0) rotate(0deg)", opacity: 1 },
          "100%": { opacity: 0.9 },
        },
        "@keyframes fbFade": {
          "0%": { opacity: 1 },
          "100%": { opacity: 0 },
        },
        animation: `fbFade 300ms ease-in ${reducedMotion ? 600 : 1200}ms forwards`,
      }}
    >
      {!reducedMotion &&
        pieces.map((p, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              top: 0,
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.45,
              backgroundColor: p.color,
              borderRadius: "1px",
              opacity: 0,
              animation: `fbFall 1200ms cubic-bezier(0.2, 0.6, 0.4, 1) ${p.delay}ms forwards`,
              // Per-piece landing point via CSS vars in the keyframe end state.
              "@keyframes fbFall": {
                "0%": { transform: "translateY(-6vh) translateX(0) rotate(0deg)", opacity: 1 },
                "100%": {
                  transform: `translateY(72vh) translateX(${p.drift}px) rotate(${p.spin}deg)`,
                  opacity: 0.85,
                },
              },
            }}
          />
        ))}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
          animation: "fbPop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <CheckCircle sx={{ fontSize: 88, color: "success.main" }} />
        <Typography variant="h6" sx={{ fontWeight: 700, textShadow: "0 1px 8px rgba(0,0,0,0.35)" }}>
          Workout complete!
        </Typography>
      </Box>
    </Box>
  );
}
