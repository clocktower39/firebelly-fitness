import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import dayjs from "dayjs";

// Step to the workout either side of this one, in the owner's dated order.
//
// Each button names where it goes — date and title — rather than a bare "Next workout":
// flipping through a program, knowing the next session is "Sep 9 · D3 — Full Body C" is the
// whole point, and a trainer reviewing a client can tell at a glance whether the next session
// is tomorrow or next week.
//
// Deliberately NOT placed beside the header's back arrow, which means "return to where you came
// from" — two back arrows side by side with different meanings is the trap here.
export default function WorkoutNeighbourNav({ prev, next, onNavigate }) {
  // Nothing either side (a one-off workout, or a template): render nothing rather than two
  // dead buttons.
  if (!prev && !next) return null;

  const label = (w) => ({
    date: w?.date ? dayjs.utc(w.date).format("MMM D") : "",
    title: (w?.title || "").trim() || "Untitled",
  });

  const side = (w, dir) => {
    const isPrev = dir === "prev";
    if (!w) {
      // Hold the space so the remaining button stays on its own side instead of sliding across.
      return <Box sx={{ flex: 1 }} />;
    }
    const { date, title } = label(w);
    return (
      <Button
        onClick={() => onNavigate(w._id)}
        sx={{
          flex: 1,
          minWidth: 0,
          justifyContent: isPrev ? "flex-start" : "flex-end",
          textAlign: isPrev ? "left" : "right",
          textTransform: "none",
          px: 1,
        }}
        aria-label={`${isPrev ? "Previous" : "Next"} workout: ${title}${date ? ` on ${date}` : ""}`}
      >
        {isPrev && <ChevronLeft fontSize="small" />}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ display: "block", opacity: 0.75, lineHeight: 1.2 }}>
            {isPrev ? "Previous" : "Next"}
            {date ? ` · ${date}` : ""}
          </Typography>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {title}
          </Typography>
        </Box>
        {!isPrev && <ChevronRight fontSize="small" />}
      </Button>
    );
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        width: "100%",
        alignItems: "center",
        justifyContent: "space-between",
        borderTop: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
        py: 0.5,
        mt: 1,
      }}
    >
      {side(prev, "prev")}
      {side(next, "next")}
    </Stack>
  );
}
