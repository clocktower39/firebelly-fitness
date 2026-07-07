import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { trainingBlockApi } from "../../api/trainingBlockApi";
import { programApi } from "../../api/programApi";

// Trainer view: a client's Training Blocks + "Generate draft program" (Phase 2).
export default function ClientTrainingBlocks({ client }) {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client?._id) return;
    setLoading(true);
    trainingBlockApi
      .listClientBlocks(client._id)
      .then((data) => setBlocks(Array.isArray(data) ? data : []))
      .catch(() => setBlocks([]))
      .finally(() => setLoading(false));
  }, [client?._id]);

  const generate = async (block) => {
    setError("");
    setGeneratingId(block._id);
    try {
      const res = await programApi.generateFromBlock(block._id);
      if (res?.programId) navigate(`/programs/${res.programId}/edit`);
      else setError(res?.error || "Generation failed.");
    } catch (e) {
      setError("Generation failed. Please try again.");
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" gutterBottom>Training Blocks</Typography>
      {loading ? (
        <CircularProgress size={20} />
      ) : blocks.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          This client hasn&apos;t planned a Training Block yet.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {blocks.map((b) => (
            <Box key={b._id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box>
                <Typography variant="body2">{b.title || `${b.weeks}-week block`}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {b.weeks} weeks
                  {b.targetDate ? ` · by ${String(b.targetDate).slice(0, 10)}` : ""}
                  {b.program ? " · draft generated" : ""}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                disabled={generatingId === b._id}
                onClick={() => generate(b)}
              >
                {generatingId === b._id ? "Generating…" : "Generate draft program"}
              </Button>
            </Box>
          ))}
        </Stack>
      )}
      {error && <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>{error}</Typography>}
    </Paper>
  );
}
