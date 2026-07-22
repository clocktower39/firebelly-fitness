import React, { useEffect, useMemo, useRef, useState } from "react";
import { billingApi } from "../../api/billingApi";
import { groupApi } from "../../api/groupApi";
import { scheduleApi } from "../../api/scheduleApi";
import { useSearchParams, Link as RouterLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
  Chip,
  Select,
  Menu,
  MenuItem,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import CloseIcon from "@mui/icons-material/Close";
import InvoiceReportsDialog from "../../Components/InvoiceReportsDialog";
import LogSessionsDialog from "../../Components/LogSessionsDialog";
import { alpha } from "@mui/material/styles";
import dayjs from "dayjs";
import { requestClients } from "../../Redux/actions";
import { formatPrice } from "../../utils/currency";
import { sessionTypeLabel } from "../../utils/sessionTypeLabel";

const STATUS_CHIP = {
  DRAFT: { label: "Draft", color: "default" },
  SENT: { label: "Sent", color: "info" },
  PARTIAL: { label: "Partial", color: "info" },
  PAID: { label: "Paid", color: "success" },
  PAST_DUE: { label: "Past due", color: "warning" },
  VOID: { label: "Void", color: "error" },
};

const PAYMENT_METHODS = ["Cash", "Card", "Check", "Venmo", "Zelle", "Bank transfer", "Other"];

const defaultLineItem = () => ({
  itemType: "SESSION",
  sessionTypeId: "",
  description: "",
  quantity: 1,
  unitPrice: "",
  sessionCredits: "",
});

export default function Invoices() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const clients = useSelector((state) => state.clients);
  const [searchParams] = useSearchParams();

  const [billToType, setBillToType] = useState("CLIENT");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groups, setGroups] = useState([]);
  const [billingSummary, setBillingSummary] = useState(null);
  const [invoiceList, setInvoiceList] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [billToEmail, setBillToEmail] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [currency, setCurrency] = useState("USD");
  const [dueAt, setDueAt] = useState("");
  const [tax, setTax] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lineItems, setLineItems] = useState([defaultLineItem()]);
  const [sessionTypes, setSessionTypes] = useState([]);
  const [sessionTypesStatus, setSessionTypesStatus] = useState("");

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailInvoice, setEmailInvoice] = useState(null);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidInvoice, setVoidInvoice] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("ALL");
  const [clientFilter, setClientFilter] = useState("");
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuInvoice, setRowMenuInvoice] = useState(null);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payDate, setPayDate] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [refundMode, setRefundMode] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [reportsOpen, setReportsOpen] = useState(false);
  const [logSessionsOpen, setLogSessionsOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (user.isTrainer) {
      dispatch(requestClients());
    }
  }, [dispatch, user.isTrainer]);

  useEffect(() => {
    if (!user.isTrainer) return;
    const fetchSessionTypes = async () => {
      try {
        const data = await scheduleApi.getSessionTypes();
        if (data.error) {
          setSessionTypesStatus(data.error);
          return;
        }
        setSessionTypes(data.sessionTypes || []);
        setSessionTypesStatus("");
      } catch (err) {
        setSessionTypesStatus(err.message || "Unable to load session types.");
      }
    };
    fetchSessionTypes();
  }, [user.isTrainer]);

  useEffect(() => {
    if (!user.isTrainer) return;
    const clientParam = searchParams.get("client");
    const groupParam = searchParams.get("group");
    if (clientParam) {
      setClientFilter(clientParam);
      setBillToType("CLIENT");
      setSelectedGroupId("");
      setSelectedClientId(clientParam);
      return;
    }
    if (groupParam) {
      setBillToType("GROUP");
      setSelectedClientId("");
      setSelectedGroupId(groupParam);
    }
  }, [searchParams, user.isTrainer]);

  useEffect(() => {
    if (!user.isTrainer) return;
    const fetchGroups = async () => {
      try {
        const data = await groupApi.listGroups();
        if (data.error) {
          setError(data.error);
          return;
        }
        setGroups(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Unable to load groups.");
      }
    };
    fetchGroups();
  }, [user.isTrainer]);

  const targetId = billToType === "CLIENT" ? selectedClientId : selectedGroupId;

  // Per-client credit summary — only shown when the list is filtered to one client.
  const refreshSummary = async (clientId) => {
    if (!clientId) {
      setBillingSummary(null);
      return;
    }
    setLoadingSummary(true);
    try {
      const data = await billingApi.getSummary({ trainerId: user._id, clientId });
      setBillingSummary(data && !data.error ? data : null);
    } catch (err) {
      setBillingSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Load ALL of the trainer's invoices (across every client) so requests and
  // outstanding balances are visible at a glance — no need to pick a client first.
  const refreshInvoices = async () => {
    if (!user.isTrainer) return;
    setLoadingInvoices(true);
    setError("");
    try {
      const data = await billingApi.listInvoices({ trainerId: user._id });
      if (data.error) {
        setError(data.error);
        return;
      }
      setInvoiceList(data.invoices || []);
    } catch (err) {
      setError(err.message || "Unable to load invoices.");
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    if (user.isTrainer) refreshInvoices();
  }, [user.isTrainer]);

  useEffect(() => {
    refreshSummary(clientFilter);
  }, [clientFilter]);

  // Deep link: /invoices?invoice=<id> opens that invoice's detail once it's loaded
  // (e.g. clicked from a session in Session History). Opens once so closing won't reopen.
  // Inlined (not openDetail) so this hook stays above the component's trainer-only return.
  const handledInvoiceParam = useRef(null);
  useEffect(() => {
    const invoiceParam = searchParams.get("invoice");
    if (!invoiceParam || !invoiceList.length) return;
    if (handledInvoiceParam.current === invoiceParam) return;
    const found = invoiceList.find((i) => String(i._id) === String(invoiceParam));
    if (!found) return;
    handledInvoiceParam.current = invoiceParam;
    setDetailInvoice(found);
    setRefundMode(false);
    setRefundReason("");
    setPayMethod("Cash");
    setPayDate(dayjs().format("YYYY-MM-DD"));
    setPayReference("");
    setPayAmount(Number(found.balanceDue || 0) > 0 ? String(found.balanceDue) : "");
  }, [searchParams, invoiceList]);

  const selectedClient = clients.find((clientRel) => clientRel.client?._id === selectedClientId);
  const selectedGroup = groups.find((entry) => entry.group?._id === selectedGroupId);

  const totals = useMemo(() => {
    const items = lineItems.map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.unitPrice) || 0;
      const sessionCredits =
        item.itemType === "SESSION" ? Number(item.sessionCredits) || 0 : 0;
      return {
        lineTotal: unitPrice * quantity,
        sessionCreditsTotal: sessionCredits * quantity,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const sessionCreditsTotal = items.reduce((sum, item) => sum + item.sessionCreditsTotal, 0);
    const taxValue = Number(tax) || 0;
    const discountValue = Number(discount) || 0;
    return {
      subtotal,
      sessionCreditsTotal,
      taxValue,
      discountValue,
      total: subtotal + taxValue - discountValue,
    };
  }, [lineItems, tax, discount]);

  const sessionTypeLookup = useMemo(() => {
    const map = new Map();
    sessionTypes.forEach((type) => map.set(type._id, type));
    return map;
  }, [sessionTypes]);

  if (!user.isTrainer) {
    return <Typography>You are not a trainer. This page is unavailable.</Typography>;
  }


  const handleLineItemChange = (index, field, value) => {
    setLineItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, [field]: value };
        if (field === "itemType" && value !== "SESSION") {
          next.sessionCredits = "";
          next.sessionTypeId = "";
        }
        if (field === "sessionTypeId") {
          const sessionType = sessionTypeLookup.get(value);
          if (sessionType) {
            next.sessionCredits = String(sessionType.creditsRequired || 1);
          }
        }
        return next;
      })
    );
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [...prev, defaultLineItem()]);
  };

  const handleRemoveLineItem = (index) => {
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setInvoiceNumber("");
    setBillToEmail("");
    setStatus("DRAFT");
    setCurrency("USD");
    setDueAt("");
    setTax("");
    setDiscount("");
    setNotes("");
    setTerms("");
    setLineItems([defaultLineItem()]);
  };

  const handleCreateInvoice = async () => {
    if (!targetId) return;
    const normalizedLineItems = lineItems
      .map((item) => ({
        description: String(item.description || "").trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Number(item.unitPrice) || 0,
        sessionCredits: item.itemType === "SESSION" ? Number(item.sessionCredits) || 0 : 0,
        itemType: item.itemType || "CUSTOM",
        sessionTypeId: item.itemType === "SESSION" ? item.sessionTypeId || null : null,
      }))
      .filter((item) => item.description);

    if (normalizedLineItems.length === 0) {
      setError("Add at least one line item with a description.");
      return;
    }

    const missingSessionType = normalizedLineItems.find(
      (item) => item.itemType === "SESSION" && !item.sessionTypeId
    );
    if (missingSessionType) {
      setError("Select a session type for all session line items.");
      return;
    }

    try {
      const payload = {
        billToType,
        clientId: billToType === "CLIENT" ? targetId : null,
        groupId: billToType === "GROUP" ? targetId : null,
        billToEmail: billToType === "GROUP" ? billToEmail.trim() : null,
        invoiceNumber: invoiceNumber.trim() || null,
        status,
        currency,
        dueAt: dueAt || null,
        tax: Number(tax) || 0,
        discount: Number(discount) || 0,
        notes: notes.trim(),
        terms: terms.trim(),
        lineItems: normalizedLineItems,
      };
      const data = await billingApi.createInvoice(payload);
      if (data.error) {
        setError(data.error);
        return;
      }
      resetForm();
      setCreateOpen(false);
      refreshInvoices();
      refreshSummary(clientFilter);
    } catch (err) {
      setError(err.message || "Unable to create invoice.");
    }
  };

  const handleStatusUpdate = async (invoiceId, nextStatus) => {
    try {
      const data = await billingApi.updateInvoiceStatus({ invoiceId, status: nextStatus });
      if (data.error) {
        setError(data.error);
        return;
      }
      refreshInvoices();
      refreshSummary(clientFilter);
    } catch (err) {
      setError(err.message || "Unable to update invoice.");
    }
  };

  const openRowMenu = (event, invoice) => {
    setRowMenuAnchor(event.currentTarget);
    setRowMenuInvoice(invoice);
  };
  const closeRowMenu = () => {
    setRowMenuAnchor(null);
    setRowMenuInvoice(null);
  };

  const handleSendReminder = async (invoice) => {
    if (!invoice) return;
    setError("");
    setNotice("");
    try {
      const data = await billingApi.sendReminder({ invoiceId: invoice._id });
      if (data?.error) {
        setError(data.error);
        return;
      }
      setNotice(`Reminder sent${data.recipient ? ` to ${data.recipient}` : ""}.`);
    } catch (err) {
      setError(err.message || "Unable to send reminder.");
    }
  };
  const startCreate = () => {
    resetForm();
    setError("");
    setCreateOpen(true);
  };

  // Open the detail dialog and prime the payment form (amount defaults to the balance).
  const openDetail = (invoice) => {
    setDetailInvoice(invoice);
    setRefundMode(false);
    setRefundReason("");
    setPayMethod("Cash");
    setPayDate(dayjs().format("YYYY-MM-DD"));
    setPayReference("");
    setPayAmount(Number(invoice.balanceDue || 0) > 0 ? String(invoice.balanceDue) : "");
  };

  const afterPaymentChange = (invoice) => {
    setDetailInvoice(invoice);
    setRefundMode(false);
    setRefundReason("");
    setPayReference("");
    setPayAmount(Number(invoice.balanceDue || 0) > 0 ? String(invoice.balanceDue) : "");
    refreshInvoices();
    refreshSummary(clientFilter);
  };

  const submitPayment = async () => {
    if (!detailInvoice) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setPayBusy(true);
    setError("");
    try {
      const data = refundMode
        ? await billingApi.recordRefund({
            invoiceId: detailInvoice._id,
            amount,
            reason: refundReason,
          })
        : await billingApi.recordPayment({
            invoiceId: detailInvoice._id,
            amount,
            method: payMethod,
            paidAt: payDate || undefined,
            reference: payReference,
          });
      if (data.error) {
        setError(data.error);
        return;
      }
      afterPaymentChange(data.invoice);
    } catch (err) {
      setError(err.message || "Unable to record payment.");
    } finally {
      setPayBusy(false);
    }
  };

  const removePaymentEntry = async (paymentId) => {
    if (!detailInvoice) return;
    setError("");
    try {
      const data = await billingApi.removePayment({ invoiceId: detailInvoice._id, paymentId });
      if (data.error) {
        setError(data.error);
        return;
      }
      afterPaymentChange(data.invoice);
    } catch (err) {
      setError(err.message || "Unable to remove payment.");
    }
  };

  // A client-initiated purchase request the trainer still needs to act on:
  // request_invoice creates it as SENT with createdBy === the client (clientId).
  const isRequest = (inv) =>
    inv.status === "SENT" && inv.clientId && String(inv.createdBy) === String(inv.clientId);

  const requestCount = invoiceList.filter(isRequest).length;

  const filteredClient = clients.find((c) => c.client?._id === clientFilter)?.client;

  // At-a-glance totals computed from the already-loaded invoices (no extra fetch).
  const dashboard = (() => {
    const now = dayjs();
    let outstanding = 0;
    let overdue = 0;
    let collectedYTD = 0;
    invoiceList.forEach((inv) => {
      if (inv.status === "VOID") return;
      const bal = Number(inv.balanceDue || 0);
      if (inv.status !== "DRAFT") {
        outstanding += bal;
        if (bal > 0 && inv.dueAt && dayjs(inv.dueAt).isBefore(now)) overdue += bal;
      }
      (inv.payments || []).forEach((p) => {
        if (p.paidAt && dayjs(p.paidAt).year() === now.year()) {
          collectedYTD += p.type === "REFUND" ? -Number(p.amount || 0) : Number(p.amount || 0);
        }
      });
    });
    return { outstanding, overdue, collectedYTD };
  })();

  const filteredInvoices = invoiceList.filter((inv) => {
    if (clientFilter && String(inv.clientId) !== String(clientFilter)) return false;
    if (historyFilter === "ALL") return true;
    if (historyFilter === "REQUESTS") return isRequest(inv);
    return inv.status === historyFilter;
  });

  const handleDownloadPdf = async (invoice) => {
    try {
      const response = await billingApi.downloadInvoicePdf({ invoiceId: invoice._id });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Unable to download PDF.");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoice.invoiceNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Unable to download PDF.");
    }
  };

  const openEmailDialog = (invoice) => {
    setEmailInvoice(invoice);
    setEmailRecipient(invoice.billToEmail || "");
    setEmailMessage("");
    setEmailDialogOpen(true);
  };

  const openVoidDialog = (invoice) => {
    setVoidInvoice(invoice);
    setVoidDialogOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!voidInvoice) return;
    await handleStatusUpdate(voidInvoice._id, "VOID");
    setVoidDialogOpen(false);
    setVoidInvoice(null);
  };

  const handleSendEmail = async () => {
    if (!emailInvoice) return;
    if (!emailRecipient.trim()) {
      setError("Recipient email is required.");
      return;
    }
    setSendingEmail(true);
    try {
      const data = await billingApi.sendInvoiceEmail({
        invoiceId: emailInvoice._id,
        recipientEmail: emailRecipient.trim(),
        message: emailMessage.trim(),
      });
      if (data.error) {
        setError(data.error);
        return;
      }
      setEmailDialogOpen(false);
    } catch (err) {
      setError(err.message || "Unable to send invoice email.");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Grid container spacing={2}>
      <Grid container size={12} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4">Invoices</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setReportsOpen(true)}>
            Reports
          </Button>
          <Button
            variant="outlined"
            onClick={() => setLogSessionsOpen(true)}
            disabled={!filteredClient}
            title={filteredClient ? "" : "Filter by a client first to log their sessions"}
          >
            Log sessions
          </Button>
          <Button
            variant="outlined"
            component={RouterLink}
            to={filteredClient ? `/import-sessions?client=${filteredClient._id}` : "/import-sessions"}
          >
            Import sessions
          </Button>
          <Button variant="contained" onClick={startCreate}>
            New invoice
          </Button>
        </Stack>
      </Grid>

      {requestCount > 0 && historyFilter !== "REQUESTS" && (
        <Grid container size={12}>
          <Alert
            severity="warning"
            sx={{ width: "100%" }}
            action={
              <Button color="inherit" size="small" onClick={() => setHistoryFilter("REQUESTS")}>
                Review
              </Button>
            }
          >
            {requestCount} session-purchase {requestCount === 1 ? "request" : "requests"} awaiting
            your approval.
          </Alert>
        </Grid>
      )}

      {invoiceList.length > 0 && (
        <Grid container size={12} spacing={1}>
          {[
            { label: `Collected (${dayjs().year()})`, value: dashboard.collectedYTD, color: "success.main" },
            { label: "Outstanding", value: dashboard.outstanding, color: "text.primary" },
            { label: "Overdue", value: dashboard.overdue, color: dashboard.overdue > 0 ? "warning.main" : "text.primary" },
          ].map((stat) => (
            <Grid key={stat.label} size={{ xs: 4 }}>
              <Card sx={{ width: "100%" }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {stat.label}
                  </Typography>
                  <Typography variant="h6" color={stat.color}>
                    {formatPrice(stat.value, "USD")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Grid container size={12}>
        <Card sx={{ width: "100%" }}>
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ alignItems: { sm: "center" } }}
            >
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Show</InputLabel>
                <Select
                  label="Show"
                  value={historyFilter}
                  onChange={(event) => setHistoryFilter(event.target.value)}
                >
                  <MenuItem value="ALL">All invoices</MenuItem>
                  <MenuItem value="REQUESTS">
                    Requests{requestCount > 0 ? ` (${requestCount})` : ""}
                  </MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="SENT">Sent</MenuItem>
                  <MenuItem value="PAID">Paid</MenuItem>
                  <MenuItem value="PAST_DUE">Past due</MenuItem>
                  <MenuItem value="VOID">Void</MenuItem>
                </Select>
              </FormControl>
              <Autocomplete
                size="small"
                sx={{ minWidth: 220, flexGrow: 1 }}
                options={clients.filter((clientRel) => clientRel.accepted)}
                getOptionLabel={(o) =>
                  `${o.client?.firstName || ""} ${o.client?.lastName || ""}`.trim()
                }
                isOptionEqualToValue={(o, v) => o.client?._id === v.client?._id}
                value={clients.find((c) => c.client?._id === clientFilter) || null}
                onChange={(_, v) => setClientFilter(v ? v.client._id : "")}
                renderInput={(params) => (
                  <TextField {...params} label="Filter by client" placeholder="All clients" />
                )}
              />
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      {clientFilter && (
        <Grid container size={12}>
          <Card sx={{ width: "100%" }}>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="h6">
                  {filteredClient
                    ? `${filteredClient.firstName || ""} ${filteredClient.lastName || ""}`.trim()
                    : "Client"}
                </Typography>
                {loadingSummary ? (
                  <Typography color="text.secondary">Loading summary...</Typography>
                ) : billingSummary ? (
                  <>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip label={`Credits: ${billingSummary.credits}`} color="primary" />
                      <Chip label={`Debits: ${billingSummary.debits}`} />
                      <Chip
                        label={`Remaining: ${billingSummary.remainingSessions}`}
                        color={billingSummary.remainingSessions <= 0 ? "warning" : "success"}
                      />
                      {billingSummary.dueForPayment && (
                        <Chip label="Due for payment" color="warning" />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Updated{" "}
                      {billingSummary.lastEntryAt
                        ? dayjs(billingSummary.lastEntryAt).format("MMM D, h:mm A")
                        : dayjs().format("MMM D, h:mm A")}
                    </Typography>
                  </>
                ) : (
                  <Typography color="text.secondary">No billing summary yet.</Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New invoice</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <FormControl fullWidth>
                    <InputLabel>Bill to</InputLabel>
                    <Select
                      label="Bill to"
                      value={billToType}
                      onChange={(event) => {
                        setBillToType(event.target.value);
                        setSelectedClientId("");
                        setSelectedGroupId("");
                        setBillToEmail("");
                      }}
                    >
                      <MenuItem value="CLIENT">Client</MenuItem>
                      <MenuItem value="GROUP">Group</MenuItem>
                    </Select>
                  </FormControl>
                  {billToType === "CLIENT" ? (
                    <FormControl fullWidth>
                      <InputLabel>Client</InputLabel>
                      <Select
                        label="Client"
                        value={selectedClientId}
                        onChange={(event) => setSelectedClientId(event.target.value)}
                      >
                        {clients
                          .filter((clientRel) => clientRel.accepted)
                          .map((clientRel) => (
                            <MenuItem key={clientRel.client._id} value={clientRel.client._id}>
                              {clientRel.client.firstName} {clientRel.client.lastName}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <FormControl fullWidth>
                      <InputLabel>Group</InputLabel>
                      <Select
                        label="Group"
                        value={selectedGroupId}
                        onChange={(event) => setSelectedGroupId(event.target.value)}
                      >
                        {groups.map((entry) => (
                          <MenuItem key={entry.group?._id} value={entry.group?._id}>
                            {entry.group?.name || "Group"}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Invoice # (optional)"
                    value={invoiceNumber}
                    onChange={(event) => setInvoiceNumber(event.target.value)}
                    fullWidth
                  />
                  {billToType === "GROUP" && (
                    <TextField
                      label="Bill To Email (optional)"
                      value={billToEmail}
                      onChange={(event) => setBillToEmail(event.target.value)}
                      fullWidth
                    />
                  )}
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <MenuItem value="DRAFT">Draft</MenuItem>
                      <MenuItem value="SENT">Sent</MenuItem>
                      <MenuItem value="PAID">Paid</MenuItem>
                      <MenuItem value="PAST_DUE">Past Due</MenuItem>
                      <MenuItem value="VOID">Void</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <FormControl fullWidth>
                    <InputLabel>Currency</InputLabel>
                    <Select
                      label="Currency"
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                    >
                      <MenuItem value="USD">USD</MenuItem>
                      <MenuItem value="EUR">EUR</MenuItem>
                      <MenuItem value="JPY">JPY</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="Due date"
                    type="date"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                  />
                </Stack>

                <Stack spacing={1}>
                  <Typography variant="subtitle2">Line Items</Typography>
                  {lineItems.map((item, idx) => (
                    <Stack key={idx} spacing={1}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                        <FormControl fullWidth>
                          <InputLabel>Type</InputLabel>
                          <Select
                            label="Type"
                            value={item.itemType}
                            onChange={(event) =>
                              handleLineItemChange(idx, "itemType", event.target.value)
                            }
                          >
                            <MenuItem value="SESSION">Training Session</MenuItem>
                            <MenuItem value="PROGRAM">Program</MenuItem>
                            <MenuItem value="NUTRITION">Nutrition Plan</MenuItem>
                            <MenuItem value="MERCH">Merchandise</MenuItem>
                            <MenuItem value="CUSTOM">Other</MenuItem>
                          </Select>
                        </FormControl>
                        {item.itemType === "SESSION" && (
                          <FormControl fullWidth>
                            <InputLabel>Session Type</InputLabel>
                            <Select
                              label="Session Type"
                              value={item.sessionTypeId}
                              onChange={(event) =>
                                handleLineItemChange(idx, "sessionTypeId", event.target.value)
                              }
                            >
                              <MenuItem value="">Select session type</MenuItem>
                              {sessionTypes.map((type) => (
                                <MenuItem key={type._id} value={type._id}>
                                  {sessionTypeLabel(type)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                        <TextField
                          label="Description"
                          value={item.description}
                          onChange={(event) =>
                            handleLineItemChange(idx, "description", event.target.value)
                          }
                          fullWidth
                        />
                        <TextField
                          label="Qty"
                          type="number"
                          value={item.quantity}
                          onChange={(event) =>
                            handleLineItemChange(idx, "quantity", event.target.value)
                          }
                          slotProps={{ htmlInput: { min: 1 } }}
                          fullWidth
                        />
                        <TextField
                          label="Unit Price"
                          type="number"
                          value={item.unitPrice}
                          onChange={(event) =>
                            handleLineItemChange(idx, "unitPrice", event.target.value)
                          }
                          slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                          fullWidth
                        />
                        <TextField
                          label="Session Credits (per unit)"
                          type="number"
                          value={item.sessionCredits}
                          onChange={(event) =>
                            handleLineItemChange(idx, "sessionCredits", event.target.value)
                          }
                          slotProps={{ htmlInput: { min: 0, step: "0.5" } }}
                          disabled={item.itemType !== "SESSION"}
                          fullWidth
                        />
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => handleRemoveLineItem(idx)}
                          disabled={lineItems.length === 1}
                        >
                          Remove Line
                        </Button>
                      </Stack>
                      <Divider />
                    </Stack>
                  ))}
                  <Button variant="outlined" onClick={handleAddLineItem}>
                    Add Line Item
                  </Button>
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Tax"
                    type="number"
                    value={tax}
                    onChange={(event) => setTax(event.target.value)}
                    slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                    fullWidth
                  />
                  <TextField
                    label="Discount"
                    type="number"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                    slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                    fullWidth
                  />
                </Stack>

                <Stack spacing={1}>
                  <TextField
                    label="Notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                  <TextField
                    label="Terms"
                    value={terms}
                    onChange={(event) => setTerms(event.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Stack>

                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">Totals</Typography>
                      <Typography variant="body2">Subtotal: {totals.subtotal.toFixed(2)}</Typography>
                      <Typography variant="body2">Tax: {totals.taxValue.toFixed(2)}</Typography>
                      <Typography variant="body2">
                        Discount: {totals.discountValue.toFixed(2)}
                      </Typography>
                      <Typography variant="body1">
                        Total: {totals.total.toFixed(2)}
                      </Typography>
                      <Typography variant="body2">
                        Session Credits: {totals.sessionCreditsTotal}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>

              </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateInvoice}>
            Create Invoice
          </Button>
        </DialogActions>
      </Dialog>

      {user.isTrainer && (
        <Grid container size={12}>
          <Card sx={{ width: "100%" }}>
            <CardContent>
              {loadingInvoices ? (
                <Typography color="text.secondary">Loading invoices…</Typography>
              ) : filteredInvoices.length === 0 ? (
                <Stack spacing={1} sx={{ alignItems: "center", py: 4 }}>
                  <Typography color="text.secondary">
                    {invoiceList.length === 0
                      ? "No invoices yet."
                      : "No invoices match this filter."}
                  </Typography>
                  {invoiceList.length === 0 && (
                    <Button variant="outlined" size="small" onClick={startCreate}>
                      Create the first one
                    </Button>
                  )}
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  {filteredInvoices.map((invoice) => {
                    const chip = STATUS_CHIP[invoice.status] || {
                      label: invoice.status,
                      color: "default",
                    };
                    const total = Number(invoice.total || 0);
                    const balance = Number(invoice.balanceDue || 0);
                    const canPay = invoice.status !== "PAID" && invoice.status !== "VOID";
                    const request = isRequest(invoice);
                    return (
                      <Card
                        key={invoice._id}
                        variant="outlined"
                        sx={
                          request
                            ? {
                                borderColor: "warning.main",
                                borderWidth: 1.5,
                                bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                              }
                            : undefined
                        }
                      >
                        <CardContent sx={{ pb: 1.5, "&:last-child": { pb: 1.5 } }}>
                          <Box
                            onClick={() => openDetail(invoice)}
                            sx={{ cursor: "pointer" }}
                          >
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
                          >
                            <Stack spacing={0.5}>
                              <Stack
                                direction="row"
                                spacing={0.5}
                                sx={{ alignItems: "center", flexWrap: "wrap" }}
                              >
                                {request && (
                                  <PriorityHighIcon color="warning" fontSize="small" />
                                )}
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 0.5 }}>
                                  {invoice.billToName || "—"}
                                </Typography>
                                <Chip size="small" label={chip.label} color={chip.color} />
                                {request && (
                                  <Chip size="small" color="warning" label="Requested" />
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {invoice.invoiceNumber}
                                {invoice.issuedAt
                                  ? ` · ${dayjs(invoice.issuedAt).format("MMM D, YYYY")}`
                                  : ""}
                              </Typography>
                            </Stack>
                            <Stack sx={{ textAlign: "right" }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {formatPrice(total, invoice.currency)}
                              </Typography>
                              {balance > 0 ? (
                                <Typography variant="caption" color="warning.main">
                                  Balance {formatPrice(balance, invoice.currency)}
                                </Typography>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  Paid in full
                                </Typography>
                              )}
                              {invoice.sessionCreditsTotal ? (
                                <Typography variant="caption" color="text.secondary">
                                  +{invoice.sessionCreditsTotal} sessions
                                </Typography>
                              ) : null}
                            </Stack>
                          </Stack>
                          </Box>

                          <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: "center" }}>
                            {canPay && (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleStatusUpdate(invoice._id, "PAID")}
                              >
                                Mark paid
                              </Button>
                            )}
                            {invoice.status === "VOID" && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  handleStatusUpdate(invoice._id, balance <= 0 ? "PAID" : "SENT")
                                }
                              >
                                Unvoid
                              </Button>
                            )}
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton
                              size="small"
                              aria-label="more actions"
                              onClick={(event) => openRowMenu(event, invoice)}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      )}

      <Menu anchorEl={rowMenuAnchor} open={Boolean(rowMenuAnchor)} onClose={closeRowMenu}>
        <MenuItem
          onClick={() => {
            handleDownloadPdf(rowMenuInvoice);
            closeRowMenu();
          }}
        >
          Download PDF
        </MenuItem>
        <MenuItem
          onClick={() => {
            openEmailDialog(rowMenuInvoice);
            closeRowMenu();
          }}
        >
          Email
        </MenuItem>
        {rowMenuInvoice &&
          Number(rowMenuInvoice.balanceDue) > 0 &&
          ["SENT", "PARTIAL", "PAST_DUE"].includes(rowMenuInvoice.status) && (
            <MenuItem
              onClick={() => {
                handleSendReminder(rowMenuInvoice);
                closeRowMenu();
              }}
            >
              Send reminder
            </MenuItem>
          )}
        {rowMenuInvoice?.status !== "VOID" && (
          <MenuItem
            sx={{ color: "error.main" }}
            onClick={() => {
              openVoidDialog(rowMenuInvoice);
              closeRowMenu();
            }}
          >
            Void
          </MenuItem>
        )}
      </Menu>

      <InvoiceReportsDialog open={reportsOpen} onClose={() => setReportsOpen(false)} />

      <LogSessionsDialog
        open={logSessionsOpen}
        onClose={() => setLogSessionsOpen(false)}
        clientId={filteredClient?._id}
        clientName={
          filteredClient
            ? `${filteredClient.firstName} ${filteredClient.lastName}`
            : ""
        }
        onLogged={() => {
          refreshInvoices();
          refreshSummary(clientFilter);
        }}
      />

      <Dialog
        open={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        maxWidth="sm"
        fullWidth
      >
        {detailInvoice && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <span>{detailInvoice.invoiceNumber}</span>
                <Chip
                  size="small"
                  label={(STATUS_CHIP[detailInvoice.status] || {}).label || detailInvoice.status}
                  color={(STATUS_CHIP[detailInvoice.status] || {}).color || "default"}
                />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  {detailInvoice.billToName || ""}
                  {detailInvoice.issuedAt
                    ? ` · Issued ${dayjs(detailInvoice.issuedAt).format("MMM D, YYYY")}`
                    : ""}
                  {detailInvoice.dueAt
                    ? ` · Due ${dayjs(detailInvoice.dueAt).format("MMM D, YYYY")}`
                    : ""}
                </Typography>

                <Divider />
                <Typography variant="subtitle2">Items</Typography>
                {(detailInvoice.lineItems || []).map((li, idx) => (
                  <Stack
                    key={idx}
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: "space-between" }}
                  >
                    <Box>
                      <Typography variant="body2">{li.description || li.itemType}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {li.quantity} × {formatPrice(li.unitPrice, detailInvoice.currency)}
                        {li.itemType === "SESSION" && li.sessionCreditsTotal
                          ? ` · ${li.sessionCreditsTotal} credits`
                          : ""}
                      </Typography>
                      {li.scheduleEventId && detailInvoice.clientId && (
                        <Box>
                          <Link
                            component={RouterLink}
                            to={`/session-history?client=${detailInvoice.clientId}&event=${li.scheduleEventId}${
                              li.sessionDate ? `&date=${dayjs(li.sessionDate).format("YYYY-MM-DD")}` : ""
                            }`}
                            variant="caption"
                            underline="hover"
                            onClick={() => setDetailInvoice(null)}
                          >
                            View session
                          </Link>
                        </Box>
                      )}
                    </Box>
                    <Typography variant="body2">
                      {formatPrice(li.lineTotal, detailInvoice.currency)}
                    </Typography>
                  </Stack>
                ))}

                <Divider />
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="body2" color="text.secondary">
                    Subtotal
                  </Typography>
                  <Typography variant="body2">
                    {formatPrice(detailInvoice.subtotal, detailInvoice.currency)}
                  </Typography>
                </Stack>
                {detailInvoice.tax ? (
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">
                      Tax
                    </Typography>
                    <Typography variant="body2">
                      {formatPrice(detailInvoice.tax, detailInvoice.currency)}
                    </Typography>
                  </Stack>
                ) : null}
                {detailInvoice.discount ? (
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">
                      Discount
                    </Typography>
                    <Typography variant="body2">
                      −{formatPrice(detailInvoice.discount, detailInvoice.currency)}
                    </Typography>
                  </Stack>
                ) : null}
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="subtitle2">Total</Typography>
                  <Typography variant="subtitle2">
                    {formatPrice(detailInvoice.total, detailInvoice.currency)}
                  </Typography>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography variant="body2" color="text.secondary">
                    Paid
                  </Typography>
                  <Typography variant="body2">
                    {formatPrice(detailInvoice.amountPaid || 0, detailInvoice.currency)}
                  </Typography>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                  <Typography
                    variant="body2"
                    color={Number(detailInvoice.balanceDue) > 0 ? "warning.main" : "text.secondary"}
                  >
                    Balance due
                  </Typography>
                  <Typography
                    variant="body2"
                    color={Number(detailInvoice.balanceDue) > 0 ? "warning.main" : "text.secondary"}
                  >
                    {formatPrice(detailInvoice.balanceDue || 0, detailInvoice.currency)}
                  </Typography>
                </Stack>
                {detailInvoice.sessionCreditsTotal ? (
                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">
                      Session credits
                    </Typography>
                    <Typography variant="body2">+{detailInvoice.sessionCreditsTotal}</Typography>
                  </Stack>
                ) : null}

                {(detailInvoice.payments || []).length > 0 && (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">Payments</Typography>
                    {detailInvoice.payments.map((p) => {
                      const refund = p.type === "REFUND";
                      const manual = !p.processor || p.processor === "MANUAL";
                      return (
                        <Stack
                          key={p._id}
                          direction="row"
                          spacing={1}
                          sx={{ justifyContent: "space-between", alignItems: "center" }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {p.paidAt ? dayjs(p.paidAt).format("MMM D, YYYY") : ""}
                            {p.method ? ` · ${p.method}` : ""}
                            {refund ? " · refund" : ""}
                            {p.processor && p.processor !== "MANUAL" ? ` · ${p.processor}` : ""}
                          </Typography>
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            <Typography
                              variant="body2"
                              color={refund ? "error.main" : "text.primary"}
                            >
                              {refund ? "−" : ""}
                              {formatPrice(p.amount, p.currency || detailInvoice.currency)}
                            </Typography>
                            {manual && detailInvoice.status !== "VOID" && (
                              <IconButton
                                size="small"
                                aria-label="remove payment"
                                onClick={() => removePaymentEntry(p._id)}
                              >
                                <CloseIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                          </Stack>
                        </Stack>
                      );
                    })}
                  </>
                )}

                {detailInvoice.status !== "VOID" &&
                  (Number(detailInvoice.balanceDue) > 0 ||
                    Number(detailInvoice.amountPaid) > 0) && (
                    <>
                      <Divider />
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between", alignItems: "center" }}
                      >
                        <Typography variant="subtitle2">
                          {refundMode ? "Record a refund" : "Record a payment"}
                        </Typography>
                        {Number(detailInvoice.amountPaid) > 0 && (
                          <Button
                            size="small"
                            color={refundMode ? "inherit" : "error"}
                            onClick={() => setRefundMode((v) => !v)}
                          >
                            {refundMode ? "Cancel refund" : "Refund"}
                          </Button>
                        )}
                      </Stack>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <TextField
                          label="Amount"
                          type="number"
                          size="small"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                          fullWidth
                        />
                        {!refundMode && (
                          <FormControl size="small" fullWidth>
                            <InputLabel>Method</InputLabel>
                            <Select
                              label="Method"
                              value={payMethod}
                              onChange={(e) => setPayMethod(e.target.value)}
                            >
                              {PAYMENT_METHODS.map((m) => (
                                <MenuItem key={m} value={m}>
                                  {m}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                        {!refundMode && (
                          <TextField
                            label="Date"
                            type="date"
                            size="small"
                            value={payDate}
                            onChange={(e) => setPayDate(e.target.value)}
                            slotProps={{ inputLabel: { shrink: true } }}
                            fullWidth
                          />
                        )}
                      </Stack>
                      {refundMode ? (
                        <TextField
                          label="Reason (optional)"
                          size="small"
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                          fullWidth
                        />
                      ) : (
                        <TextField
                          label="Reference (optional)"
                          size="small"
                          value={payReference}
                          onChange={(e) => setPayReference(e.target.value)}
                          fullWidth
                        />
                      )}
                      <Button
                        variant="contained"
                        color={refundMode ? "error" : "primary"}
                        disabled={payBusy || !(Number(payAmount) > 0)}
                        onClick={submitPayment}
                      >
                        {refundMode ? "Record refund" : "Record payment"}
                      </Button>
                    </>
                  )}

                {detailInvoice.notes && (
                  <Typography variant="caption" color="text.secondary">
                    Notes: {detailInvoice.notes}
                  </Typography>
                )}
                {detailInvoice.terms && (
                  <Typography variant="caption" color="text.secondary">
                    Terms: {detailInvoice.terms}
                  </Typography>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleDownloadPdf(detailInvoice)}>PDF</Button>
              <Button onClick={() => setDetailInvoice(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {error && (
        <Grid container size={12}>
          <Typography color="error">{error}</Typography>
        </Grid>
      )}

      {notice && (
        <Grid container size={12}>
          <Typography color="success.main">{notice}</Typography>
        </Grid>
      )}

      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Email Invoice</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Recipient email"
              value={emailRecipient}
              onChange={(event) => setEmailRecipient(event.target.value)}
              fullWidth
            />
            <TextField
              label="Message (optional)"
              value={emailMessage}
              onChange={(event) => setEmailMessage(event.target.value)}
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSendEmail} disabled={sendingEmail}>
            {sendingEmail ? "Sending..." : "Send Email"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={voidDialogOpen}
        onClose={() => setVoidDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Void Invoice</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This will void invoice {voidInvoice?.invoiceNumber || ""} and remove its session
              credits from the ledger.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVoidDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleConfirmVoid}>
            Confirm Void
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
