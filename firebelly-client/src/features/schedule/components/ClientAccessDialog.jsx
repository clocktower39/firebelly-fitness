import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { scheduleApi } from "../api/scheduleApi";

// Grandfathering UI: explicitly grant a (usually brand-new) client access to buy an
// ARCHIVED session type at its old rate, or revoke that access. Clients who already
// bought a type keep access automatically (implicit) and don't need a grant here.
export default function ClientAccessDialog({ open, onClose, clients, sessionTypes }) {
  const [clientId, setClientId] = useState("");
  const [entitledIds, setEntitledIds] = useState(new Set());
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState("");

  const acceptedClients = useMemo(
    () => (clients || []).filter((c) => c.accepted),
    [clients]
  );
  const archivedTypes = useMemo(
    () => (sessionTypes || []).filter((t) => t.archivedAt),
    [sessionTypes]
  );

  useEffect(() => {
    if (open) {
      setClientId("");
      setEntitledIds(new Set());
      setStatus("");
    }
  }, [open]);

  const loadEntitlements = async (id) => {
    if (!id) {
      setEntitledIds(new Set());
      return;
    }
    try {
      const data = await scheduleApi.listEntitlements({ clientId: id });
      if (data?.error) throw new Error(data.error);
      const ids = (data.entitlements || []).map((e) =>
        String(e.sessionTypeId?._id || e.sessionTypeId)
      );
      setEntitledIds(new Set(ids));
    } catch (err) {
      setStatus(err.message || "Unable to load access.");
    }
  };

  useEffect(() => {
    if (open && clientId) loadEntitlements(clientId);
  }, [open, clientId]);

  const toggle = async (type) => {
    if (!clientId) return;
    const id = String(type._id);
    const entitled = entitledIds.has(id);
    setBusyId(id);
    setStatus("");
    try {
      const data = entitled
        ? await scheduleApi.revokeEntitlement({ clientId, sessionTypeId: id })
        : await scheduleApi.grantEntitlement({ clientId, sessionTypeId: id });
      if (data?.error) throw new Error(data.error);
      setEntitledIds((prev) => {
        const next = new Set(prev);
        if (entitled) next.delete(id);
        else next.add(id);
        return next;
      });
    } catch (err) {
      setStatus(err.message || "Unable to update access.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Grandfathered access</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {status && (
            <Alert severity="error" sx={{ py: 0.5 }}>
              {status}
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            Grant a client access to buy an archived (old-rate) session type. Clients who
            already purchased a type keep it automatically.
          </Typography>

          <Autocomplete
            options={acceptedClients}
            getOptionLabel={(o) => `${o.client.firstName} ${o.client.lastName}`}
            isOptionEqualToValue={(o, v) => o.client._id === v.client._id}
            value={acceptedClients.find((c) => c.client._id === clientId) || null}
            onChange={(_, v) => setClientId(v ? v.client._id : "")}
            renderInput={(params) => (
              <TextField {...params} label="Client" placeholder="Search clients…" />
            )}
            fullWidth
          />

          {clientId && archivedTypes.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No archived session types yet. (Use "Change price" on a type to create one.)
            </Typography>
          )}

          {clientId &&
            archivedTypes.map((type) => {
              const id = String(type._id);
              const entitled = entitledIds.has(id);
              return (
                <Stack
                  key={id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <Stack>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="body2">{type.name}</Typography>
                      {entitled && <Chip size="small" color="success" label="Granted" />}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {type.defaultPrice != null ? `$${type.defaultPrice}` : "Price not set"} ·{" "}
                      {type.durationMinutes || 60} min
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    variant={entitled ? "text" : "outlined"}
                    color={entitled ? "error" : "primary"}
                    disabled={busyId === id}
                    onClick={() => toggle(type)}
                  >
                    {entitled ? "Revoke" : "Grant"}
                  </Button>
                </Stack>
              );
            })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
