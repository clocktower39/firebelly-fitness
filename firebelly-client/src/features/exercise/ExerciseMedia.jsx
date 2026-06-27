import React from "react";
import { Box, Typography } from "@mui/material";
import ExerciseAnimation, { resolveAnimationKey } from "./ExerciseAnimation";

const ytId = (url) => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
};

// Show the exercise's demo: a pasted media URL (YouTube / MP4 / GIF or image) if set,
// otherwise our built-in animated guide, otherwise a placeholder.
export default function ExerciseMedia({ exercise }) {
  const url = (exercise?.mediaUrl || "").trim();

  if (url) {
    const yt = ytId(url);
    if (yt) {
      return (
        <Box sx={{ position: "relative", pt: "56.25%", borderRadius: 2, overflow: "hidden" }}>
          <Box
            component="iframe"
            src={`https://www.youtube.com/embed/${yt}`}
            title="Exercise demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          />
        </Box>
      );
    }
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
      return (
        <Box
          component="video"
          src={url}
          controls
          loop
          muted
          playsInline
          sx={{ width: "100%", borderRadius: 2, maxHeight: 320 }}
        />
      );
    }
    return (
      <Box
        component="img"
        src={url}
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
