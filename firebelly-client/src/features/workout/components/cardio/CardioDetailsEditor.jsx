import React, { useRef } from "react";
import {
  Button,
  Grid,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CardioBasicFields from "./CardioBasicFields";
import CardioConditionsSection from "./CardioConditionsSection";
import CardioMetricsSection from "./CardioMetricsSection";
import CardioNotesSection from "./CardioNotesSection";
import CardioRouteSection from "./CardioRouteSection";
import CardioSegmentsSection from "./CardioSegmentsSection";
import CardioSummaryPanel from "./CardioSummaryPanel";

export default function CardioDetailsEditor({
  activeCardio,
  activeCardioConfig,
  cardioAuto,
  canRepeatLast,
  cardioComparisonItems,
  cardioDistanceUnitOptions,
  cardioRouteOptions,
  cardioSectionHasData,
  cardioSectionSummaries,
  cardioSectionsOpen,
  cardioStatus,
  cardioStyleOptions,
  cardioStylePresets,
  cardioSurfaceOptions,
  cardioViewMode,
  durationHasError,
  handleAddCardioSegment,
  handleGenerateEvenSplits,
  handleCardioActivityChange,
  handleCardioChange,
  handleCardioDerivedChange,
  handleCardioDistanceUnitChange,
  handleCardioSegmentChange,
  handleCardioViewModeChange,
  handleCopyPlanFieldToActual,
  handleCopyPlanToActual,
  handleRemoveCardioSegment,
  handleRepeatLast,
  handleStylePreset,
  handleToggleClientPrompt,
  isTrainerEditingClient,
  lastSessionLabel,
  missingClientPromptKeys,
  paceUnitLabel,
  planClientPrompts,
  planCopyActions,
  primaryCardioMetric,
  primaryCardioMetricAutoKey,
  primaryCardioMetricField,
  primaryCardioMetricHelperText,
  primaryCardioMetricLabel,
  primaryCardioMetricPlaceholder,
  primaryMetricHasError,
  secondaryCardioMetric,
  secondaryCardioMetricAutoKey,
  secondaryCardioMetricField,
  secondaryCardioMetricHelperText,
  secondaryCardioMetricLabel,
  secondaryCardioMetricPlaceholder,
  secondaryMetricHasError,
  shoeMileageHelper,
  shoeOptions,
  speedUnitLabel,
  splitMetricLabel,
  splitMetricUnitLabel,
  splitMetricValue,
  splitSummary,
  toggleCardioSection,
}) {
  // Swipe left/right to move Plan <-> Results (mirrors the strength circuit-to-circuit swipe). Ignores
  // vertical scrolls and swipes that start on a form control.
  const swipeRef = useRef({ x: 0, y: 0, skip: false });
  const handleSwipeStart = (event) => {
    const touch = event.touches[0];
    const tag = event.target?.tagName;
    swipeRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      skip: ["INPUT", "TEXTAREA", "SELECT"].includes(tag),
    };
  };
  const handleSwipeEnd = (event) => {
    if (swipeRef.current.skip) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - swipeRef.current.x;
    const dy = touch.clientY - swipeRef.current.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && cardioViewMode !== "actual") handleCardioViewModeChange(null, "actual");
    else if (dx > 0 && cardioViewMode !== "plan") handleCardioViewModeChange(null, "plan");
  };

  return (
    <>
      <Grid size={12}>
        <Paper
          variant="outlined"
          sx={{ padding: "16px" }}
          onTouchStart={handleSwipeStart}
          onTouchEnd={handleSwipeEnd}
        >
          <Stack spacing={2.5}>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <Stack spacing={0.25}>
                <Typography variant="h6">Cardio Details</Typography>
                <Typography variant="body2" color="text.secondary">
                  {cardioViewMode === "actual"
                    ? "Log what you did — swipe right for the plan."
                    : "Plan the session — swipe left to log results."}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <ToggleButtonGroup
                  value={cardioViewMode}
                  exclusive
                  size="small"
                  onChange={handleCardioViewModeChange}
                >
                  <ToggleButton value="plan">Plan</ToggleButton>
                  <ToggleButton value="actual">Results</ToggleButton>
                </ToggleButtonGroup>
                {/* Always render (reserving its width) so the Plan/Results toggle doesn't shift when
                    switching modes; just hide + disable it on the Plan view. */}
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleCopyPlanToActual}
                  disabled={cardioViewMode !== "actual"}
                  sx={{ visibility: cardioViewMode === "actual" ? "visible" : "hidden" }}
                >
                  Log as planned
                </Button>
              </Stack>
            </Stack>

            <CardioBasicFields
              activeCardio={activeCardio}
              cardioAuto={cardioAuto}
              cardioDistanceUnitOptions={cardioDistanceUnitOptions}
              cardioStyleOptions={cardioStyleOptions}
              cardioViewMode={cardioViewMode}
              durationHasError={durationHasError}
              handleCardioActivityChange={handleCardioActivityChange}
              handleCardioChange={handleCardioChange}
              handleCardioDerivedChange={handleCardioDerivedChange}
              handleCardioDistanceUnitChange={handleCardioDistanceUnitChange}
              primaryCardioMetric={primaryCardioMetric}
              primaryCardioMetricAutoKey={primaryCardioMetricAutoKey}
              primaryCardioMetricField={primaryCardioMetricField}
              primaryCardioMetricHelperText={primaryCardioMetricHelperText}
              primaryCardioMetricLabel={primaryCardioMetricLabel}
              primaryCardioMetricPlaceholder={primaryCardioMetricPlaceholder}
              primaryMetricHasError={primaryMetricHasError}
            />

            <CardioSummaryPanel
              activeCardio={activeCardio}
              canRepeatLast={canRepeatLast}
              handleRepeatLast={handleRepeatLast}
              lastSessionLabel={lastSessionLabel}
              cardioComparisonItems={cardioComparisonItems}
              cardioSectionHasData={cardioSectionHasData}
              cardioSectionSummaries={cardioSectionSummaries}
              cardioSectionsOpen={cardioSectionsOpen}
              cardioStatus={cardioStatus}
              cardioStylePresets={cardioStylePresets}
              cardioViewMode={cardioViewMode}
              handleCopyPlanFieldToActual={handleCopyPlanFieldToActual}
              handleStylePreset={handleStylePreset}
              handleToggleClientPrompt={handleToggleClientPrompt}
              isTrainerEditingClient={isTrainerEditingClient}
              missingClientPromptKeys={missingClientPromptKeys}
              planClientPrompts={planClientPrompts}
              planCopyActions={planCopyActions}
              toggleCardioSection={toggleCardioSection}
            />
          </Stack>
        </Paper>
      </Grid>
      <CardioMetricsSection
        activeCardio={activeCardio}
        activeCardioConfig={activeCardioConfig}
        cardioAuto={cardioAuto}
        cardioSectionsOpen={cardioSectionsOpen}
        cardioViewMode={cardioViewMode}
        handleCardioChange={handleCardioChange}
        handleCardioDerivedChange={handleCardioDerivedChange}
        secondaryCardioMetric={secondaryCardioMetric}
        secondaryCardioMetricAutoKey={secondaryCardioMetricAutoKey}
        secondaryCardioMetricField={secondaryCardioMetricField}
        secondaryCardioMetricHelperText={secondaryCardioMetricHelperText}
        secondaryCardioMetricLabel={secondaryCardioMetricLabel}
        secondaryCardioMetricPlaceholder={secondaryCardioMetricPlaceholder}
        secondaryMetricHasError={secondaryMetricHasError}
      />
      <CardioRouteSection
        activeCardio={activeCardio}
        activeCardioConfig={activeCardioConfig}
        cardioRouteOptions={cardioRouteOptions}
        cardioSectionsOpen={cardioSectionsOpen}
        cardioSurfaceOptions={cardioSurfaceOptions}
        handleCardioChange={handleCardioChange}
        shoeMileageHelper={shoeMileageHelper}
        shoeOptions={shoeOptions}
      />
      <CardioConditionsSection
        activeCardio={activeCardio}
        cardioSectionsOpen={cardioSectionsOpen}
        handleCardioChange={handleCardioChange}
      />
      <CardioNotesSection
        activeCardio={activeCardio}
        cardioSectionsOpen={cardioSectionsOpen}
        handleCardioChange={handleCardioChange}
      />
      <CardioSegmentsSection
        activeCardio={activeCardio}
        cardioSectionsOpen={cardioSectionsOpen}
        handleAddCardioSegment={handleAddCardioSegment}
        handleGenerateEvenSplits={handleGenerateEvenSplits}
        handleCardioSegmentChange={handleCardioSegmentChange}
        handleRemoveCardioSegment={handleRemoveCardioSegment}
        paceUnitLabel={paceUnitLabel}
        primaryCardioMetric={primaryCardioMetric}
        speedUnitLabel={speedUnitLabel}
        splitMetricLabel={splitMetricLabel}
        splitMetricUnitLabel={splitMetricUnitLabel}
        splitMetricValue={splitMetricValue}
        splitSummary={splitSummary}
      />
    </>
  );
}
