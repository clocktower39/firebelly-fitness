import React from "react";
import { MenuItem, TextField } from "@mui/material";

// Target effort for a set (RPE, 10 = nothing left in the tank). Programs prescribe intensity
// this way instead of absolute loads — each client's weight is whatever meets the target.
export const RPE_VALUES = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

const inReserve = (v) => {
  const left = Math.round((10 - v) * 10) / 10;
  if (left === 0) return "max effort";
  return Number.isInteger(left)
    ? `${left} rep${left === 1 ? "" : "s"} left`
    : `${Math.floor(left)}–${Math.ceil(left)} reps left`;
};

export default function RpeSelect({ value, onChange, label = "Target RPE" }) {
  const v = Number(value) || 0;
  return (
    <TextField
      select
      label={label}
      value={RPE_VALUES.includes(v) ? v : 0}
      onChange={onChange}
      size="small"
      fullWidth
    >
      <MenuItem value={0}>—</MenuItem>
      {RPE_VALUES.map((r) => (
        <MenuItem key={r} value={r}>
          {r} · {inReserve(r)}
        </MenuItem>
      ))}
    </TextField>
  );
}
