import React, { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import logoSvg from "../assets/brand/firebelly_fitness_logo.svg?raw";

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceFill = (svg, originalColor, nextColor) =>
  svg.replace(new RegExp(escapeRegExp(`fill:${originalColor}`), "gi"), `fill:${nextColor}`);

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;

const darkenHex = (color, amount) => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const multiplier = 1 - amount;
  return rgbToHex({
    r: rgb.r * multiplier,
    g: rgb.g * multiplier,
    b: rgb.b * multiplier,
  });
};

const isRedPrimary = (color) => {
  const rgb = hexToRgb(color);
  if (!rgb) return false;
  return rgb.r > 180 && rgb.g < 120 && rgb.b < 120;
};

export default function BrandLogo({
  variant = "full",
  alt = "Firebelly Fitness",
  sx,
}) {
  const theme = useTheme();
  const frogColor = theme.palette.primary.main;
  const eyeLidColor = darkenHex(frogColor, 0.32);
  const eyePupilColor = "#020617";
  const useCoolFlame = isRedPrimary(frogColor);
  const flameColor = useCoolFlame ? "#e0f2fe" : "#DF362C";
  const flameDetailColor = useCoolFlame ? "#38bdf8" : "#F6861F";

  const themedSvg = useMemo(() => {
    let svg = logoSvg;
    svg = replaceFill(svg, "#0F1B22", frogColor);
    svg = replaceFill(svg, "#111D26", eyePupilColor);
    svg = replaceFill(svg, "#636569", eyeLidColor);
    svg = replaceFill(svg, "#86888F", eyeLidColor);
    svg = replaceFill(svg, "#DF362C", flameColor);
    svg = replaceFill(svg, "#F6861F", flameDetailColor);

    if (variant === "mark") {
      svg = svg.replace('viewBox="0 0 200 70.7"', 'viewBox="0 0 70.7 70.7"');
    }

    return svg;
  }, [eyeLidColor, eyePupilColor, flameColor, flameDetailColor, frogColor, variant]);

  return (
    <Box
      role="img"
      aria-label={alt}
      sx={{
        display: "block",
        lineHeight: 0,
        "& svg": {
          display: "block",
          width: "100%",
          height: "100%",
        },
        ...sx,
      }}
      dangerouslySetInnerHTML={{ __html: themedSvg }}
    />
  );
}
