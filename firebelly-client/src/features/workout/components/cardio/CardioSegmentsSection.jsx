import React, { useState } from "react";
import { Add, Delete } from "@mui/icons-material";
import {
  Button,
  Collapse,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

export default function CardioSegmentsSection({
  activeCardio,
  cardioSectionsOpen,
  handleAddCardioSegment,
  handleGenerateEvenSplits,
  handleCardioSegmentChange,
  handleRemoveCardioSegment,
  paceUnitLabel,
  primaryCardioMetric,
  speedUnitLabel,
  splitMetricLabel,
  splitMetricUnitLabel,
  splitMetricValue,
  splitSummary,
}) {
  const [evenCount, setEvenCount] = useState(4);

  return (
    <Grid size={12}>
      <Collapse in={cardioSectionsOpen.segments} unmountOnExit>
        <Paper variant="outlined" sx={{ padding: "16px" }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Typography variant="subtitle1">Splits & Intervals</Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <TextField
                  label="# splits"
                  type="number"
                  size="small"
                  value={evenCount}
                  onChange={(event) => setEvenCount(event.target.value)}
                  sx={{ width: 92 }}
                  slotProps={{ htmlInput: { min: 1, max: 50, inputMode: "numeric" } }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleGenerateEvenSplits(evenCount)}
                >
                  Even splits
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleAddCardioSegment}
                  startIcon={<Add />}
                >
                  Add split
                </Button>
              </Stack>
            </Stack>
            {(activeCardio.segments || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Add splits to track warmups, repeats, or cooldowns.
              </Typography>
            ) : (
              (activeCardio.segments || []).map((segment, index) => (
                <Paper key={`cardio-segment-${index}`} variant="outlined" sx={{ padding: "12px" }}>
                  <Grid container spacing={2} sx={{ alignItems: "center" }}>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <TextField
                        label="Label"
                        value={segment.label}
                        onChange={handleCardioSegmentChange(index, "label")}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2 }}>
                      <TextField
                        label={`Distance (${activeCardio.distanceUnit})`}
                        type="number"
                        value={segment.distance}
                        onChange={handleCardioSegmentChange(index, "distance")}
                        fullWidth
                        slotProps={{ htmlInput: { min: 0, step: "0.01", inputMode: "decimal" } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2 }}>
                      <TextField
                        label="Duration"
                        placeholder="mm:ss"
                        value={segment.duration}
                        onChange={handleCardioSegmentChange(index, "duration")}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2 }}>
                      <TextField
                        label={
                          primaryCardioMetric === "speed"
                            ? `Speed (${speedUnitLabel})`
                            : `Pace (${paceUnitLabel})`
                        }
                        placeholder={primaryCardioMetric === "speed" ? "0.0" : "mm:ss"}
                        value={segment.pace}
                        onChange={handleCardioSegmentChange(index, "pace")}
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 4, sm: 2 }}>
                      <TextField
                        label="RPE"
                        type="number"
                        value={segment.rpe}
                        onChange={handleCardioSegmentChange(index, "rpe")}
                        fullWidth
                        slotProps={{ htmlInput: { min: 1, max: 10, inputMode: "numeric" } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 2, sm: 1 }} container sx={{ justifyContent: "flex-end" }}>
                      <Tooltip title="Remove split">
                        <IconButton onClick={() => handleRemoveCardioSegment(index)}>
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </Paper>
              ))
            )}
            {(activeCardio.segments || []).length > 0 && (
              <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
                <Typography variant="body2" color="text.secondary">
                  Total distance: {splitSummary.totalDistance || "—"} {activeCardio.distanceUnit}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total time: {splitSummary.totalDuration || "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {splitMetricLabel}: {splitMetricValue || "—"} {splitMetricUnitLabel}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Collapse>
    </Grid>
  );
}
