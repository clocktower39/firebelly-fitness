import React from "react";
import { Box, Button, IconButton, Stack, TextField, Typography } from "@mui/material";
import { Add, RemoveCircle } from "@mui/icons-material";

// Client logging for techniques that have sub-structure (a `result` schema in the registry): drop
// sets, rep goals, clusters, rest-pause, myo-reps. Auto-generated from the result schema — the same
// data-driven pattern as the config form. Cue-only techniques (tempo, RIR, …) have no result schema
// and render nothing here. Writes the logged result onto each technique attachment (result.items).

const FieldInput = ({ field, value, onChange }) => (
  <TextField
    size="small"
    type="number"
    label={`${field.label}${field.unit ? ` (${field.unit})` : ""}`}
    value={value ?? ""}
    onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
    sx={{ maxWidth: 130 }}
  />
);

export default function TechniqueLogger({ registry, techniques = [], onChange }) {
  const loggable = techniques
    .map((t, index) => ({ t, index, def: registry.byKey?.[t.key] }))
    .filter((x) => x.def && x.def.result);

  if (loggable.length === 0) return null;

  const setResult = (index, items) =>
    onChange(techniques.map((t, i) => (i === index ? { ...t, result: { items } } : t)));

  return (
    <Stack spacing={1.5} sx={{ mt: 1.5 }}>
      {loggable.map(({ t, index, def }) => {
        const schema = def.result;
        const stored = t.result && Array.isArray(t.result.items) ? t.result.items : [];

        // Fixed-count techniques (e.g. drop set) render exactly `count.fromParam` rows; dynamic ones
        // (e.g. rep goal) render whatever the client has logged plus an "add" button.
        let rows = stored;
        if (schema.count?.fromParam) {
          const n = Number(t.params?.[schema.count.fromParam]) || 0;
          rows = Array.from({ length: n }, (_, i) => stored[i] || {});
        }

        const commit = (next) => setResult(index, next);
        const setCell = (rowIndex, fieldName, value) =>
          commit(rows.map((r, i) => (i === rowIndex ? { ...r, [fieldName]: value } : r)));
        const addRow = () => commit([...rows, {}]);
        const removeRow = (rowIndex) => commit(rows.filter((_, i) => i !== rowIndex));

        const tallySum = schema.tally
          ? rows.reduce((s, r) => s + (Number(r[schema.tally.field]) || 0), 0)
          : null;
        const tallyGoal = schema.tally ? Number(t.params?.[schema.tally.goalParam]) || 0 : null;

        return (
          <Box
            key={t._id || `${t.key}-${index}`}
            sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">{def.name}</Typography>
              {schema.tally && (
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600 }}
                  color={tallySum >= tallyGoal && tallyGoal > 0 ? "success.main" : "text.secondary"}
                >
                  {tallySum} / {tallyGoal} {schema.tally.field}
                </Typography>
              )}
            </Stack>
            <Stack spacing={1}>
              {rows.map((row, rowIndex) => (
                <Stack key={rowIndex} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="caption" sx={{ minWidth: 64 }}>
                    {schema.itemLabel} {rowIndex + 1}
                  </Typography>
                  {schema.fields.map((field) => (
                    <FieldInput
                      key={field.name}
                      field={field}
                      value={row[field.name]}
                      onChange={(v) => setCell(rowIndex, field.name, v)}
                    />
                  ))}
                  {schema.count?.dynamic && (
                    <IconButton size="small" onClick={() => removeRow(rowIndex)} aria-label="remove">
                      <RemoveCircle fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              ))}
              {schema.count?.dynamic && (
                <Button
                  size="small"
                  startIcon={<Add />}
                  onClick={addRow}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {schema.itemLabel}
                </Button>
              )}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
