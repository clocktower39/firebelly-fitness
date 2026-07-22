import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { scheduleApi } from "../api/scheduleApi";
import { billingApi } from "../../../api/billingApi";
import { formatPrice } from "../../../utils/currency";
import { sessionTypeLabel } from "../../../utils/sessionTypeLabel";

// Level 1.5: a client requests a session package from their trainer. This creates a
// SENT invoice the trainer then confirms (marks paid) to release the credits.
export default function RequestPackageDialog({ open, onClose, trainerId, clientId }) {
  const [types, setTypes] = useState([]);
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [status, setStatus] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSessionTypeId("");
    setQuantity("10");
    setStatus("");
    setSent(false);
    if (!trainerId || !clientId) return;
    let cancelled = false;
    scheduleApi
      .getPurchasableTypes({ trainerId, clientId })
      .then((data) => {
        if (!cancelled && data && !data.error) setTypes(data.sessionTypes || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, trainerId, clientId]);

  const selectedType = useMemo(
    () => types.find((t) => t._id === sessionTypeId),
    [types, sessionTypeId]
  );
  const qtyNum = Math.max(0, Number(quantity) || 0);
  const unitPrice = selectedType?.defaultPrice ?? 0;
  const total = qtyNum * unitPrice;

  const handleRequest = async () => {
    if (!trainerId || !sessionTypeId || qtyNum < 1) return;
    setSaving(true);
    setStatus("");
    try {
      const data = await billingApi.requestInvoice({
        trainerId,
        lineItems: [
          {
            itemType: "SESSION",
            sessionTypeId,
            quantity: qtyNum,
            unitPrice,
            description: `${selectedType?.name || "Session"} package (${qtyNum})`,
          },
        ],
      });
      if (data?.error) throw new Error(data.error);
      setSent(true);
    } catch (err) {
      setStatus(err.message || "Unable to send request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Request sessions</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {sent ? (
          <Alert severity="success" sx={{ mt: 1 }}>
            Request sent to your trainer. They&apos;ll confirm it and your sessions will be
            added to your balance.
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {status && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {status}
              </Alert>
            )}
            {!trainerId && (
              <Typography variant="body2" color="text.secondary">
                Select a trainer first.
              </Typography>
            )}
            <FormControl fullWidth disabled={!trainerId}>
              <InputLabel>Session type</InputLabel>
              <Select
                label="Session type"
                value={sessionTypeId}
                onChange={(e) => setSessionTypeId(e.target.value)}
              >
                {types.map((t) => (
                  <MenuItem key={t._id} value={t._id}>
                    {sessionTypeLabel(t)}
                    {t.defaultPrice != null
                      ? ` · ${formatPrice(t.defaultPrice, t.currency)} each`
                      : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="How many sessions?"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              fullWidth
            />
            {selectedType && (
              <Typography variant="subtitle2">
                Estimated total: {formatPrice(total, selectedType.currency)}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              This sends a request to your trainer. Sessions are added once they confirm
              payment.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{sent ? "Done" : "Cancel"}</Button>
        {!sent && (
          <Button
            variant="contained"
            onClick={handleRequest}
            disabled={saving || !trainerId || !sessionTypeId || qtyNum < 1}
          >
            {saving ? "Sending…" : "Send request"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
