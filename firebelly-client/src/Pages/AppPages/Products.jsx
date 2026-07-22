import React, { useEffect, useState } from "react";
import { billingApi } from "../../api/billingApi";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSelector } from "react-redux";
import { formatPrice } from "../../utils/currency";
import { sessionTypeLabel } from "../../utils/sessionTypeLabel";
import useSessionTypes from "../../features/schedule/hooks/useSessionTypes";
import SessionTypeDialogs, { SessionTypeList } from "../../features/schedule/components/SessionTypeDialogs";

const TYPE_LABEL = {
  SESSION: "Session",
  PROGRAM: "Program",
  NUTRITION: "Nutrition",
  MERCH: "Merch",
  CUSTOM: "Other",
};

const defaultForm = {
  itemType: "SESSION",
  name: "",
  description: "",
  price: "",
  currency: "USD",
  taxable: true,
  active: true,
  sessionTypeId: "",
  creditsPerUnit: "",
  deliverableType: "NONE",
  deliverableValue: "",
};

export default function Products() {
  const user = useSelector((state) => state.user);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Session types live here too now — same hook + dialogs as the scheduler, so the
  // Products page is the one full catalog (sessions AND packages/products).
  const st = useSessionTypes({ isTrainer: user.isTrainer });
  const { sessionTypes, sessionTypeLookup } = st;

  const loadProducts = async () => {
    try {
      const data = await billingApi.listProducts({ trainerId: user._id, activeOnly: false });
      if (data?.error) throw new Error(data.error);
      setProducts(data.products || []);
    } catch (err) {
      setStatus(err.message || "Unable to load products.");
    }
  };

  useEffect(() => {
    if (!user.isTrainer) return;
    loadProducts();
  }, [user.isTrainer]);

  if (!user.isTrainer) {
    return <Typography>You are not a trainer. This page is unavailable.</Typography>;
  }

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "itemType" && value !== "SESSION") {
        next.sessionTypeId = "";
        next.creditsPerUnit = "";
      }
      if (field === "sessionTypeId") {
        const type = sessionTypeLookup.get(value);
        if (type) {
          next.creditsPerUnit = String(type.creditsRequired || 1);
        }
      }
      return next;
    });
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId("");
  };

  const handleEdit = (product) => {
    setEditingId(product._id);
    setForm({
      itemType: product.itemType || "CUSTOM",
      name: product.name || "",
      description: product.description || "",
      price: product.price === 0 || product.price ? String(product.price) : "",
      currency: product.currency || "USD",
      taxable: product.taxable !== false,
      active: product.active !== false,
      sessionTypeId: product.sessionTypeId?._id || product.sessionTypeId || "",
      creditsPerUnit:
        product.creditsPerUnit === 0 || product.creditsPerUnit
          ? String(product.creditsPerUnit)
          : "",
      deliverableType: product.deliverableType || "NONE",
      deliverableValue: product.deliverableValue || "",
    });
    setStatus("");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setStatus("Name is required.");
      return;
    }
    if (form.itemType === "SESSION" && !form.sessionTypeId) {
      setStatus("Session type is required for session products.");
      return;
    }
    const payload = {
      itemType: form.itemType,
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price === "" ? 0 : Number(form.price),
      currency: form.currency,
      taxable: form.taxable,
      active: form.active,
      sessionTypeId: form.itemType === "SESSION" ? form.sessionTypeId : null,
      creditsPerUnit: form.itemType === "SESSION" ? Number(form.creditsPerUnit) || 0 : 0,
      deliverableType: form.deliverableType,
      deliverableValue: form.deliverableValue,
    };

    try {
      const data = editingId
        ? await billingApi.updateProduct(editingId, payload)
        : await billingApi.createProduct(payload);
      if (data?.error) throw new Error(data.error);
      setStatus("");
      resetForm();
      setFormOpen(false);
      loadProducts();
    } catch (err) {
      setStatus(err.message || "Unable to save product.");
    }
  };

  const handleDelete = async (productId) => {
    try {
      const data = await billingApi.deleteProduct(productId);
      if (data?.error) throw new Error(data.error);
      loadProducts();
    } catch (err) {
      setStatus(err.message || "Unable to delete product.");
    }
  };

  const startAdd = () => {
    resetForm();
    setStatus("");
    setFormOpen(true);
  };
  const closeForm = () => {
    resetForm();
    setStatus("");
    setFormOpen(false);
  };

  return (
    <Grid container spacing={2}>
      <Grid container size={12} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4">Products</Typography>
      </Grid>

      {/* The session catalog — the same types the scheduler books and packages sell. */}
      <Grid container size={12}>
        <Card variant="outlined" sx={{ width: "100%" }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="h6">Training sessions</Typography>
                <Typography variant="body2" color="text.secondary">
                  What clients book and buy credits for — bookings, packages, and invoices all
                  pull from this catalog.
                </Typography>
              </Box>
              <SessionTypeList
                sessionTypes={sessionTypes}
                sessionTypesStatus={st.sessionTypesStatus}
                formatPrice={formatPrice}
                handleEditSessionType={st.handleEditSessionType}
                handleDeleteSessionType={st.handleDeleteSessionType}
                handleArchiveSessionType={st.handleArchiveSessionType}
                handleUnarchiveSessionType={st.handleUnarchiveSessionType}
                openRepriceDialog={st.openRepriceDialog}
                resetSessionTypeForm={st.resetSessionTypeForm}
                setOpenSessionTypeFormDialog={st.setOpenSessionTypeFormDialog}
              />
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid container size={12} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">Packages &amp; other products</Typography>
        <Button variant="contained" onClick={startAdd}>
          Add product
        </Button>
      </Grid>

      <Dialog open={formOpen} onClose={closeForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Edit product" : "Add product"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    label="Type"
                    value={form.itemType}
                    onChange={(event) => handleChange("itemType", event.target.value)}
                  >
                    <MenuItem value="SESSION">Training Session</MenuItem>
                    <MenuItem value="PROGRAM">Program</MenuItem>
                    <MenuItem value="NUTRITION">Nutrition Plan</MenuItem>
                    <MenuItem value="MERCH">Merchandise</MenuItem>
                    <MenuItem value="CUSTOM">Other</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Name"
                  value={form.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  fullWidth
                />
              </Stack>
              <TextField
                label="Description"
                value={form.description}
                onChange={(event) => handleChange("description", event.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              {form.itemType === "SESSION" && (
                <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                  <FormControl fullWidth>
                    <InputLabel>Session Type</InputLabel>
                    <Select
                      label="Session Type"
                      value={form.sessionTypeId}
                      onChange={(event) =>
                        handleChange("sessionTypeId", event.target.value)
                      }
                    >
                      <MenuItem value="">Select session type</MenuItem>
                      {sessionTypes
                        .filter((type) => !type.archivedAt)
                        .map((type) => (
                          <MenuItem key={type._id} value={type._id}>
                            {sessionTypeLabel(type)}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Credits per unit"
                    type="number"
                    value={form.creditsPerUnit}
                    onChange={(event) =>
                      handleChange("creditsPerUnit", event.target.value)
                    }
                    slotProps={{ htmlInput: { min: 0, step: "0.5" } }}
                    fullWidth
                  />
                </Stack>
              )}
              {form.itemType === "SESSION" && sessionTypes.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  No session types yet — add one in the Training sessions section above.
                </Typography>
              )}
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <TextField
                  label="Price"
                  type="number"
                  value={form.price}
                  onChange={(event) => handleChange("price", event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    label="Currency"
                    value={form.currency}
                    onChange={(event) => handleChange("currency", event.target.value)}
                  >
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="JPY">JPY</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                <FormControl fullWidth>
                  <InputLabel>Deliverable</InputLabel>
                  <Select
                    label="Deliverable"
                    value={form.deliverableType}
                    onChange={(event) =>
                      handleChange("deliverableType", event.target.value)
                    }
                  >
                    <MenuItem value="NONE">None</MenuItem>
                    <MenuItem value="FILE">File</MenuItem>
                    <MenuItem value="LINK">Link</MenuItem>
                    <MenuItem value="MESSAGE">Message</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Deliverable Value"
                  value={form.deliverableValue}
                  onChange={(event) => handleChange("deliverableValue", event.target.value)}
                  fullWidth
                />
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.taxable}
                      onChange={(event) => handleChange("taxable", event.target.checked)}
                    />
                  }
                  label={form.taxable ? "Taxable" : "Not taxable"}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.active}
                      onChange={(event) => handleChange("active", event.target.checked)}
                    />
                  }
                  label={form.active ? "Active" : "Inactive"}
                />
              </Stack>
              {status && (
                <Typography variant="caption" color="error">
                  {status}
                </Typography>
              )}
            </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeForm}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingId ? "Save changes" : "Add product"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete product?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Permanently delete <strong>{deleteTarget?.name}</strong>? This can&apos;t be undone.
            (It won&apos;t affect invoices already created from it.)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleteTarget) handleDelete(deleteTarget._id);
              setDeleteTarget(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container size={12}>
        {products.length === 0 ? (
          <Card sx={{ width: "100%" }}>
            <CardContent>
              <Stack spacing={1} sx={{ alignItems: "center", py: 4 }}>
                <Typography color="text.secondary">No products yet.</Typography>
                <Button variant="outlined" size="small" onClick={startAdd}>
                  Add your first product
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={1.5} sx={{ width: "100%" }}>
            {products.map((product) => (
              <Card key={product._id} variant="outlined">
                <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
                  >
                    <Stack spacing={0.5}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {product.name}
                        </Typography>
                        <Chip size="small" label={TYPE_LABEL[product.itemType] || product.itemType} />
                        {!product.active && (
                          <Chip size="small" variant="outlined" label="Inactive" />
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {formatPrice(product.price, product.currency)}
                        {product.itemType === "SESSION"
                          ? ` · ${product.creditsPerUnit || 0} credits${
                              product.sessionTypeId?.name
                                ? ` · ${sessionTypeLabel(product.sessionTypeId)}`
                                : ""
                            }`
                          : ""}
                      </Typography>
                      {product.description && (
                        <Typography variant="body2" color="text.secondary">
                          {product.description}
                        </Typography>
                      )}
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="outlined" onClick={() => handleEdit(product)}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="text"
                        onClick={() => setDeleteTarget(product)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Grid>

      {/* Form / reprice / confirm dialogs shared with the scheduler; the list dialog is
          unused here because the list renders inline above. */}
      <SessionTypeDialogs
        openSessionTypesDialog={false}
        setOpenSessionTypesDialog={() => {}}
        sessionTypesStatus={st.sessionTypesStatus}
        sessionTypes={sessionTypes}
        formatPrice={formatPrice}
        handleEditSessionType={st.handleEditSessionType}
        handleDeleteSessionType={st.handleDeleteSessionType}
        handleArchiveSessionType={st.handleArchiveSessionType}
        handleUnarchiveSessionType={st.handleUnarchiveSessionType}
        repriceTarget={st.repriceTarget}
        repriceForm={st.repriceForm}
        setRepriceForm={st.setRepriceForm}
        openRepriceDialog={st.openRepriceDialog}
        closeRepriceDialog={st.closeRepriceDialog}
        handleReprice={st.handleReprice}
        resetSessionTypeForm={st.resetSessionTypeForm}
        setOpenSessionTypeFormDialog={st.setOpenSessionTypeFormDialog}
        openSessionTypeFormDialog={st.openSessionTypeFormDialog}
        editingSessionTypeId={st.editingSessionTypeId}
        sessionTypeForm={st.sessionTypeForm}
        setSessionTypeForm={st.setSessionTypeForm}
        handleSaveSessionType={st.handleSaveSessionType}
      />
    </Grid>
  );
}
