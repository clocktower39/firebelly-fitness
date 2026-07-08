import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { trainingBlockApi } from "../../api/trainingBlockApi";
import { programApi } from "../../api/programApi";
import { enterClientAccount } from "../../Redux/actions";

// Trainer view: a client's Training Blocks + "Generate draft program" (Phase 2).
export default function ClientTrainingBlocks({ client }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
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

  // Block creation lives in the client's own Goals wizard, so enter the client's account (view-as) and
  // land on Goals with the wizard auto-opened — a one-tap shortcut for the trainer.
  const planBlock = async () => {
    setError("");
    const data = await dispatch(enterClientAccount(client._id));
    if (data?.error) {
      setError(data.error);
      return;
    }
    navigate("/goals?planBlock=1");
  };

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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1">Training Blocks</Typography>
        <Button size="small" variant="outlined" onClick={planBlock}>Plan a Training Block</Button>
      </Stack>
      {loading ? (
        <CircularProgress size={20} />
      ) : blocks.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          This client hasn&apos;t planned a Training Block yet.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {blocks.map((b) => {
            const prog = b.program && typeof b.program === "object" ? b.program : null;
            const isPublished = prog && prog.status === "PUBLISHED";
            return (
              <Box key={b._id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">{b.title || `${b.weeks}-week block`}</Typography>
                    {prog && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color={isPublished ? "success" : "warning"}
                        label={isPublished ? "Published" : "Draft"}
                      />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {b.weeks} weeks
                    {b.targetDate ? ` · by ${String(b.targetDate).slice(0, 10)}` : ""}
                  </Typography>
                </Box>
                {prog ? (
                  <Button size="small" variant="outlined" onClick={() => navigate(`/programs/${prog._id}/edit`)}>
                    {isPublished ? "Open program" : "Edit draft"}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={generatingId === b._id}
                    onClick={() => generate(b)}
                  >
                    {generatingId === b._id ? "Generating…" : "Generate draft program"}
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
      {error && <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>{error}</Typography>}
    </Paper>
  );
}
