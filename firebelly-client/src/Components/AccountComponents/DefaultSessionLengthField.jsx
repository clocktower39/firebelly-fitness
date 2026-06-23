import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { updateUserSettings } from "../../Redux/actions";

// Common session lengths (minutes). Kept in sync with the backend bounds (5–480).
export const SESSION_LENGTH_OPTIONS = [15, 30, 45, 60, 75, 90, 120];

// Shared control for the trainer's default session length. Reads/writes the same
// Redux-backed user setting, so it can be reused in the account settings panel and
// inline on the Scheduling page.
export default function DefaultSessionLengthField({
  label = "Default session length",
  size = "medium",
  sx,
}) {
  const dispatch = useDispatch();
  const value = useSelector((state) => state.user.defaultSessionLengthMinutes) || 60;
  const labelId = "default-session-length-label";

  const handleChange = (event) => {
    dispatch(updateUserSettings({ defaultSessionLengthMinutes: Number(event.target.value) }));
  };

  return (
    <FormControl size={size} sx={{ minWidth: 200, ...sx }}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select labelId={labelId} value={value} label={label} onChange={handleChange}>
        {SESSION_LENGTH_OPTIONS.map((minutes) => (
          <MenuItem key={minutes} value={minutes}>
            {minutes} min
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
