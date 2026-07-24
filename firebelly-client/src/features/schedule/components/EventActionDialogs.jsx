import React from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { sessionTypeLabel } from "../../../utils/sessionTypeLabel";

// Purchased session types float to the top of the booking pickers (most remaining first,
// then purchased-but-used-up, then the rest in their usual order), with the client's
// remaining prepaid count shown next to the name.
const orderTypesByCredits = (sessionTypes, creditsByType = {}) => {
  const rank = (type) => {
    const c = creditsByType[type._id];
    if (c && c.remaining > 0) return 0;
    if (c && c.purchased) return 1;
    return 2;
  };
  return [...sessionTypes].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) {
      return (creditsByType[b._id]?.remaining || 0) - (creditsByType[a._id]?.remaining || 0);
    }
    return 0; // stable sort keeps the original order within a rank
  });
};
const creditSuffix = (type, creditsByType = {}) => {
  const c = creditsByType[type._id];
  if (!c || !c.purchased) return "";
  const n = Math.max(c.remaining, 0);
  // Bookings-in-waiting haven't debited credits yet — show what's truly free to book.
  if ((c.booked || 0) > 0) return ` — ${Math.max(c.unbooked, 0)} unbooked of ${n}`;
  return ` — ${n} left`;
};

// Book-time billing prompt: prepaid credits don't cover this booking — offer to create
// a SENT invoice for the uncovered sessions (pre-checked, but bookable without one).
function InvoiceShortfallPrompt({ shortfall, checked, onChange }) {
  if (!shortfall) return null;
  const sessions =
    shortfall.uncoveredSessions === 1 ? "1 session" : `${shortfall.uncoveredSessions} sessions`;
  const notCovered = `${sessions} in this booking ${
    shortfall.uncoveredSessions === 1 ? "isn't" : "aren't"
  } covered.`;
  let headline;
  if (shortfall.remaining <= 0) {
    headline = `No prepaid ${shortfall.typeName} credits left.`;
  } else if (shortfall.booked > 0) {
    headline = `${shortfall.remaining} prepaid ${shortfall.typeName} credit${
      shortfall.remaining === 1 ? "" : "s"
    } left, but ${shortfall.booked} session${
      shortfall.booked === 1 ? " is" : "s are"
    } already booked — only ${shortfall.unbooked} unbooked. ${notCovered}`;
  } else {
    headline = `Only ${shortfall.remaining} prepaid ${shortfall.typeName} credit${
      shortfall.remaining === 1 ? "" : "s"
    } left — ${notCovered}`;
  }
  return (
    <Alert severity={checked ? "info" : "warning"} sx={{ py: 0.5 }}>
      {headline}
      <FormControlLabel
        sx={{ display: "flex", mt: 0.5 }}
        control={
          <Checkbox
            size="small"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
          />
        }
        label={`Create an invoice — $${shortfall.amount.toFixed(2)} due for ${sessions}`}
      />
    </Alert>
  );
}

export default function EventActionDialogs({
  openSelectionDialog,
  handleClearSelection,
  selectionRange,
  selectionRangeAdjusted,
  selectionStartTime,
  setSelectionStartTime,
  selectionEndTime,
  setSelectionEndTime,
  clients,
  quickBookClientId,
  setQuickBookClientId,
  quickBookWorkoutId,
  setQuickBookWorkoutId,
  quickBookWorkouts,
  quickBookQueuedWorkouts,
  quickBookSessionTypeId,
  handleSelectQuickBookSessionType,
  quickBookCreditsByType,
  quickBookPrice,
  setQuickBookPrice,
  quickBookPriceCurrency,
  setQuickBookPriceCurrency,
  quickBookPayout,
  setQuickBookPayout,
  quickBookPayoutCurrency,
  setQuickBookPayoutCurrency,
  quickBookRecurring,
  setQuickBookRecurring,
  quickBookRecurUntil,
  setQuickBookRecurUntil,
  bookingConflictLabels = [],
  quickBookBalance = null,
  sessionTypes,
  handleQuickBookClient,
  handleQuickBookCreateWorkout,
  quickBookCustomName,
  setQuickBookCustomName,
  quickBookCustomEmail,
  setQuickBookCustomEmail,
  quickBookCustomPhone,
  setQuickBookCustomPhone,
  handleQuickBookCustom,
  handleCreateSlotsFromSelection,
  openAvailabilityDialog,
  setOpenAvailabilityDialog,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  availabilityType,
  setAvailabilityType,
  availabilityRecurrence,
  setAvailabilityRecurrence,
  handleCreateAvailability,
  openRequestDialog,
  setOpenRequestDialog,
  activeRequestEvent,
  formatRange,
  bookingType,
  setBookingType,
  bookingStartOptions,
  selectedBookingSlot,
  setSelectedBookingSlot,
  bookingEndOptions,
  selectedBookingEndSlot,
  setSelectedBookingEndSlot,
  handleRequestBooking,
  openAttachDialog,
  setOpenAttachDialog,
  attachEvent,
  selectedWorkoutId,
  setSelectedWorkoutId,
  attachWorkouts,
  attachQueuedWorkouts,
  handleCreateWorkout,
  handleAttachWorkout,
  openEditDialog,
  setOpenEditDialog,
  editClientProfile,
  editClientAvatar,
  editClientName,
  editEvent,
  attachedEditWorkout,
  editDate,
  setEditDate,
  editStartTime,
  setEditStartTime,
  editEndTime,
  setEditEndTime,
  isTrainerView,
  editClientId,
  setEditClientId,
  editCustomName,
  setEditCustomName,
  editCustomEmail,
  setEditCustomEmail,
  editCustomPhone,
  setEditCustomPhone,
  editPriceAmount,
  setEditPriceAmount,
  currencyAffix,
  editPriceCurrency,
  setEditPriceCurrency,
  editPayoutAmount,
  setEditPayoutAmount,
  editPayoutCurrency,
  setEditPayoutCurrency,
  editPublicLabel,
  setEditPublicLabel,
  editSessionTypeId,
  setEditSessionTypeId,
  applyDefaultPriceForType,
  applyDefaultPayoutForType,
  editStatus,
  setEditStatus,
  editWorkoutClientId,
  workoutsByAccount,
  workoutQueue,
  editWorkoutId,
  setEditWorkoutId,
  handleCreateWorkoutForEdit,
  openCopyForEvent,
  handleReopenEvent,
  openDeleteConfirm,
  handleSaveEdit,
  savingEdit = false,
  openEventActionDialog,
  setOpenEventActionDialog,
  eventActionTarget,
  eventActionAnchor,
  onQuickStatus,
  getEventDisplayName,
  getSessionTypeLabel,
  openTrainerBookForEvent,
  openEditForEvent,
  handleCancelEvent,
  openTrainerBookDialog,
  setOpenTrainerBookDialog,
  trainerBookingStartOptions,
  trainerBookSlot,
  setTrainerBookSlot,
  trainerBookingEndOptions,
  trainerBookEndSlot,
  setTrainerBookEndSlot,
  trainerBookClientId,
  setTrainerBookClientId,
  trainerBookSessionTypeId,
  trainerBookCreditsByType,
  setTrainerBookSessionTypeId,
  quickBookInvoiceShortfall = null,
  quickBookCreateInvoice = false,
  setQuickBookCreateInvoice,
  trainerBookInvoiceShortfall = null,
  trainerBookCreateInvoice = false,
  setTrainerBookCreateInvoice,
  trainerBookCustomName,
  setTrainerBookCustomName,
  trainerBookCustomEmail,
  setTrainerBookCustomEmail,
  trainerBookCustomPhone,
  setTrainerBookCustomPhone,
  handleTrainerBookSlot,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [showMoreOptions, setShowMoreOptions] = React.useState(false);

  const moneyAdornment = {
    input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
  };

  const selectionContent = selectionRange ? (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {/* Time summary + editable times */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {selectionRangeAdjusted ? selectionRangeAdjusted.start.format("ddd, MMM D") : ""}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {selectionRangeAdjusted
            ? `${selectionRangeAdjusted.start.format("h:mm A")} – ${selectionRangeAdjusted.end.format("h:mm A")}`
            : ""}
        </Typography>
      </Stack>

      {/* Client search */}
      <Autocomplete
        options={clients.filter((clientRel) => clientRel.accepted)}
        getOptionLabel={(option) =>
          `${option.client.firstName} ${option.client.lastName}`
        }
        isOptionEqualToValue={(option, value) => option.client._id === value.client._id}
        value={clients.find((clientRel) => clientRel.client._id === quickBookClientId) || null}
        onChange={(_, value) => setQuickBookClientId(value ? value.client._id : "")}
        renderInput={(params) => (
          <TextField {...params} label="Client" placeholder="Search clients…" />
        )}
        fullWidth
      />

      {/* Session type (auto-fills price/payout/duration) */}
      <FormControl fullWidth>
        <InputLabel>Session type</InputLabel>
        <Select
          label="Session type"
          value={quickBookSessionTypeId}
          onChange={(event) => handleSelectQuickBookSessionType(event.target.value)}
        >
          <MenuItem value="">No session type</MenuItem>
          {orderTypesByCredits(sessionTypes, quickBookCreditsByType).map((type) => (
            <MenuItem key={type._id} value={type._id}>
              {sessionTypeLabel(type)}
              {creditSuffix(type, quickBookCreditsByType)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Prepaid balance for the chosen client (informational — credits draw down
          when the session is marked complete, not at booking). When the booking isn't
          covered, the balance line becomes the create-invoice prompt instead. */}
      {quickBookInvoiceShortfall ? (
        <InvoiceShortfallPrompt
          shortfall={quickBookInvoiceShortfall}
          checked={quickBookCreateInvoice}
          onChange={setQuickBookCreateInvoice}
        />
      ) : (
        quickBookClientId && quickBookBalance !== null && (
          quickBookBalance.remaining > 0 ? (
            <Typography variant="caption" color="text.secondary">
              {quickBookBalance.remaining} prepaid session
              {quickBookBalance.remaining === 1 ? "" : "s"} remaining
              {quickBookSessionTypeId ? " for this type" : ""}
              {quickBookBalance.booked > 0
                ? ` · ${quickBookBalance.booked} already booked · ${Math.max(
                  quickBookBalance.unbooked,
                  0
                )} unbooked`
                : ""}
            </Typography>
          ) : (
            <Alert severity="info" sx={{ py: 0.5 }}>
              No prepaid sessions remaining
              {quickBookSessionTypeId ? " for this type" : ""} — this client will owe for
              this session.
            </Alert>
          )
        )
      )}

      {/* Price + payout (auto-filled from session type, editable) */}
      <Stack direction="row" spacing={1}>
        <TextField
          label="Price"
          type="number"
          value={quickBookPrice}
          onChange={(event) => setQuickBookPrice(event.target.value)}
          slotProps={moneyAdornment}
          fullWidth
        />
        <TextField
          label="Payout"
          type="number"
          value={quickBookPayout}
          onChange={(event) => setQuickBookPayout(event.target.value)}
          slotProps={moneyAdornment}
          fullWidth
        />
      </Stack>

      {/* Editable times */}
      <Stack direction="row" spacing={1}>
        <TextField
          label="Start"
          type="time"
          value={selectionStartTime}
          onChange={(event) => setSelectionStartTime(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
        />
        <TextField
          label="End"
          type="time"
          value={selectionEndTime}
          onChange={(event) => setSelectionEndTime(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          fullWidth
        />
      </Stack>

      {/* Recurring */}
      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={quickBookRecurring}
              onChange={(event) => setQuickBookRecurring(event.target.checked)}
            />
          }
          label="Repeat weekly"
        />
        <Collapse in={quickBookRecurring}>
          <TextField
            label="Repeat until"
            type="date"
            value={quickBookRecurUntil}
            onChange={(event) => setQuickBookRecurUntil(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Creates one session each week through this date."
            fullWidth
            sx={{ mt: 1 }}
          />
        </Collapse>
      </Box>

      {/* Conflict warning (non-blocking) */}
      {bookingConflictLabels.length > 0 && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          Overlaps an existing session: {bookingConflictLabels.join(", ")}
        </Alert>
      )}

      {/* Primary action */}
      <Button
        variant="contained"
        size="large"
        color={bookingConflictLabels.length > 0 ? "warning" : "primary"}
        onClick={handleQuickBookClient}
        disabled={!quickBookClientId}
      >
        {bookingConflictLabels.length > 0 ? "Book anyway" : "Book session"}
      </Button>

      <Button
        variant="text"
        size="small"
        onClick={() => setShowMoreOptions((prev) => !prev)}
        sx={{ alignSelf: "flex-start" }}
      >
        {showMoreOptions ? "Fewer options ▲" : "More options ▾"}
      </Button>

      <Collapse in={showMoreOptions}>
        <Stack spacing={2}>
          {/* Attach / create workout */}
          <FormControl fullWidth disabled={!quickBookClientId}>
            <InputLabel>Workout (optional)</InputLabel>
            <Select
              label="Workout (optional)"
              value={quickBookWorkoutId}
              onChange={(event) => setQuickBookWorkoutId(event.target.value)}
            >
              <MenuItem value="">No workout</MenuItem>
              {quickBookWorkouts.map((workout) => (
                <MenuItem key={workout._id} value={workout._id}>
                  {workout.title || "Untitled"} - {dayjs.utc(workout.date).format("MMM D")}
                </MenuItem>
              ))}
              {quickBookQueuedWorkouts.map((workout) => (
                <MenuItem key={workout._id} value={workout._id}>
                  {workout.title || "Untitled"} - Queued
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={handleQuickBookCreateWorkout}
            disabled={!quickBookClientId}
          >
            Create workout & book
          </Button>

          <Divider />

          {/* Walk-in / custom client */}
          <Typography variant="subtitle2">Walk-in / custom client</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Name"
              value={quickBookCustomName}
              onChange={(event) => setQuickBookCustomName(event.target.value)}
              fullWidth
            />
            <TextField
              label="Email"
              value={quickBookCustomEmail}
              onChange={(event) => setQuickBookCustomEmail(event.target.value)}
              fullWidth
            />
            <TextField
              label="Phone"
              value={quickBookCustomPhone}
              onChange={(event) => setQuickBookCustomPhone(event.target.value)}
              fullWidth
            />
          </Stack>
          <Button
            variant="contained"
            onClick={handleQuickBookCustom}
            disabled={!quickBookCustomName.trim()}
          >
            Book custom client
          </Button>

          <Divider />

          {/* Open availability slot */}
          <Button
            variant="outlined"
            onClick={handleCreateSlotsFromSelection}
            disabled={
              !selectionRangeAdjusted ||
              selectionRangeAdjusted.end.valueOf() <= selectionRangeAdjusted.start.valueOf()
            }
          >
            Create open availability slot
          </Button>
        </Stack>
      </Collapse>
    </Stack>
  ) : null;

  return (
    <>
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={openSelectionDialog}
          onClose={handleClearSelection}
          slotProps={{
            paper: {
              sx: {
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: "92vh",
              },
            },
          }}
        >
          <Box sx={{ p: 2, pb: 3 }}>
            <Box
              sx={{
                width: 36,
                height: 4,
                bgcolor: "divider",
                borderRadius: 2,
                mx: "auto",
                mb: 1.5,
              }}
            />
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography variant="h6">New session</Typography>
              <Button size="small" onClick={handleClearSelection}>
                Cancel
              </Button>
            </Stack>
            {selectionContent}
          </Box>
        </Drawer>
      ) : (
        <Dialog open={openSelectionDialog} onClose={handleClearSelection} maxWidth="sm" fullWidth>
          <DialogTitle>New session</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>{selectionContent}</DialogContent>
          <DialogActions>
            <Button onClick={handleClearSelection}>Cancel</Button>
          </DialogActions>
        </Dialog>
      )}

      <Dialog
        open={openAvailabilityDialog}
        onClose={() => setOpenAvailabilityDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Open Availability</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Start time"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End time"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <ToggleButtonGroup
              exclusive
              value={availabilityType}
              onChange={(event, value) => value && setAvailabilityType(value)}
              size="small"
            >
              <ToggleButton value="MANUAL">One-off</ToggleButton>
              <ToggleButton value="NORMAL">Normal sessions</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              exclusive
              value={availabilityRecurrence}
              onChange={(event, value) => value && setAvailabilityRecurrence(value)}
              size="small"
            >
              <ToggleButton value="none">No recurrence</ToggleButton>
              <ToggleButton value="weekly">Weekly</ToggleButton>
            </ToggleButtonGroup>
            {availabilityType === "NORMAL" && availabilityRecurrence !== "weekly" && (
              <Typography variant="caption" color="text.secondary">
                Normal session entries should be recurring.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAvailabilityDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAvailability}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openRequestDialog}
        onClose={() => setOpenRequestDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Request Appointment</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {activeRequestEvent && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="subtitle1">{formatRange(activeRequestEvent)}</Typography>
              <ToggleButtonGroup
                exclusive
                value={bookingType}
                onChange={(event, value) => value && setBookingType(value)}
                size="small"
              >
                <ToggleButton value="one-time">One-time</ToggleButton>
                <ToggleButton
                  value="recurring"
                  disabled={
                    activeRequestEvent.availabilitySource !== "NORMAL" ||
                    !activeRequestEvent.recurrenceRule
                  }
                >
                  Recurring
                </ToggleButton>
              </ToggleButtonGroup>
              {activeRequestEvent.availabilitySource === "MANUAL" && (
                <Typography variant="caption" color="text.secondary">
                  Manual slots cannot be booked as recurring.
                </Typography>
              )}
              {activeRequestEvent.eventType === "AVAILABILITY" && (
                <>
                  {bookingStartOptions.length > 0 ? (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <FormControl fullWidth>
                        <InputLabel>Start time</InputLabel>
                        <Select
                          label="Start time"
                          value={selectedBookingSlot}
                          onChange={(event) => setSelectedBookingSlot(event.target.value)}
                        >
                          {bookingStartOptions.map((slot) => (
                            <MenuItem key={slot.value} value={slot.value}>
                              {slot.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth>
                        <InputLabel>End time</InputLabel>
                        <Select
                          label="End time"
                          value={selectedBookingEndSlot}
                          onChange={(event) => setSelectedBookingEndSlot(event.target.value)}
                        >
                          {bookingEndOptions.map((slot) => (
                            <MenuItem key={slot.value} value={slot.value}>
                              {slot.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      This availability range does not include any bookable times.
                    </Typography>
                  )}
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRequestDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRequestBooking}
            disabled={
              activeRequestEvent?.eventType === "AVAILABILITY" &&
              (bookingStartOptions.length === 0 || !selectedBookingSlot || !selectedBookingEndSlot)
            }
          >
            Send request
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openAttachDialog}
        onClose={() => setOpenAttachDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Attach Workout</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Workouts listed here include any dated workouts in this month and queued workouts.
            </Typography>
            {attachEvent?.eventType === "AVAILABILITY" && (
              <Typography color="text.secondary">
                Attaching a workout to an open slot will create a booked appointment for that
                workout's client.
              </Typography>
            )}
            <FormControl fullWidth>
              <InputLabel>Workout</InputLabel>
              <Select
                label="Workout"
                value={selectedWorkoutId}
                onChange={(event) => setSelectedWorkoutId(event.target.value)}
              >
                {attachWorkouts.map((workout) => (
                  <MenuItem key={workout._id} value={workout._id}>
                    {workout.title || "Untitled"} - {dayjs.utc(workout.date).format("MMM D")}
                  </MenuItem>
                ))}
                {attachQueuedWorkouts.map((workout) => (
                  <MenuItem key={workout._id} value={workout._id}>
                    {workout.title || "Untitled"} - Queued
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={handleCreateWorkout}>
              Create New Workout
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAttachDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAttachWorkout} disabled={!selectedWorkoutId}>
            Attach
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Edit Event</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {editClientProfile && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Athlete</Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Avatar src={editClientAvatar} sx={{ width: 32, height: 32 }}>
                    {editClientName ? editClientName[0] : "A"}
                  </Avatar>
                  <Typography variant="body2">{editClientName || "Assigned athlete"}</Typography>
                </Stack>
              </Stack>
            )}
            {editEvent?.workoutId && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Attached workout</Typography>
                <Typography variant="body2">
                  {attachedEditWorkout?.title || "Workout attached"}
                </Typography>
                {attachedEditWorkout?.date && (
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(attachedEditWorkout.date).format("MMM D, YYYY")}
                  </Typography>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  component={Link}
                  to={`/workout/${editEvent.workoutId}?event=${editEvent._id}`}
                >
                  Open workout
                </Button>
              </Stack>
            )}
            <TextField
              label="Date"
              type="date"
              value={editDate}
              onChange={(event) => setEditDate(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Start time"
              type="time"
              value={editStartTime}
              onChange={(event) => setEditStartTime(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="End time"
              type="time"
              value={editEndTime}
              onChange={(event) => setEditEndTime(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {isTrainerView && editEvent?.eventType === "AVAILABILITY" && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Assign client</InputLabel>
                  <Select
                    label="Assign client"
                    value={editClientId}
                    onChange={(event) => {
                      setEditClientId(event.target.value);
                      if (event.target.value) {
                        setEditCustomName("");
                        setEditCustomEmail("");
                        setEditCustomPhone("");
                      }
                    }}
                  >
                    <MenuItem value="">Keep open</MenuItem>
                    {clients
                      .filter((clientRel) => clientRel.accepted)
                      .map((clientRel) => (
                        <MenuItem key={clientRel.client._id} value={clientRel.client._id}>
                          {clientRel.client.firstName} {clientRel.client.lastName}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                {editClientId && (
                  <Typography variant="caption" color="text.secondary">
                    Assigning a client will book this session immediately.
                  </Typography>
                )}
              </>
            )}
            {isTrainerView && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Custom booking</Typography>
                <TextField
                  label="Name"
                  value={editCustomName}
                  onChange={(event) => {
                    setEditCustomName(event.target.value);
                    if (event.target.value) {
                      setEditClientId("");
                    }
                  }}
                  disabled={Boolean(editClientId)}
                />
                <TextField
                  label="Email"
                  value={editCustomEmail}
                  onChange={(event) => setEditCustomEmail(event.target.value)}
                  disabled={Boolean(editClientId)}
                />
                <TextField
                  label="Phone"
                  value={editCustomPhone}
                  onChange={(event) => setEditCustomPhone(event.target.value)}
                  disabled={Boolean(editClientId)}
                />
                {editCustomName && (
                  <Typography variant="caption" color="text.secondary">
                    Custom bookings are trainer-only and won't create an account.
                  </Typography>
                )}
              </Stack>
            )}
            {isTrainerView && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Price</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Amount"
                    type="number"
                    value={editPriceAmount}
                    onChange={(event) => setEditPriceAmount(event.target.value)}
                    slotProps={{
                      htmlInput: { min: 0, step: "0.01" },
                      input:
                        currencyAffix.position === "start"
                          ? {
                              startAdornment: (
                                <Box sx={{ mr: 1, color: "text.secondary" }}>
                                  {currencyAffix.label}
                                </Box>
                              ),
                            }
                          : {
                              endAdornment: (
                                <Box sx={{ ml: 1, color: "text.secondary" }}>
                                  {currencyAffix.label}
                                </Box>
                              ),
                            },
                    }}
                    fullWidth
                  />
                  <FormControl fullWidth>
                    <InputLabel>Currency</InputLabel>
                    <Select
                      label="Currency"
                      value={editPriceCurrency}
                      onChange={(event) => setEditPriceCurrency(event.target.value)}
                    >
                      <MenuItem value="USD">USD</MenuItem>
                      <MenuItem value="EUR">EUR</MenuItem>
                      <MenuItem value="JPY">YEN</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
            )}
            {isTrainerView && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Trainer payout</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    label="Amount"
                    type="number"
                    value={editPayoutAmount}
                    onChange={(event) => setEditPayoutAmount(event.target.value)}
                    slotProps={{ htmlInput: { min: 0, step: "0.01" } }}
                    fullWidth
                  />
                  <FormControl fullWidth>
                    <InputLabel>Currency</InputLabel>
                    <Select
                      label="Currency"
                      value={editPayoutCurrency}
                      onChange={(event) => setEditPayoutCurrency(event.target.value)}
                    >
                      <MenuItem value="USD">USD</MenuItem>
                      <MenuItem value="EUR">EUR</MenuItem>
                      <MenuItem value="JPY">YEN</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
            )}
            {isTrainerView && editEvent?.eventType !== "AVAILABILITY" && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Public label</Typography>
                <TextField
                  label="Public label"
                  value={editPublicLabel}
                  onChange={(event) => setEditPublicLabel(event.target.value)}
                  placeholder="Booked / Unavailable / Reserved / Custom"
                />
                <Typography variant="caption" color="text.secondary">
                  Shows on public sessions and share images when client details are hidden.
                </Typography>
              </Stack>
            )}
            {isTrainerView &&
              (editEvent?.eventType !== "AVAILABILITY" || editClientId || editCustomName) && (
                <FormControl fullWidth>
                  <InputLabel>Session type</InputLabel>
                  <Select
                    label="Session type"
                    value={editSessionTypeId}
                    onChange={(event) => {
                      const nextTypeId = event.target.value;
                      const prevTypeId = editSessionTypeId;
                      setEditSessionTypeId(nextTypeId);
                      applyDefaultPriceForType(
                        nextTypeId,
                        prevTypeId,
                        editPriceAmount,
                        setEditPriceAmount,
                        setEditPriceCurrency
                      );
                      applyDefaultPayoutForType(
                        nextTypeId,
                        prevTypeId,
                        editPayoutAmount,
                        setEditPayoutAmount,
                        setEditPayoutCurrency
                      );
                    }}
                  >
                    <MenuItem value="">No session type</MenuItem>
                    {sessionTypes.map((type) => (
                      <MenuItem key={type._id} value={type._id}>
                        {sessionTypeLabel(type)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={editStatus}
                onChange={(event) => setEditStatus(event.target.value)}
                disabled={editEvent?.eventType === "AVAILABILITY" && Boolean(editClientId)}
              >
                {(editEvent?.eventType === "AVAILABILITY"
                  ? ["OPEN", "CANCELLED"]
                  : ["REQUESTED", "BOOKED", "COMPLETED", "CANCELLED"]
                ).map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {isTrainerView && editWorkoutClientId && (
              <Stack spacing={1}>
                <FormControl fullWidth>
                  <InputLabel>Workout</InputLabel>
                  <Select
                    label="Workout"
                    value={editWorkoutId}
                    onChange={(event) => setEditWorkoutId(event.target.value)}
                  >
                    <MenuItem value="">No workout</MenuItem>
                    {(workoutsByAccount?.[editWorkoutClientId]?.workouts || []).map((workout) => (
                      <MenuItem key={workout._id} value={workout._id}>
                        {workout.title || "Untitled"} - {dayjs.utc(workout.date).format("MMM D")}
                      </MenuItem>
                    ))}
                    {(workoutQueue?.[editWorkoutClientId] || []).map((workout) => (
                      <MenuItem key={workout._id} value={workout._id}>
                        {workout.title || "Untitled"} - Queued
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button size="small" variant="outlined" onClick={handleCreateWorkoutForEdit}>
                  Create workout for this session
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          {isTrainerView && editEvent && (
            <Button variant="outlined" onClick={() => openCopyForEvent(editEvent)}>
              Copy
            </Button>
          )}
          {isTrainerView && editEvent && editEvent.eventType !== "AVAILABILITY" && (
            <Button
              variant="outlined"
              onClick={async () => {
                await handleReopenEvent(editEvent);
                setOpenEditDialog(false);
              }}
            >
              Reopen slot
            </Button>
          )}
          {isTrainerView && editEvent && (
            <Button
              color="error"
              variant="outlined"
              onClick={() => {
                setOpenEditDialog(false);
                openDeleteConfirm(editEvent);
              }}
            >
              Delete
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={savingEdit}
            startIcon={savingEdit ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {savingEdit ? "Saving…" : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Popover
        open={openEventActionDialog && Boolean(eventActionAnchor)}
        anchorEl={eventActionAnchor}
        onClose={() => setOpenEventActionDialog(false)}
        anchorOrigin={{ vertical: "center", horizontal: "right" }}
        transformOrigin={{ vertical: "center", horizontal: "left" }}
        slotProps={{ paper: { sx: { width: 280, maxWidth: "92vw" } } }}
      >
        {eventActionTarget && (
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <Stack spacing={0.5}>
              <Typography variant="subtitle1">
                {eventActionTarget.eventType === "AVAILABILITY" ? "Open slot" : "Booked session"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatRange(eventActionTarget)}
              </Typography>
              {eventActionTarget.eventType !== "AVAILABILITY" && (
                <Typography variant="caption" color="text.secondary">
                  {getEventDisplayName(eventActionTarget)}
                </Typography>
              )}
              {isTrainerView && getSessionTypeLabel(eventActionTarget) && (
                <Typography variant="caption" color="text.secondary">
                  Session type: {getSessionTypeLabel(eventActionTarget)}
                </Typography>
              )}
            </Stack>

            {isTrainerView &&
              eventActionTarget.eventType !== "AVAILABILITY" &&
              onQuickStatus && (
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={eventActionTarget.status || ""}
                    onChange={(selectEvent) =>
                      onQuickStatus(eventActionTarget, selectEvent.target.value)
                    }
                  >
                    {["REQUESTED", "BOOKED", "COMPLETED", "CANCELLED"].map((status) => (
                      <MenuItem key={status} value={status}>
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

            <Divider />

            <Stack spacing={1}>
              {eventActionTarget.eventType === "AVAILABILITY" &&
                eventActionTarget.status === "OPEN" && (
                  <Button
                    variant="contained"
                    onClick={() => openTrainerBookForEvent(eventActionTarget)}
                  >
                    Book
                  </Button>
                )}

              {/* Quick completion / no-show actions (drive billing) */}
              {isTrainerView &&
                eventActionTarget.eventType !== "AVAILABILITY" &&
                onQuickStatus &&
                ["BOOKED", "REQUESTED"].includes(eventActionTarget.status) && (
                  <>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => onQuickStatus(eventActionTarget, "COMPLETED")}
                    >
                      Mark complete
                    </Button>
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={() =>
                        onQuickStatus(eventActionTarget, "CANCELLED", "CHARGED")
                      }
                    >
                      No-show (charge)
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() =>
                        onQuickStatus(eventActionTarget, "CANCELLED", "NO_CHARGE")
                      }
                    >
                      Cancel (no charge)
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      Completing or a charged no-show draws down the client&apos;s prepaid
                      balance.
                    </Typography>
                    <Divider />
                  </>
                )}

              <Button
                variant="outlined"
                onClick={() => {
                  setOpenEventActionDialog(false);
                  openEditForEvent(eventActionTarget);
                }}
              >
                Edit details
              </Button>
              {eventActionTarget.status !== "CANCELLED" && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setOpenEventActionDialog(false);
                    openCopyForEvent(eventActionTarget);
                  }}
                >
                  Copy
                </Button>
              )}
              {eventActionTarget.status === "OPEN" && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setOpenEventActionDialog(false);
                    handleCancelEvent(eventActionTarget._id);
                  }}
                >
                  Close slot
                </Button>
              )}
              <Button
                color="error"
                variant="outlined"
                onClick={() => {
                  setOpenEventActionDialog(false);
                  openDeleteConfirm(eventActionTarget);
                }}
              >
                Delete
              </Button>
            </Stack>
          </Stack>
        )}
      </Popover>

      <Dialog
        open={openTrainerBookDialog}
        onClose={() => setOpenTrainerBookDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Book Session</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {eventActionTarget && (
              <Typography variant="body2" color="text.secondary">
                {formatRange(eventActionTarget)}
              </Typography>
            )}
            {trainerBookingStartOptions.length > 0 ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <FormControl fullWidth>
                  <InputLabel>Start time</InputLabel>
                  <Select
                    label="Start time"
                    value={trainerBookSlot}
                    onChange={(event) => setTrainerBookSlot(event.target.value)}
                  >
                    {trainerBookingStartOptions.map((slot) => (
                      <MenuItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>End time</InputLabel>
                  <Select
                    label="End time"
                    value={trainerBookEndSlot}
                    onChange={(event) => setTrainerBookEndSlot(event.target.value)}
                  >
                    {trainerBookingEndOptions.map((slot) => (
                      <MenuItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">
                This availability range does not include any bookable times.
              </Typography>
            )}
            <FormControl fullWidth>
              <InputLabel>Client</InputLabel>
              <Select
                label="Client"
                value={trainerBookClientId}
                onChange={(event) => {
                  setTrainerBookClientId(event.target.value);
                  if (event.target.value) {
                    setTrainerBookCustomName("");
                    setTrainerBookCustomEmail("");
                    setTrainerBookCustomPhone("");
                  }
                }}
              >
                <MenuItem value="">Custom booking</MenuItem>
                {clients
                  .filter((clientRel) => clientRel.accepted)
                  .map((clientRel) => (
                    <MenuItem key={clientRel.client._id} value={clientRel.client._id}>
                      {clientRel.client.firstName} {clientRel.client.lastName}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Session type</InputLabel>
              <Select
                label="Session type"
                value={trainerBookSessionTypeId}
                onChange={(event) => setTrainerBookSessionTypeId(event.target.value)}
              >
                <MenuItem value="">No session type</MenuItem>
                {orderTypesByCredits(sessionTypes, trainerBookCreditsByType).map((type) => (
                  <MenuItem key={type._id} value={type._id}>
                    {sessionTypeLabel(type)}
                    {creditSuffix(type, trainerBookCreditsByType)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <InvoiceShortfallPrompt
              shortfall={trainerBookInvoiceShortfall}
              checked={trainerBookCreateInvoice}
              onChange={setTrainerBookCreateInvoice}
            />
            {!trainerBookClientId && (
              <Stack spacing={1}>
                <TextField
                  label="Name"
                  value={trainerBookCustomName}
                  onChange={(event) => setTrainerBookCustomName(event.target.value)}
                />
                <TextField
                  label="Email"
                  value={trainerBookCustomEmail}
                  onChange={(event) => setTrainerBookCustomEmail(event.target.value)}
                />
                <TextField
                  label="Phone"
                  value={trainerBookCustomPhone}
                  onChange={(event) => setTrainerBookCustomPhone(event.target.value)}
                />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTrainerBookDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleTrainerBookSlot}
            disabled={
              trainerBookingStartOptions.length === 0 ||
              !trainerBookSlot ||
              !trainerBookEndSlot ||
              (!trainerBookClientId && !trainerBookCustomName.trim())
            }
          >
            Book
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
