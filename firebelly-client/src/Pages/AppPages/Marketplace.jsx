import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grid,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { FitnessCenter as FitnessCenterIcon } from "@mui/icons-material";
import { billingApi } from "../../api/billingApi";
import { accountApi } from "../../api/accountApi";

// Client-facing storefront: the published programs offered by the client's trainer(s).
// Scoped to accepted relationships today; a cross-trainer marketplace is the future step.
export default function Marketplace() {
  const user = useSelector((state) => state.user);
  const [items, setItems] = useState([]); // { product, trainer }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requesting, setRequesting] = useState({}); // productId -> bool

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trainers = await accountApi.getMyTrainers();
      const relArr = (Array.isArray(trainers) ? trainers : trainers?.myTrainers || []).filter(
        (r) => r.accepted !== false
      );
      // myTrainers returns the trainer's _id in `trainer` with the name at the top level
      // (older data may populate `trainer` as an object) — handle both.
      const trainerList = relArr
        .map((rel) => ({
          _id: rel.trainer?._id || rel.trainer,
          firstName: rel.trainer?.firstName || rel.firstName || "",
          lastName: rel.trainer?.lastName || rel.lastName || "",
        }))
        .filter((t) => t._id);

      const lists = await Promise.all(
        trainerList.map(async (trainer) => {
          try {
            const data = await billingApi.listProducts({ trainerId: trainer._id, activeOnly: true });
            const products = Array.isArray(data) ? data : data?.products || [];
            return products
              .filter((p) => p.itemType === "PROGRAM" && p.programId)
              .map((product) => ({ product, trainer }));
          } catch {
            return [];
          }
        })
      );
      setItems(lists.flat());
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load programs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trainerName = (t) =>
    [t?.firstName, t?.lastName].filter(Boolean).join(" ") || "Your trainer";

  const handleRequest = async (item) => {
    const { product, trainer } = item;
    setRequesting((prev) => ({ ...prev, [product._id]: true }));
    try {
      const res = await billingApi.requestInvoice({
        trainerId: trainer._id,
        lineItems: [{ productId: product._id, quantity: 1 }],
      });
      if (res?.error) throw new Error(res.error);
      setMessage(`Request sent to ${trainerName(trainer)} for "${product.name}". They'll send you an invoice.`);
    } catch (err) {
      setError(err.message || "Unable to send request.");
    } finally {
      setRequesting((prev) => ({ ...prev, [product._id]: false }));
    }
  };

  const priceLabel = (p) => (Number(p.price) > 0 ? `$${Number(p.price).toFixed(2)} ${p.currency || "USD"}` : "Free");

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.product.name.localeCompare(b.product.name)),
    [items]
  );

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4">Programs</Typography>
          <Typography variant="body2" color="text.secondary">
            Training programs offered by your trainer{user?.isTrainer ? "s" : "s"}. Request one and
            they'll send you an invoice. (A full cross-trainer marketplace is on the way.)
          </Typography>
        </Stack>

        {loading && <Typography>Loading programs…</Typography>}
        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        {!loading && !error && sorted.length === 0 && (
          <Typography color="text.secondary">
            No programs available from your trainers yet.
          </Typography>
        )}

        <Grid container spacing={2}>
          {sorted.map(({ product, trainer }) => (
            <Grid key={product._id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <CardContent sx={{ flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Typography variant="h6">{product.name}</Typography>
                    <Chip label={priceLabel(product)} color="primary" size="small" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    by {trainerName(trainer)}
                  </Typography>
                  {product.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {product.description}
                    </Typography>
                  )}
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<FitnessCenterIcon />}
                    disabled={Boolean(requesting[product._id])}
                    onClick={() => handleRequest({ product, trainer })}
                  >
                    {requesting[product._id] ? "Sending…" : "Get this program"}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>

      <Snackbar open={Boolean(message)} autoHideDuration={5000} onClose={() => setMessage("")}>
        <Alert severity="success" variant="filled" onClose={() => setMessage("")}>
          {message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
