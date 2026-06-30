import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowBackIosNew, Close, Delete, Search, Star, StarBorder } from "@mui/icons-material";
import { renderTechniqueDisplay } from "../../utils/techniqueRegistry";
import { getFavorites, toggleFavorite, getRecents, pushRecent } from "../../utils/techniquePrefs";

const APPLIES = { WHOLE: "whole", LAST: "last" };

// One auto-generated form control, chosen from the param's declared type. Adding a new technique to
// the registry needs no UI changes — the form is derived entirely from its param schema.
function ParamField({ param, value, onChange }) {
  const v = value ?? param.default ?? (param.type === "bool" ? false : "");
  switch (param.type) {
    case "bool":
      return (
        <FormControlLabel
          control={<Switch checked={Boolean(v)} onChange={(e) => onChange(e.target.checked)} />}
          label={param.label}
        />
      );
    case "enum":
      return (
        <TextField select fullWidth size="small" label={param.label} value={v} onChange={(e) => onChange(e.target.value)}>
          {(param.options || []).map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      );
    case "tempo":
      return (
        <TextField
          fullWidth
          size="small"
          label={param.label}
          value={v}
          placeholder="3-1-X-0"
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "int":
    case "number":
    case "duration":
      return (
        <TextField
          fullWidth
          size="small"
          type="number"
          label={`${param.label}${param.unit ? ` (${param.unit})` : ""}`}
          value={v}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          inputProps={{ min: param.min, max: param.max }}
        />
      );
    default:
      return (
        <TextField fullWidth size="small" label={param.label} value={v} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

export default function TechniqueDrawer({
  open,
  onClose,
  registry,
  techniques = [],
  onChange,
  exerciseSets = 0,
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(null); // { def, params, applies, notes } while configuring
  const [favorites, setFavorites] = useState(getFavorites());
  const recents = getRecents();

  const categories = registry.categories || [];
  const all = registry.techniques || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (t) => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    );
  }, [all, search]);

  const startConfig = (def) => {
    const params = {};
    (def.params || []).forEach((p) => {
      if (p.default !== undefined) params[p.name] = p.default;
    });
    setDraft({ def, params, applies: APPLIES.WHOLE, notes: "" });
  };

  const handleToggleFavorite = (key) => setFavorites(toggleFavorite(key));

  const setParam = (name, val) => setDraft((d) => ({ ...d, params: { ...d.params, [name]: val } }));

  const addTechnique = () => {
    const { def, params, applies, notes } = draft;
    const appliesToSets =
      def.scope === "set" && applies === APPLIES.LAST && exerciseSets > 0 ? [exerciseSets - 1] : [];
    onChange([
      ...(techniques || []),
      { key: def.key, scope: def.scope, appliesToSets, params, notes: notes || "" },
    ]);
    pushRecent(def.key);
    setDraft(null);
    setSearch("");
  };

  const quickPick = (title, keys) => {
    const defs = keys.map((k) => registry.byKey?.[k]).filter(Boolean);
    if (defs.length === 0) return null;
    return (
      <Box>
        <Typography variant="overline" color="text.secondary">
          {title}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {defs.map((d) => (
            <Chip key={d.key} label={d.name} variant="outlined" clickable onClick={() => startConfig(d)} />
          ))}
        </Stack>
      </Box>
    );
  };

  const removeTechnique = (index) => onChange(techniques.filter((_, i) => i !== index));

  const handleClose = () => {
    setDraft(null);
    setSearch("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {draft ? (
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton size="small" onClick={() => setDraft(null)}>
                <ArrowBackIosNew fontSize="small" />
              </IconButton>
              <span>{draft.def.name}</span>
            </Stack>
          ) : (
            <span>Add Technique</span>
          )}
          <IconButton size="small" onClick={handleClose}>
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {draft ? (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {draft.def.description}
              </Typography>
              <Tooltip title={favorites.includes(draft.def.key) ? "Unfavorite" : "Favorite"}>
                <IconButton size="small" onClick={() => handleToggleFavorite(draft.def.key)}>
                  {favorites.includes(draft.def.key) ? (
                    <Star fontSize="small" color="warning" />
                  ) : (
                    <StarBorder fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>
            {(draft.def.params || []).map((p) => (
              <ParamField key={p.name} param={p} value={draft.params[p.name]} onChange={(v) => setParam(p.name, v)} />
            ))}
            {draft.def.scope === "set" && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  Applies to
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={draft.applies}
                  onChange={(e, val) => val && setDraft((d) => ({ ...d, applies: val }))}
                >
                  <ToggleButton value={APPLIES.WHOLE}>All sets</ToggleButton>
                  <ToggleButton value={APPLIES.LAST}>Last set</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              label="Coach notes (optional)"
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Preview
              </Typography>
              <Chip
                color="primary"
                variant="outlined"
                label={renderTechniqueDisplay(registry, draft.def.key, draft.params) || draft.def.name}
              />
            </Box>
            <Button variant="contained" onClick={addTechnique}>
              Add to exercise
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {techniques.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  On this exercise
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {techniques.map((t, i) => (
                    <Chip
                      key={t._id || `${t.key}-${i}`}
                      color="primary"
                      label={renderTechniqueDisplay(registry, t.key, t.params) || t.key}
                      onDelete={() => removeTechnique(i)}
                      deleteIcon={<Delete fontSize="small" />}
                    />
                  ))}
                </Stack>
                <Divider sx={{ mt: 1.5 }} />
              </Box>
            )}
            <TextField
              fullWidth
              size="small"
              autoFocus
              placeholder="Search techniques…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            {!search && quickPick("Favorites", favorites)}
            {!search && quickPick("Recently used", recents)}
            {categories.map((cat) => {
              const items = filtered.filter((t) => t.category === cat.key);
              if (items.length === 0) return null;
              return (
                <Box key={cat.key}>
                  <Typography variant="overline" color="text.secondary">
                    {cat.label}
                  </Typography>
                  <List dense disablePadding>
                    {items.map((t) => (
                      <ListItemButton key={t.key} onClick={() => startConfig(t)}>
                        <ListItemText
                          primary={t.name}
                          secondary={t.description}
                          secondaryTypographyProps={{ noWrap: true }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Box>
              );
            })}
            {filtered.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No techniques found.
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
