import React from "react";
import { Button, Paper, Stack, Typography } from "@mui/material";

// Teaching empty state: never a bare "No X yet." — say what belongs here and offer the
// one action that creates it. `action` = { label, onClick } (omit for filter-empty cases).
export default function EmptyState({ title, hint, action = null, icon = null, compact = false }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        width: "100%",
        padding: compact ? "20px 16px" : "36px 24px",
        textAlign: "center",
        borderStyle: "dashed",
        backgroundColor: "transparent",
      }}
    >
      <Stack spacing={1.25} sx={{ alignItems: "center" }}>
        {icon}
        <Typography variant={compact ? "subtitle1" : "h6"}>{title}</Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
            {hint}
          </Typography>
        )}
        {action && (
          <Button variant="contained" onClick={action.onClick} sx={{ marginTop: "6px" }}>
            {action.label}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
