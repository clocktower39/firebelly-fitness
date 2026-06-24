import { useCallback, useEffect, useMemo, useState } from "react";
import { scheduleApi } from "../api/scheduleApi";

const defaultSessionTypeForm = {
  name: "",
  description: "",
  durationMinutes: "",
  creditsRequired: "",
  defaultPrice: "",
  currency: "USD",
  defaultPayout: "",
  payoutCurrency: "USD",
  active: true,
  isDefault: false,
  hasHistory: false,
};

const emptyRepriceForm = {
  defaultPrice: "",
  defaultPayout: "",
  currency: "USD",
  payoutCurrency: "USD",
};

export default function useSessionTypes({ isTrainer }) {
  const [sessionTypes, setSessionTypes] = useState([]);
  const [sessionTypesStatus, setSessionTypesStatus] = useState("");
  const [openSessionTypesDialog, setOpenSessionTypesDialog] = useState(false);
  const [openSessionTypeFormDialog, setOpenSessionTypeFormDialog] = useState(false);
  const [sessionTypeForm, setSessionTypeForm] = useState(defaultSessionTypeForm);
  const [editingSessionTypeId, setEditingSessionTypeId] = useState("");
  const [repriceTarget, setRepriceTarget] = useState(null);
  const [repriceForm, setRepriceForm] = useState(emptyRepriceForm);

  const loadSessionTypes = useCallback(async () => {
    if (!isTrainer) return;
    try {
      setSessionTypesStatus("");
      const data = await scheduleApi.getSessionTypes();
      if (data?.error) {
        throw new Error(data.error);
      }
      setSessionTypes(data.sessionTypes || []);
    } catch (err) {
      setSessionTypesStatus(err.message || "Unable to load session types.");
    }
  }, [isTrainer]);

  useEffect(() => {
    if (!isTrainer) return;
    loadSessionTypes();
  }, [isTrainer, loadSessionTypes]);

  const sessionTypeLookup = useMemo(() => {
    const map = new Map();
    sessionTypes.forEach((type) => {
      map.set(type._id, type);
    });
    return map;
  }, [sessionTypes]);

  const resetSessionTypeForm = useCallback(() => {
    setSessionTypeForm(defaultSessionTypeForm);
    setEditingSessionTypeId("");
    setOpenSessionTypeFormDialog(false);
  }, []);

  const handleSaveSessionType = async () => {
    if (!sessionTypeForm.name.trim()) return;
    const payload = {
      name: sessionTypeForm.name.trim(),
      description: sessionTypeForm.description.trim(),
      durationMinutes:
        sessionTypeForm.durationMinutes === "" ? 60 : Number(sessionTypeForm.durationMinutes),
      creditsRequired:
        sessionTypeForm.creditsRequired === "" ? 1 : Number(sessionTypeForm.creditsRequired),
      defaultPrice: sessionTypeForm.defaultPrice === "" ? 0 : Number(sessionTypeForm.defaultPrice),
      currency: sessionTypeForm.currency || "USD",
      defaultPayout:
        sessionTypeForm.defaultPayout === "" ? 0 : Number(sessionTypeForm.defaultPayout),
      payoutCurrency: sessionTypeForm.payoutCurrency || "USD",
      active: sessionTypeForm.active,
    };
    try {
      if (editingSessionTypeId) {
        const data = await scheduleApi.updateSessionType(editingSessionTypeId, payload);
        if (data?.error) throw new Error(data.error);
      } else {
        const data = await scheduleApi.createSessionType(payload);
        if (data?.error) throw new Error(data.error);
      }
      setSessionTypesStatus("");
      resetSessionTypeForm();
      loadSessionTypes();
    } catch (err) {
      setSessionTypesStatus(err.message || "Unable to save session type.");
    }
  };

  const handleEditSessionType = (type) => {
    setEditingSessionTypeId(type._id);
    setSessionTypeForm({
      name: type.name || "",
      description: type.description || "",
      durationMinutes:
        type.durationMinutes === 0 || type.durationMinutes ? String(type.durationMinutes) : "",
      creditsRequired:
        type.creditsRequired === 0 || type.creditsRequired
          ? String(type.creditsRequired)
          : "",
      defaultPrice:
        type.defaultPrice === 0 || type.defaultPrice ? String(type.defaultPrice) : "",
      currency: type.currency || "USD",
      defaultPayout:
        type.defaultPayout === 0 || type.defaultPayout ? String(type.defaultPayout) : "",
      payoutCurrency: type.payoutCurrency || "USD",
      active: type.active !== false,
      isDefault: type.isDefault === true,
      hasHistory: type.hasHistory === true,
    });
    setOpenSessionTypeFormDialog(true);
  };

  const handleDeleteSessionType = async (typeId) => {
    try {
      const data = await scheduleApi.deleteSessionType(typeId);
      if (data?.error) throw new Error(data.error);
      if (editingSessionTypeId === typeId) {
        resetSessionTypeForm();
      }
      setSessionTypesStatus("");
      loadSessionTypes();
    } catch (err) {
      setSessionTypesStatus(err.message || "Unable to delete session type.");
    }
  };

  const handleArchiveSessionType = async (typeId) => {
    try {
      const data = await scheduleApi.archiveSessionType(typeId);
      if (data?.error) throw new Error(data.error);
      setSessionTypesStatus("");
      loadSessionTypes();
    } catch (err) {
      setSessionTypesStatus(err.message || "Unable to archive session type.");
    }
  };

  const handleUnarchiveSessionType = async (typeId) => {
    try {
      const data = await scheduleApi.unarchiveSessionType(typeId);
      if (data?.error) throw new Error(data.error);
      setSessionTypesStatus("");
      loadSessionTypes();
    } catch (err) {
      setSessionTypesStatus(err.message || "Unable to reactivate session type.");
    }
  };

  // Reprice = archive current + clone at a new rate (keeps the same name).
  const openRepriceDialog = (type) => {
    setRepriceTarget(type);
    setRepriceForm({
      defaultPrice: type.defaultPrice ?? "",
      defaultPayout: type.defaultPayout ?? "",
      currency: type.currency || "USD",
      payoutCurrency: type.payoutCurrency || "USD",
    });
  };

  const closeRepriceDialog = () => {
    setRepriceTarget(null);
    setRepriceForm(emptyRepriceForm);
  };

  const handleReprice = async () => {
    if (!repriceTarget) return;
    try {
      const data = await scheduleApi.repriceSessionType(repriceTarget._id, {
        defaultPrice: repriceForm.defaultPrice === "" ? null : Number(repriceForm.defaultPrice),
        defaultPayout: repriceForm.defaultPayout === "" ? null : Number(repriceForm.defaultPayout),
        currency: repriceForm.currency || "USD",
        payoutCurrency: repriceForm.payoutCurrency || "USD",
      });
      if (data?.error) throw new Error(data.error);
      setSessionTypesStatus("");
      closeRepriceDialog();
      loadSessionTypes();
    } catch (err) {
      setSessionTypesStatus(err.message || "Unable to change price.");
    }
  };

  return {
    sessionTypes,
    sessionTypesStatus,
    setSessionTypesStatus,
    openSessionTypesDialog,
    setOpenSessionTypesDialog,
    openSessionTypeFormDialog,
    setOpenSessionTypeFormDialog,
    sessionTypeForm,
    setSessionTypeForm,
    editingSessionTypeId,
    sessionTypeLookup,
    resetSessionTypeForm,
    handleSaveSessionType,
    handleEditSessionType,
    handleDeleteSessionType,
    handleArchiveSessionType,
    handleUnarchiveSessionType,
    repriceTarget,
    repriceForm,
    setRepriceForm,
    openRepriceDialog,
    closeRepriceDialog,
    handleReprice,
  };
}
