import React from "react";
import { Box, Typography } from "@mui/material";
import ExerciseAnimation, { resolveAnimationKey } from "./ExerciseAnimation";
import { parseMediaUrl } from "../../utils/mediaUrl";

// Show the exercise's demo: a pasted media URL (YouTube / MP4 / GIF or image) if set,
// otherwise our built-in animated guide, otherwise a placeholder.
export default function ExerciseMedia({ exercise }) {
  const url = (exercise?.mediaUrl || "").trim();

  const media = parseMediaUrl(url);

  if (media.kind === "youtube") {
    return (
      <Box
        sx={{
          position: "relative",
          // A Short is 9:16. Forcing it into a 16:9 frame leaves the clip as a thin strip
          // between two black bars, so vertical demos get a portrait frame, width-capped so
          // they don't run the length of the page on a desktop.
          pt: media.vertical ? "177.78%" : "56.25%",
          maxWidth: media.vertical ? 260 : "100%",
          mx: "auto",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <Box
          component="iframe"
          src={media.embedSrc}
          title="Exercise demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      </Box>
    );
  }

  if (media.kind === "video") {
    return (
      <Box
        component="video"
        src={media.src}
        controls
        loop
        muted
        playsInline
        sx={{ width: "100%", borderRadius: 2, maxHeight: 320 }}
      />
    );
  }

  if (media.kind === "image") {
    return (
      <Box
        component="img"
        src={media.src}
        alt="Exercise demo"
        sx={{ width: "100%", borderRadius: 2, maxHeight: 320, objectFit: "contain" }}
      />
    );
  }

  const key = resolveAnimationKey(exercise);
  if (key) return <ExerciseAnimation animationKey={key} />;

  return (
    <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
      Video demonstration coming soon.
    </Typography>
  );
}
