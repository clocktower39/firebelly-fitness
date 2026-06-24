import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { scheduleApi } from "../api/scheduleApi";
import { billingApi } from "../../../api/billingApi";

// Level 1 "sell a package": trainer records a sale -> creates a PAID invoice with a
// SESSION line item, which lands credits on the client's ledger balance.
export default function SellPackageDialog({ open, onClose, clients, trainerId, onSold }) {
  const [clientId, setClientId] = useState("");
  const [types, setTypes] = useState([]);
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [unitPrice, setUnitPrice] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const acceptedClients = useMemo(
    () => (clients || []).filter((c) => c.accepted),
    [clients]
  );

  // Reset when the dialog opens.
  useEffect(() => {
    if (open) {
      setClientId("");
      setTypes([]);
      setSessionTypeId("");
      setQuantity("10");
      setUnitPrice("");
      setStatus("");
    }
  }, [open]);

  // Load the client's purchasable types when a client is chosen.
  useEffect(() => {
    if (!open || !clientId || !trainerId) {
      setTypes([]);
      return;
    }
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
  }, [open, clientId, trainerId]);

  const handleSelectType = (id) => {
    setSessionTypeId(id);
    const type = types.find((t) => t._id === id);
    setUnitPrice(type?.defaultPrice != null ? String(type.defaultPrice) : "");
  };

  const qtyNum = Math.max(0, Number(quantity) || 0);
  const priceNum = Number(unitPrice) || 0;
  const total = qtyNum * priceNum;
  const selectedType = types.find((t) => t._id === sessionTypeId);

  const handleConfirm = async () => {
    if (!clientId || !sessionTypeId || qtyNum < 1) return;
    setSaving(true);
    setStatus("");
    try {
      const data = await billingApi.createInvoice({
        billToType: "CLIENT",
        clientId,
        status: "PAID",
        lineItems: [
          {
            itemType: "SESSION",
            sessionTypeId,
            quantity: qtyNum,
            unitPrice: priceNum,
            description: `${selectedType?.name || "Session"} package (${qtyNum})`,
          },
        ],
      });
      if (data?.error) throw new Error(data.error);
      onSold?.();
      onClose?.();
    } catch (err) {
      setStatus(err.message || "Unable to record the sale.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Sell a session package</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {status && <Alert severity="error" sx={{ py: 0.5 }}>{status}</Alert>}

          <Autocomplete
            options={acceptedClients}
            getOptionLabel={(o) => `${o.client.firstName} ${o.client.lastName}`}
            isOptionEqualToValue={(o, v) => o.client._id === v.client._id}
            value={acceptedClients.find((c) => c.client._id === clientId) || null}
            onChange={(_, v) => {
              setClientId(v ? v.client._id : "");
              setSessionTypeId("");
              setUnitPrice("");
            }}
            renderInput={(params) => (
              <TextField {...params} label="Client" placeholder="Search clients…" />
            )}
            fullWidth
          />

          <FormControl fullWidth disabled={!clientId}>
            <InputLabel>Session type</InputLabel>
            <Select
              label="Session type"
              value={sessionTypeId}
              onChange={(e) => handleSelectType(e.target.value)}
            >
              {types.map((t) => (
                <MenuItem key={t._id} value={t._id}>
                  {t.name}
                  {t.archivedAt ? " (grandfathered)" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1}>
            <TextField
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              fullWidth
            />
            <TextField
              label="Unit price"
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
              }}
              fullWidth
            />
          </Stack>

          <Typography variant="subtitle2">
            Total: ${total.toFixed(2)} · {qtyNum} session{qtyNum === 1 ? "" : "s"} credited
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Records a paid invoice and adds the credits to the client&apos;s balance.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={saving || !clientId || !sessionTypeId || qtyNum < 1}
        >
          {saving ? "Recording…" : "Record sale"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
