import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { updateTrainerPermissions } from "../../Redux/actions";

const AREAS = [
  { key: "workouts", label: "Workouts & programs" },
  { key: "goals", label: "Goals" },
  { key: "measurements", label: "Body measurements" },
  { key: "readiness", label: "Readiness check-ins" },
  { key: "schedule", label: "Schedule & sessions" },
];

const LEVELS = [
  { value: "none", label: "No access" },
  { value: "view", label: "View" },
  { value: "manage", label: "Full" },
];

const fullPerms = () => AREAS.reduce((acc, a) => ({ ...acc, [a.key]: "manage" }), {});
const viewPerms = () => AREAS.reduce((acc, a) => ({ ...acc, [a.key]: "view" }), {});

const withDefaults = (perms) => ({ ...fullPerms(), ...(perms || {}) });

const derivePreset = (perms) => {
  const vals = AREAS.map((a) => perms[a.key]);
  if (vals.every((v) => v === "manage")) return "full";
  if (vals.every((v) => v === "view")) return "view";
  return "custom";
};

// Client-facing control to set how much of their account a given trainer can access in a view-as
// session. Preset-first (Full coaching / View only / Custom); "Custom" reveals per-area levels.
export default function TrainerPermissionsDialog({ open, onClose, trainer }) {
  const dispatch = useDispatch();
  const [perms, setPerms] = useState(fullPerms());
  const [preset, setPreset] = useState("full");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = withDefaults(trainer?.permissions);
    setPerms(init);
    setPreset(derivePreset(init));
  }, [trainer]);

  const applyPreset = (next) => {
    setPreset(next);
    if (next === "full") setPerms(fullPerms());
    else if (next === "view") setPerms(viewPerms());
    // "custom": keep current values
  };

  const setArea = (key, value) => {
    setPerms((p) => ({ ...p, [key]: value }));
    setPreset("custom");
  };

  const handleSave = async () => {
    setSaving(true);
    await dispatch(updateTrainerPermissions(trainer.trainer, perms));
    setSaving(false);
    onClose();
  };

  const name = `${trainer?.firstName || ""} ${trainer?.lastName || ""}`.trim();

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{name ? `What ${name} can access` : "Trainer access"}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Choose how much of your account this trainer can see and manage when they open it.
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={preset}
          onChange={(e, v) => v && applyPreset(v)}
          sx={{ mb: preset === "custom" ? 2 : 0 }}
        >
          <ToggleButton value="full">Full coaching</ToggleButton>
          <ToggleButton value="view">View only</ToggleButton>
          <ToggleButton value="custom">Custom</ToggleButton>
        </ToggleButtonGroup>

        {preset === "custom" && (
          <Stack spacing={1.5}>
            {AREAS.map((a) => (
              <Box key={a.key}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {a.label}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={perms[a.key]}
                  onChange={(e, v) => v && setArea(a.key, v)}
                >
                  {LEVELS.map((l) => (
                    <ToggleButton key={l.value} value={l.value}>
                      {l.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
