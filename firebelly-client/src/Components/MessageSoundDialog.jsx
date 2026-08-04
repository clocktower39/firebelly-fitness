import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Radio,
  Select,
  Typography,
} from "@mui/material";
import { UploadFile } from "@mui/icons-material";
import { updateUserSettings } from "../Redux/actions/accountActions";
import { soundApi } from "../api/soundApi";
import { BUILTIN_SOUNDS, playMessageSound } from "../utils/messageSounds";

// Assign a notification sound to a chat, a person, or the account-wide default.
// `targets` are the assignable keys offered in the "Apply to" picker, e.g.
// [{ key: "conv:<id>", label: "This chat" }, { key: "user:<id>", label: "Sam Kim — in any chat" }].
// Tapping an option previews it; Save writes the messageSounds user setting.
export default function MessageSoundDialog({ open, onClose, targets = [] }) {
  const dispatch = useDispatch();
  const messageSounds = useSelector((s) => s.user?.messageSounds) || {};
  const [targetKey, setTargetKey] = useState("");
  const [selected, setSelected] = useState("");
  const [mySounds, setMySounds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const first = targets[0]?.key || "";
    setTargetKey(first);
    setSelected(messageSounds[first] || "");
    setUploadError("");
    soundApi.list().then((r) => Array.isArray(r) && setMySounds(r));
  }, [open]);

  const pickTarget = (key) => {
    setTargetKey(key);
    setSelected(messageSounds[key] || "");
  };

  const pickSound = (value) => {
    setSelected(value);
    if (value && value !== "none") playMessageSound(value);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const res = await soundApi.upload(file);
    setUploading(false);
    if (res?.fileId) {
      setMySounds((prev) => [{ fileId: res.fileId, name: res.name }, ...prev]);
      pickSound(`file:${res.fileId}`);
    } else {
      setUploadError(res?.error || "Upload failed — choose an audio file under 5MB.");
    }
  };

  const save = () => {
    const next = { ...messageSounds };
    if (selected) next[targetKey] = selected;
    else delete next[targetKey];
    dispatch(updateUserSettings({ messageSounds: next }));
    onClose();
  };

  const isDefaultTarget = targetKey === "default";
  const options = [
    {
      value: "",
      label: isDefaultTarget ? "None" : "My default sound",
      hint: isDefaultTarget
        ? "No sound unless a chat or person has one assigned"
        : "Follow the account-wide default",
    },
    ...(isDefaultTarget
      ? []
      : [{ value: "none", label: "Silent", hint: "Never play a sound for this one" }]),
    ...BUILTIN_SOUNDS.map((s) => ({ value: `builtin:${s.id}`, label: s.label })),
    ...mySounds.map((s) => ({ value: `file:${s.fileId}`, label: s.name || "Custom sound" })),
  ];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Notification sound</DialogTitle>
      <DialogContent dividers>
        {targets.length > 1 ? (
          <FormControl fullWidth size="small" sx={{ mt: 0.5, mb: 1 }}>
            <InputLabel id="sound-target-label">Apply to</InputLabel>
            <Select
              labelId="sound-target-label"
              label="Apply to"
              value={targetKey}
              onChange={(e) => pickTarget(e.target.value)}
            >
              {targets.map((t) => (
                <MenuItem key={t.key} value={t.key}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {targets[0]?.label}
          </Typography>
        )}
        <List dense disablePadding sx={{ maxHeight: 320, overflowY: "auto" }}>
          {options.map((o) => (
            <ListItemButton key={o.value || "unset"} onClick={() => pickSound(o.value)} dense>
              <Radio edge="start" size="small" checked={selected === o.value} tabIndex={-1} disableRipple />
              <ListItemText
                primary={o.label}
                secondary={o.hint}
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ my: 1 }} />
        <input ref={fileRef} type="file" accept="audio/*" hidden onChange={handleUpload} />
        <Button
          size="small"
          startIcon={<UploadFile />}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "Upload a sound from this device"}
        </Button>
        <Typography variant="caption" color="text.secondary" display="block">
          Any audio file on your phone works (up to 5MB). Tap an option to hear it.
        </Typography>
        {uploadError && (
          <Typography variant="caption" color="error" display="block">
            {uploadError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
