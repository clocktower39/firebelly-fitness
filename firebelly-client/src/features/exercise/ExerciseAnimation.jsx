import React from "react";
import { Box, Typography } from "@mui/material";

// Map an exercise to one of our built-in animated guides by title keyword. Returns null when
// we can't confidently match (those land on the admin "needs media" list for a real upload).
const KEY_RULES = [
  { key: "curl", label: "Curl", re: /\bcurl\b/i },
  { key: "press", label: "Overhead press", re: /(overhead|shoulder|military|ohp)\s*press|press\s*(overhead|shoulder)|\bohp\b/i },
  { key: "raise", label: "Lateral raise", re: /lateral raise|side raise|\blateral\b|delt raise/i },
  { key: "pushup", label: "Push-up", re: /push[\s-]?up|press[\s-]?up/i },
  { key: "hinge", label: "Hip hinge", re: /deadlift|\bhinge\b|\brdl\b|good[\s-]?morning|hip thrust/i },
  { key: "squat", label: "Squat", re: /\bsquat\b|\blunge\b|goblet/i },
  { key: "row", label: "Row", re: /\brow\b/i },
];

export const resolveAnimationKey = (exercise) => {
  const t = exercise?.exerciseTitle || "";
  const rule = KEY_RULES.find((r) => r.re.test(t));
  return rule ? rule.key : null;
};

export const animationLabel = (key) => KEY_RULES.find((r) => r.key === key)?.label || "";

const LINE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
const DUR = "2.6s";

// A small dumbbell glyph centred at (cx, cy).
const Dumbbell = ({ cx, cy }) => (
  <g>
    <line x1={cx - 9} y1={cy} x2={cx + 9} y2={cy} style={LINE} />
    <circle cx={cx - 9} cy={cy} r={3.5} fill="currentColor" />
    <circle cx={cx + 9} cy={cy} r={3.5} fill="currentColor" />
  </g>
);

const Head = ({ cx, cy }) => <circle cx={cx} cy={cy} r={8} style={LINE} />;

// Each guide: a simple stick figure with one part animated via SMIL (robust in SVG).
const GUIDES = {
  squat: (
    <svg viewBox="0 0 120 120" width="100%" height="100%">
      <line x1={20} y1={112} x2={100} y2={112} style={{ ...LINE, opacity: 0.3 }} />
      <g>
        <Head cx={60} cy={26} />
        <line x1={60} y1={34} x2={60} y2={66} style={LINE} />
        <line x1={42} y1={40} x2={78} y2={40} style={LINE} />
        <line x1={60} y1={66} x2={46} y2={96} style={LINE} />
        <line x1={60} y1={66} x2={74} y2={96} style={LINE} />
        <animateTransform attributeName="transform" type="translate"
          values="0 0; 0 16; 0 0" keyTimes="0;0.5;1" dur={DUR} repeatCount="indefinite" />
      </g>
    </svg>
  ),
  press: (
    <svg viewBox="0 0 120 120" width="100%" height="100%">
      <Head cx={60} cy={30} />
      <line x1={60} y1={38} x2={60} y2={78} style={LINE} />
      <line x1={60} y1={78} x2={48} y2={108} style={LINE} />
      <line x1={60} y1={78} x2={72} y2={108} style={LINE} />
      <g>
        <line x1={60} y1={46} x2={60} y2={30} style={LINE} />
        <Dumbbell cx={60} cy={26} />
        <animateTransform attributeName="transform" type="translate"
          values="0 0; 0 -20; 0 0" keyTimes="0;0.5;1" dur={DUR} repeatCount="indefinite" />
      </g>
    </svg>
  ),
  curl: (
    <svg viewBox="0 0 120 120" width="100%" height="100%">
      <Head cx={60} cy={26} />
      <line x1={60} y1={34} x2={60} y2={74} style={LINE} />
      <line x1={60} y1={74} x2={48} y2={104} style={LINE} />
      <line x1={60} y1={74} x2={72} y2={104} style={LINE} />
      <line x1={60} y1={44} x2={74} y2={66} style={LINE} />
      <g>
        <line x1={74} y1={66} x2={74} y2={90} style={LINE} />
        <Dumbbell cx={74} cy={92} />
        <animateTransform attributeName="transform" type="rotate"
          values="0 74 66; -145 74 66; 0 74 66" keyTimes="0;0.5;1" dur={DUR} repeatCount="indefinite" />
      </g>
    </svg>
  ),
  raise: (
    <svg viewBox="0 0 120 120" width="100%" height="100%">
      <Head cx={60} cy={26} />
      <line x1={60} y1={34} x2={60} y2={74} style={LINE} />
      <line x1={60} y1={74} x2={48} y2={104} style={LINE} />
      <line x1={60} y1={74} x2={72} y2={104} style={LINE} />
      <g>
        <line x1={60} y1={44} x2={40} y2={70} style={LINE} />
        <Dumbbell cx={38} cy={72} />
        <animateTransform attributeName="transform" type="rotate"
          values="0 60 44; 55 60 44; 0 60 44" keyTimes="0;0.5;1" dur={DUR} repeatCount="indefinite" />
      </g>
      <g>
        <line x1={60} y1={44} x2={80} y2={70} style={LINE} />
        <Dumbbell cx={82} cy={72} />
        <animateTransform attributeName="transform" type="rotate"
          values="0 60 44; -55 60 44; 0 60 44" keyTimes="0;0.5;1" dur={DUR} repeatCount="indefinite" />
      </g>
    </svg>
  ),
  pushup: (
    <svg viewBox="0 0 120 120" width="100%" height="100%">
      <line x1={14} y1={104} x2={106} y2={104} style={{ ...LINE, opacity: 0.3 }} />
      <g>
        <Head cx={30} cy={70} />
        <line x1={38} y1={72} x2={96} y2={80} style={LINE} />
        <line x1={50} y1={74} x2={50} y2={100} style={LINE} />
        <line x1={96} y1={80} x2={104} y2={100} style={LINE} />
        <animateTransform attributeName="transform" type="translate"
          values="0 0; 0 10; 0 0" keyTimes="0;0.5;1" dur={DUR} repeatCount="indefinite" />
      </g>
    </svg>
  ),
  hinge: (
    <svg viewBox="0 0 120 120" width="100%" height="100%">
      <line x1={20} y1={112} x2={100} y2={112} style={{ ...LINE, opacity: 0.3 }} />
      <line x1={60} y1={70} x2={50} y2={104} style={LINE} />
      <line x1={60} y1={70} x2={70} y2={104} style={LINE} />
      <g>
        <Head cx={60} cy={28} />
        <line x1={60} y1={36} x2={60} y2={70} style={LINE} />
        <line x1={60} y1={48} x2={62} y2={74} style={LINE} />
        <Dumbbell cx={62} cy={78} />
        <animateTransform attributeName="transform" type="rotate"
          values="0 60 70; 60 60 70; 0 60 70" keyTimes="0;0.5;1" dur={DUR} repeatCount="indefinite" />
      </g>
    </svg>
  ),
  row: (
    <svg viewBox="0 0 120 120" width="100%" height="100%">
      <line x1={30} y1={58} x2={92} y2={50} style={LINE} />
      <Head cx={26} cy={56} />
      <line x1={92} y1={50} x2={86} y2={100} style={LINE} />
      <line x1={92} y1={50} x2={98} y2={100} style={LINE} />
      <g>
        <line x1={70} y1={54} x2={70} y2={78} style={LINE} />
        <Dumbbell cx={70} cy={80} />
        <animateTransform attributeName="transform" type="translate"
          values="0 0; 0 -22; 0 0" keyTimes="0;0.5;1" dur={DUR} repeatCount="indefinite" />
      </g>
    </svg>
  ),
};

export default function ExerciseAnimation({ animationKey, size = 140 }) {
  const guide = GUIDES[animationKey];
  if (!guide) return null;
  return (
    <Box sx={{ textAlign: "center" }}>
      <Box sx={{ width: size, height: size, mx: "auto", color: "primary.main" }}>{guide}</Box>
      <Typography variant="caption" color="text.secondary">
        Animated guide · {animationLabel(animationKey)}
      </Typography>
    </Box>
  );
}
