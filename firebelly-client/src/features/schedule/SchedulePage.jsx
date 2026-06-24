import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import CalendarHoursDialog from "./components/CalendarHoursDialog";
import CopyShareDialogs from "./components/CopyShareDialogs";
import DeleteEventDialog from "./components/DeleteEventDialog";
import EventActionDialogs from "./components/EventActionDialogs";
import ScheduleControlsCard from "./components/ScheduleControlsCard";
import SellPackageDialog from "./components/SellPackageDialog";
import ClientAccessDialog from "./components/ClientAccessDialog";
import SessionEventsTable from "./components/SessionEventsTable";
import SessionTypeDialogs from "./components/SessionTypeDialogs";
import SchedulePageHeader from "./components/SchedulePageHeader";
import ScheduleTableFilterMenu from "./components/ScheduleTableFilterMenu";
import UnassignedWorkoutsPanel from "./components/UnassignedWorkoutsPanel";
import WeekCalendar from "./components/WeekCalendar";
import AgendaView from "./components/AgendaView";
import CalendarSubscribeDialog from "./components/CalendarSubscribeDialog";
import WeekNavigator from "./components/WeekNavigator";
import usePersistentSchedulePreference from "./hooks/usePersistentSchedulePreference";
import useScheduleClipboardShare from "./hooks/useScheduleClipboardShare";
import useScheduleBilling from "./hooks/useScheduleBilling";
import { billingApi } from "../../api/billingApi";
import useScheduleRange from "./hooks/useScheduleRange";
import useScheduleSelection from "./hooks/useScheduleSelection";
import useScheduleTableFilters from "./hooks/useScheduleTableFilters";
import useScheduleWorkouts from "./hooks/useScheduleWorkouts";
import useSessionTypes from "./hooks/useSessionTypes";
import {
  cancelScheduleEvent,
  createTrainingForAccount,
  createScheduleEvent,
  requestWorkoutsByMonth,
  requestBooking,
  requestClients,
  requestMyTrainers,
  requestScheduleRange,
  requestWorkoutQueue,
  trainerBookAvailability,
  serverURL,
  deleteScheduleEvent,
  deleteScheduleSeries,
  updateScheduleEvent,
} from "../../Redux/actions";

dayjs.extend(utc);

// Generate a MongoDB-compatible ObjectId hex string (client-side) so recurring
// bookings created in one batch share a recurrenceGroupId (a series).
const generateObjectId = () => {
  const timestamp = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, "0");
  const tail = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return timestamp + tail;
};

import {
  DEFAULT_BOOKING_MINUTES,
  EMPTY_SCHEDULE_DATA,
  EMPTY_WORKOUT_QUEUE_BY_ACCOUNT,
  EMPTY_WORKOUTS,
  EMPTY_WORKOUTS_BY_ACCOUNT,
  SLOT_HEIGHT,
  SLOT_MINUTES,
  WEEK_END_HOUR,
  WEEK_START_HOUR,
  tableColumnLabels,
} from "./constants";
import {
  buildBookingEndOptions,
  buildBookingStartOptions,
  buildScopeKey,
  buildWeeklyRule,
  formatRange,
  pickDefaultBookingEnd,
} from "./utils/scheduleUtils";


export default function Schedule() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const clients = useSelector((state) => state.clients);
  const myTrainers = useSelector((state) => state.myTrainers);
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [selectedMyTrainerId, setSelectedMyTrainerId] = useState("");
  const [bookingAsClient, setBookingAsClient] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [hasClientSelection, setHasClientSelection] = useState(false);
  const [openAvailabilityDialog, setOpenAvailabilityDialog] = useState(false);
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [openAttachDialog, setOpenAttachDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openEventActionDialog, setOpenEventActionDialog] = useState(false);
  const [eventActionTarget, setEventActionTarget] = useState(null);
  const [eventActionAnchor, setEventActionAnchor] = useState(null);
  const [openTrainerBookDialog, setOpenTrainerBookDialog] = useState(false);
  const [trainerBookSlot, setTrainerBookSlot] = useState("");
  const [trainerBookEndSlot, setTrainerBookEndSlot] = useState("");
  const [trainerBookClientId, setTrainerBookClientId] = useState("");
  const [trainerBookCustomName, setTrainerBookCustomName] = useState("");
  const [trainerBookCustomEmail, setTrainerBookCustomEmail] = useState("");
  const [trainerBookCustomPhone, setTrainerBookCustomPhone] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [activeRequestEvent, setActiveRequestEvent] = useState(null);
  const [attachEvent, setAttachEvent] = useState(null);
  const [editEvent, setEditEvent] = useState(null);
  const [deleteEvent, setDeleteEvent] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState("");

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [availabilityType, setAvailabilityType] = useState("MANUAL");
  const [availabilityRecurrence, setAvailabilityRecurrence] = useState("none");

  const [bookingType, setBookingType] = useState("one-time");
  const [selectedBookingSlot, setSelectedBookingSlot] = useState("");
  const [selectedBookingEndSlot, setSelectedBookingEndSlot] = useState("");
  const [editDate, setEditDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("10:00");
  const [editStatus, setEditStatus] = useState("OPEN");
  const [editClientId, setEditClientId] = useState("");
  const [editWorkoutId, setEditWorkoutId] = useState("");
  const [editCustomName, setEditCustomName] = useState("");
  const [editCustomEmail, setEditCustomEmail] = useState("");
  const [editCustomPhone, setEditCustomPhone] = useState("");
  const [editPublicLabel, setEditPublicLabel] = useState("");
  const [editSessionTypeId, setEditSessionTypeId] = useState("");
  const [editPriceAmount, setEditPriceAmount] = useState("");
  const [editPriceCurrency, setEditPriceCurrency] = useState("USD");
  const [editPayoutAmount, setEditPayoutAmount] = useState("");
  const [editPayoutCurrency, setEditPayoutCurrency] = useState("USD");
  const [quickBookClientId, setQuickBookClientId] = useState("");
  const [quickBookWorkoutId, setQuickBookWorkoutId] = useState("");
  const [quickBookCustomName, setQuickBookCustomName] = useState("");
  const [quickBookCustomEmail, setQuickBookCustomEmail] = useState("");
  const [quickBookCustomPhone, setQuickBookCustomPhone] = useState("");
  const [quickBookSessionTypeId, setQuickBookSessionTypeId] = useState("");
  const [quickBookPrice, setQuickBookPrice] = useState("");
  const [quickBookPriceCurrency, setQuickBookPriceCurrency] = useState("USD");
  const [quickBookPayout, setQuickBookPayout] = useState("");
  const [quickBookPayoutCurrency, setQuickBookPayoutCurrency] = useState("USD");
  const [quickBookRecurring, setQuickBookRecurring] = useState(false);
  const [quickBookRecurUntil, setQuickBookRecurUntil] = useState("");
  const [quickBookClientSummary, setQuickBookClientSummary] = useState(null);
  const [openSelectionDialog, setOpenSelectionDialog] = useState(false);
  const [openSellPackageDialog, setOpenSellPackageDialog] = useState(false);
  const [openClientAccessDialog, setOpenClientAccessDialog] = useState(false);
  const [openCopyDialog, setOpenCopyDialog] = useState(false);
  const [copySourceEvent, setCopySourceEvent] = useState(null);
  const [copyDate, setCopyDate] = useState("");
  const [copyStartTime, setCopyStartTime] = useState("");
  const [copyEndTime, setCopyEndTime] = useState("");
  const [openCopyDayDialog, setOpenCopyDayDialog] = useState(false);
  const [openCopyWeekDialog, setOpenCopyWeekDialog] = useState(false);
  const [copyDayDate, setCopyDayDate] = useState("");
  const [copyDaySourceDate, setCopyDaySourceDate] = useState("");
  const [copyWeekDate, setCopyWeekDate] = useState("");
  const [openShareDialog, setOpenShareDialog] = useState(false);
  const [shareHideDetails, setShareHideDetails] = useState(true);
  const [shareIncludeHeader, setShareIncludeHeader] = useState(true);
  const [shareInProgress, setShareInProgress] = useState(false);
  const [calendarMenuAnchor, setCalendarMenuAnchor] = useState(null);
  const [shareStatus, setShareStatus] = useState("");
  const [isShareMode, setIsShareMode] = useState(false);
  const [shareLinkStatus, setShareLinkStatus] = useState("");
  const [shareShownKeys, setShareShownKeys] = useState([]);
  const [shareHighlightShown, setShareHighlightShown] = useState(false);
  const [shareHighlightColor, setShareHighlightColor] = useState("#ffc107");
  const [shareHidePrices, setShareHidePrices] = useState(true);
  const [shareWeekStartDate, setShareWeekStartDate] = useState("");
  const [shareEvents, setShareEvents] = useState([]);
  const [openTimeSettings, setOpenTimeSettings] = useState(false);
  const [calendarStartHour, setCalendarStartHour] = useState(WEEK_START_HOUR);
  const [calendarEndHour, setCalendarEndHour] = useState(WEEK_END_HOUR);
  const [draftStartHour, setDraftStartHour] = useState(WEEK_START_HOUR);
  const [draftEndHour, setDraftEndHour] = useState(WEEK_END_HOUR);
  const [calendarScale, setCalendarScale] = usePersistentSchedulePreference(
    "schedule.calendarScale",
    1
  );
  const [viewMode, setViewMode] = usePersistentSchedulePreference(
    "schedule.viewMode",
    typeof window !== "undefined" && window.innerWidth < 768 ? "agenda" : "calendar"
  );
  const [openSubscribe, setOpenSubscribe] = useState(false);
  const [trainerBookSessionTypeId, setTrainerBookSessionTypeId] = useState("");

  const weekCaptureRef = useRef(null);
  const weekPickerRef = useRef(null);
  const weekScrollRef = useRef(null);
  const totalsScrollRef = useRef(null);
  const syncingScrollRef = useRef(false);

  const isTrainerView = user.isTrainer && !bookingAsClient;
  const isClientView = !isTrainerView;
  const defaultSessionLength = user?.defaultSessionLengthMinutes || DEFAULT_BOOKING_MINUTES;
  const {
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
  } = useSessionTypes({ isTrainer: user.isTrainer });

  useEffect(() => {
    if (user.isTrainer) {
      dispatch(requestClients());
      dispatch(requestMyTrainers());
    } else {
      dispatch(requestMyTrainers());
    }
  }, [dispatch, user.isTrainer]);

  useEffect(() => {
    if (!user.isTrainer) return;
    if (bookingAsClient && selectedMyTrainerId) {
      setSelectedTrainerId(selectedMyTrainerId);
      return;
    }
    if (bookingAsClient && !selectedMyTrainerId) {
      setSelectedTrainerId("");
      return;
    }
    if (!bookingAsClient) {
      setSelectedTrainerId(user._id);
    }
  }, [bookingAsClient, selectedMyTrainerId, user._id, user.isTrainer]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const clientId = params.get("client");
    const trainerId = params.get("trainer");

    if (isTrainerView && clientId) {
      setSelectedClientIds([clientId]);
      setHasClientSelection(true);
    }
    if (isClientView && trainerId) {
      setSelectedTrainerId(trainerId);
      if (user.isTrainer) {
        setSelectedMyTrainerId(trainerId);
      }
    }
  }, [isClientView, isTrainerView, location.search, user.isTrainer]);

  const clientParam = new URLSearchParams(location.search).get("client");
  const selectedClientLabel = clients.find(
    (clientRel) => clientRel.client?._id === selectedClientIds[0]
  );

  const {
    billingSummary,
    billingLoading,
    selectedTypeEntry,
    selectedTypeName,
    refreshBillingSummary,
  } = useScheduleBilling({
    isTrainerView,
    userId: user._id,
    selectedTrainerId,
    selectedClientIds,
    openEditDialog,
    editSessionTypeId,
    openSelectionDialog,
    quickBookSessionTypeId,
    openTrainerBookDialog,
    trainerBookSessionTypeId,
    sessionTypeLookup,
  });

  const handleClearClientFilter = () => {
    setSelectedClientIds([]);
    setHasClientSelection(true);
    navigate("/sessions");
  };

  useEffect(() => {
    if (user.isTrainer && !bookingAsClient) return;
    if (myTrainers?.length && !selectedTrainerId) {
      const firstAccepted = myTrainers.find((trainer) => trainer.accepted);
      if (firstAccepted) {
        setSelectedTrainerId(firstAccepted.trainer);
        if (user.isTrainer) {
          setSelectedMyTrainerId(firstAccepted.trainer);
        }
      }
    }
  }, [bookingAsClient, myTrainers, selectedTrainerId, user.isTrainer]);

  const refreshSchedule = () => {
    const effectiveTrainerId = isTrainerView ? user._id : selectedTrainerId;
    if (!effectiveTrainerId) return;
    const visibleWeekStart = selectedDate.startOf("week").startOf("day");
    const visibleWeekEnd = visibleWeekStart.add(7, "day").startOf("day");
    const requestedClientId =
      isTrainerView && selectedClientIds.length === 1 ? selectedClientIds[0] : null;
    dispatch(
      requestScheduleRange({
        startDate: visibleWeekStart.toISOString(),
        endDate: visibleWeekEnd.toISOString(),
        trainerId: effectiveTrainerId,
        clientId: isTrainerView ? requestedClientId : user._id,
        includeAvailability: true,
      })
    );
    refreshBillingSummary();
  };

  useEffect(() => {
    refreshSchedule();
  }, [dispatch, isTrainerView, selectedDate, selectedTrainerId, selectedClientIds, user._id]);

  const scopeKey = buildScopeKey(
    isTrainerView ? user._id : selectedTrainerId,
    isTrainerView ? (selectedClientIds.length === 1 ? selectedClientIds[0] : null) : user._id
  );

  const scheduleData =
    useSelector((state) => state.scheduleEvents?.[scopeKey]) || EMPTY_SCHEDULE_DATA;
  const workoutsByAccount =
    useSelector((state) => state.workouts) || EMPTY_WORKOUTS_BY_ACCOUNT;
  const workoutQueue =
    useSelector((state) => state.workoutQueue) || EMPTY_WORKOUT_QUEUE_BY_ACCOUNT;

  const clientLookup = useMemo(
    () =>
      new Map(
        clients.map((clientRel) => [
          clientRel.client?._id,
          `${clientRel.client?.firstName || ""} ${clientRel.client?.lastName || ""}`.trim(),
        ])
      ),
    [clients]
  );
  const clientProfileLookup = useMemo(
    () => new Map(clients.map((clientRel) => [clientRel.client?._id, clientRel.client])),
    [clients]
  );
  const selectedTrainerLabel = useMemo(() => {
    const trainer = myTrainers.find((item) => item.trainer === selectedTrainerId);
    if (!trainer) return "";
    return `${trainer.firstName} ${trainer.lastName}`.trim();
  }, [myTrainers, selectedTrainerId]);
  const getEventDisplayName = useCallback(
    (event) => {
      if (isShareMode && shareHideDetails) {
        if (event?.clientId && shareShownKeys.includes(`client:${event.clientId}`)) {
          return clientLookup.get(event.clientId) || "Booked";
        }
        if (
          event?.customClientName &&
          shareShownKeys.includes(`custom:${event.customClientName}`)
        ) {
          return event.customClientName;
        }
        return event?.publicLabel || "Booked";
      }
      if (isTrainerView) {
        if (event?.customClientName) return event.customClientName;
        if (event?.clientId) return clientLookup.get(event.clientId) || "Assigned client";
        return "Booked";
      }
      if (String(event?.clientId) === String(user._id)) {
        return `${user.firstName || ""} ${user.lastName || ""}`.trim();
      }
      return "Booked";
    },
    [
      clientLookup,
      isShareMode,
      shareHideDetails,
      shareShownKeys,
      isTrainerView,
      user._id,
      user.firstName,
      user.lastName,
    ]
  );
  const getSessionTypeLabel = useCallback(
    (event) => {
      if (!event?.sessionTypeId) return "";
      const type = sessionTypeLookup.get(event.sessionTypeId);
      return type?.name || "Session type";
    },
    [sessionTypeLookup]
  );
  const highlightFill = useMemo(() => {
    const hex = shareHighlightColor.replace("#", "");
    if (hex.length !== 6) return "rgba(255, 193, 7, 0.35)";
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.35)`;
  }, [shareHighlightColor]);

  const {
    queueTargetEventId,
    setQueueTargetEventId,
    selectedQueueSlot,
    setSelectedQueueSlot,
    selectedQueueEndSlot,
    setSelectedQueueEndSlot,
    activeClientIds,
    attachAccountId,
    visibleQueuedWorkouts,
    attachWorkouts,
    attachQueuedWorkouts,
    filteredDayEvents,
    attachableEvents,
    queueTargetEvent,
    queueBookingStartOptions,
    queueBookingEndOptions,
  } = useScheduleWorkouts({
    dispatch,
    user,
    isTrainerView,
    selectedClientIds,
    selectedDate,
    scheduleData,
    attachEvent,
    workoutsByAccount,
    workoutQueue,
  });

  const handleOpenAvailability = () => {
    setAvailabilityType("MANUAL");
    setAvailabilityRecurrence("none");
    // Pre-fill the end time to start + the trainer's default session length.
    setEndTime(
      dayjs(`2000-01-01T${startTime}`).add(defaultSessionLength, "minute").format("HH:mm")
    );
    setOpenAvailabilityDialog(true);
  };

  const handleCreateAvailability = async () => {
    if (!isTrainerView) return;
    if (!selectedTrainerId) return;
    const dateBase = selectedDate.format("YYYY-MM-DD");
    const startDateTime = dayjs(`${dateBase}T${startTime}`).toISOString();
    const endDateTime = dayjs(`${dateBase}T${endTime}`).toISOString();
    const isNormal = availabilityType === "NORMAL";
    const isRecurring = availabilityRecurrence === "weekly";

    await dispatch(
      createScheduleEvent({
        startDateTime,
        endDateTime,
        eventType: "AVAILABILITY",
        status: "OPEN",
        availabilitySource: isNormal ? "NORMAL" : "MANUAL",
        recurrenceRule: isRecurring ? buildWeeklyRule(selectedDate) : null,
      })
    );

    setOpenAvailabilityDialog(false);
    refreshSchedule();
  };

  const handleRequestBooking = async () => {
    if (!activeRequestEvent) return;
    const isRecurring = bookingType === "recurring";
    const start = bookingStartOptions.find((item) => item.value === selectedBookingSlot);
    const end = bookingEndOptions.find((item) => item.value === selectedBookingEndSlot);
    const bookingStart = start ? start.time.toISOString() : activeRequestEvent.startDateTime;
    const bookingEnd = end ? end.time.toISOString() : activeRequestEvent.endDateTime;
    await dispatch(
      requestBooking({
        availabilityEventId: activeRequestEvent._id,
        trainerId: activeRequestEvent.trainerId,
        startDateTime: bookingStart,
        endDateTime: bookingEnd,
        isRecurring,
        recurrenceRule: isRecurring ? activeRequestEvent.recurrenceRule : null,
      })
    );
    setOpenRequestDialog(false);
    setActiveRequestEvent(null);
    refreshSchedule();
  };

  const handleCancelEvent = async (eventId) => {
    await dispatch(cancelScheduleEvent(eventId));
    refreshSchedule();
  };

  const handleDeleteEvent = async (eventId) => {
    if (!eventId) return;
    setDeleting(true);
    try {
      await dispatch(deleteScheduleEvent(eventId));
      setOpenDeleteDialog(false);
      setDeleteEvent(null);
      refreshSchedule();
    } finally {
      setDeleting(false);
    }
  };

  // Delete a recurring series: scope "future" removes this and all later
  // occurrences; "all" removes the entire series.
  const handleDeleteSeries = async (event, scope = "future") => {
    if (!event?.recurrenceGroupId) return;
    setDeleting(true);
    try {
      const fromDate = scope === "future" ? event.startDateTime : null;
      await dispatch(deleteScheduleSeries(event.recurrenceGroupId, fromDate));
      setOpenDeleteDialog(false);
      setDeleteEvent(null);
      refreshSchedule();
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteConfirm = (event) => {
    setDeleteEvent(event);
    setOpenDeleteDialog(true);
  };

  const handleReopenEvent = async (event) => {
    await dispatch(
      updateScheduleEvent(event._id, {
        clientId: null,
        workoutId: null,
        sessionTypeId: null,
        eventType: "AVAILABILITY",
        status: "OPEN",
      })
    );
    refreshSchedule();
  };

  // Drag-to-reschedule on the calendar (preserves duration; same-day time change).
  const handleRescheduleEvent = async (event, newStartISO, newEndISO) => {
    if (!event?._id) return;
    await dispatch(
      updateScheduleEvent(event._id, {
        startDateTime: newStartISO,
        endDateTime: newEndISO,
      })
    );
    refreshSchedule();
  };

  const openRequestForEvent = (event) => {
    setActiveRequestEvent(event);
    setBookingType("one-time");
    setSelectedBookingSlot("");
    setSelectedBookingEndSlot("");
    setOpenRequestDialog(true);
  };

  const bookingStartOptions = useMemo(
    () => buildBookingStartOptions(activeRequestEvent),
    [activeRequestEvent]
  );

  const bookingEndOptions = useMemo(
    () => buildBookingEndOptions(activeRequestEvent, selectedBookingSlot),
    [activeRequestEvent, selectedBookingSlot]
  );

  useEffect(() => {
    if (bookingStartOptions.length > 0) {
      setSelectedBookingSlot((prev) =>
        bookingStartOptions.some((option) => option.value === prev)
          ? prev
          : bookingStartOptions[0].value
      );
    } else {
      setSelectedBookingSlot("");
    }
  }, [bookingStartOptions]);

  useEffect(() => {
    if (bookingEndOptions.length > 0) {
      setSelectedBookingEndSlot((prev) =>
        bookingEndOptions.some((option) => option.value === prev)
          ? prev
          : pickDefaultBookingEnd(selectedBookingSlot, bookingEndOptions)
      );
    } else {
      setSelectedBookingEndSlot("");
    }
  }, [selectedBookingSlot, bookingEndOptions]);

  const openAttachForEvent = (event) => {
    setAttachEvent(event);
    setSelectedWorkoutId("");
    setOpenAttachDialog(true);

    const date = dayjs(event.startDateTime).format("YYYY-MM-DD");
    if (event.clientId) {
      dispatch(requestWorkoutsByMonth(date, { _id: event.clientId }));
      dispatch(requestWorkoutQueue(event.clientId, date));
      return;
    }
    if (isTrainerView && selectedClientIds.length === 1) {
      dispatch(requestWorkoutsByMonth(date, { _id: selectedClientIds[0] }));
      dispatch(requestWorkoutQueue(selectedClientIds[0], date));
      return;
    }
    if (isTrainerView) {
      activeClientIds.forEach((clientId) => {
        dispatch(requestWorkoutsByMonth(date, { _id: clientId }));
        dispatch(requestWorkoutQueue(clientId, date));
      });
      return;
    }
    dispatch(requestWorkoutsByMonth(date, user));
    dispatch(requestWorkoutQueue(user._id, date));
  };

  const openEditForEvent = (event) => {
    const sessionType = event?.sessionTypeId
      ? sessionTypeLookup.get(event.sessionTypeId)
      : null;
    const defaultPrice =
      sessionType?.defaultPrice === 0 || sessionType?.defaultPrice
        ? String(sessionType.defaultPrice)
        : "";
    const defaultPayout =
      sessionType?.defaultPayout === 0 || sessionType?.defaultPayout
        ? String(sessionType.defaultPayout)
        : "";
    setEditEvent(event);
    setEditDate(dayjs(event.startDateTime).format("YYYY-MM-DD"));
    setEditStartTime(dayjs(event.startDateTime).format("HH:mm"));
    setEditEndTime(dayjs(event.endDateTime).format("HH:mm"));
    setEditStatus(event.status);
    setEditClientId(event.clientId || "");
    setEditWorkoutId(event.workoutId || "");
    setEditCustomName(event.customClientName || "");
    setEditCustomEmail(event.customClientEmail || "");
    setEditCustomPhone(event.customClientPhone || "");
    setEditPublicLabel(event.publicLabel || "");
    setEditSessionTypeId(event.sessionTypeId || "");
    setEditPriceAmount(
      typeof event.priceAmount === "number" ? String(event.priceAmount) : defaultPrice
    );
    setEditPriceCurrency(event.priceCurrency || sessionType?.currency || "USD");
    setEditPayoutAmount(
      typeof event.payoutAmount === "number" ? String(event.payoutAmount) : defaultPayout
    );
    setEditPayoutCurrency(
      event.payoutCurrency || sessionType?.payoutCurrency || event.priceCurrency || "USD"
    );
    setOpenEditDialog(true);
  };

  const openActionForEvent = (event, anchor = null) => {
    setEventActionTarget(event);
    setEventActionAnchor(anchor);
    setOpenEventActionDialog(true);
  };

  // Quick status change from the event popover, no full edit form. An explicit
  // billingStatus lets us distinguish "no-show (charge)" from "cancel (no charge)".
  const handleQuickStatus = async (event, status, billingStatus) => {
    if (!event?._id || !status) return;
    if (status === event.status && billingStatus === undefined) return;
    const updates = { status };
    if (billingStatus !== undefined) updates.billingStatus = billingStatus;
    await dispatch(updateScheduleEvent(event._id, updates));
    setOpenEventActionDialog(false);
    refreshSchedule();
    refreshBillingSummary();
  };

  const openTrainerBookForEvent = (event) => {
    setEventActionTarget(event);
    setTrainerBookSlot("");
    setTrainerBookEndSlot("");
    setTrainerBookClientId("");
    setTrainerBookCustomName("");
    setTrainerBookCustomEmail("");
    setTrainerBookCustomPhone("");
    setTrainerBookSessionTypeId("");
    setOpenTrainerBookDialog(true);
  };

  const editWorkoutClientId = editClientId || editEvent?.clientId || "";
  const editClientProfile = useMemo(
    () => clients.find((clientRel) => clientRel.client?._id === editWorkoutClientId)?.client,
    [clients, editWorkoutClientId]
  );
  const editClientName = editClientProfile
    ? `${editClientProfile.firstName || ""} ${editClientProfile.lastName || ""}`.trim()
    : "";
  const editClientAvatar = editClientProfile?.profilePicture
    ? `${serverURL}/user/profilePicture/${editClientProfile.profilePicture}`
    : undefined;
  const attachedEditWorkout = useMemo(() => {
    if (!editWorkoutClientId || !editEvent?.workoutId) return null;
    const workouts = workoutsByAccount?.[editWorkoutClientId]?.workouts || [];
    const queued = workoutQueue?.[editWorkoutClientId] || [];
    return [...workouts, ...queued].find(
      (workout) => String(workout._id) === String(editEvent.workoutId)
    );
  }, [editEvent?.workoutId, editWorkoutClientId, workoutQueue, workoutsByAccount]);

  useEffect(() => {
    if (!isTrainerView) return;
    if (!openEditDialog) return;
    if (!editWorkoutClientId) return;
    const date = dayjs(editDate).format("YYYY-MM-DD");
    dispatch(requestWorkoutsByMonth(date, { _id: editWorkoutClientId }));
    dispatch(requestWorkoutQueue(editWorkoutClientId, date));
  }, [dispatch, editDate, editWorkoutClientId, isTrainerView, openEditDialog]);

  useEffect(() => {
    if (!openEditDialog) return;
    if (!editWorkoutClientId) {
      setEditWorkoutId("");
      return;
    }
    if (editEvent?.clientId !== editWorkoutClientId) {
      setEditWorkoutId("");
    }
  }, [editEvent?.clientId, editWorkoutClientId, openEditDialog]);

  const handleCalendarMenuClose = () => setCalendarMenuAnchor(null);

  const getDefaultPriceValue = (typeId) => {
    if (!typeId) return null;
    const type = sessionTypeLookup.get(typeId);
    if (!type) return null;
    const hasDefault =
      type.defaultPrice === 0 || type.defaultPrice || type.defaultPrice === "0";
    if (!hasDefault) return null;
    return { amount: String(type.defaultPrice), currency: type.currency || "USD" };
  };

  const getDefaultPayoutValue = (typeId) => {
    if (!typeId) return null;
    const type = sessionTypeLookup.get(typeId);
    if (!type) return null;
    const hasDefault =
      type.defaultPayout === 0 || type.defaultPayout || type.defaultPayout === "0";
    if (!hasDefault) return null;
    return { amount: String(type.defaultPayout), currency: type.payoutCurrency || "USD" };
  };

  const applyDefaultPriceForType = (
    nextTypeId,
    prevTypeId,
    currentAmount,
    setAmount,
    setCurrency
  ) => {
    const nextDefault = getDefaultPriceValue(nextTypeId);
    const prevDefault = getDefaultPriceValue(prevTypeId);
    const shouldUpdate =
      currentAmount === "" ||
      (prevDefault && String(currentAmount) === String(prevDefault.amount));
    if (!shouldUpdate) return;
    if (!nextDefault) {
      setAmount("");
      return;
    }
    setAmount(String(nextDefault.amount));
    if (nextDefault.currency) setCurrency(nextDefault.currency);
  };

  const applyDefaultPayoutForType = (
    nextTypeId,
    prevTypeId,
    currentAmount,
    setAmount,
    setCurrency
  ) => {
    const nextDefault = getDefaultPayoutValue(nextTypeId);
    const prevDefault = getDefaultPayoutValue(prevTypeId);
    const shouldUpdate =
      currentAmount === "" ||
      (prevDefault && String(currentAmount) === String(prevDefault.amount));
    if (!shouldUpdate) return;
    if (!nextDefault) {
      setAmount("");
      return;
    }
    setAmount(String(nextDefault.amount));
    if (nextDefault.currency) setCurrency(nextDefault.currency);
  };

  const handleSaveEdit = async () => {
    if (!editEvent) return;
    const startDateTime = dayjs(`${editDate}T${editStartTime}`).toISOString();
    const endDateTime = dayjs(`${editDate}T${editEndTime}`).toISOString();
    if (dayjs(endDateTime).valueOf() <= dayjs(startDateTime).valueOf()) return;
    const customName = editCustomName.trim();
    const updates = {
      startDateTime,
      endDateTime,
      publicLabel: editPublicLabel.trim(),
      customClientName: customName,
      customClientEmail: editCustomEmail.trim(),
      customClientPhone: editCustomPhone.trim(),
      priceAmount:
        editPriceAmount === "" ? null : Number.parseFloat(editPriceAmount),
      priceCurrency: editPriceCurrency || "USD",
    };
    if (editEvent.eventType === "AVAILABILITY" && (editClientId || customName)) {
      updates.clientId = editClientId || null;
      updates.eventType = "APPOINTMENT";
      updates.status = "BOOKED";
      if (editClientId) {
        updates.customClientName = "";
        updates.customClientEmail = "";
        updates.customClientPhone = "";
      }
    } else {
      updates.status = editStatus;
      if (editClientId) {
        updates.clientId = editClientId;
      }
    }
    if (editWorkoutId) {
      updates.workoutId = editWorkoutId;
    } else if (editEvent?.workoutId) {
      updates.workoutId = null;
    }
    updates.payoutAmount =
      editPayoutAmount === "" ? null : Number.parseFloat(editPayoutAmount);
    updates.payoutCurrency = editPayoutCurrency || "USD";
    updates.sessionTypeId = editSessionTypeId || null;
    setSavingEdit(true);
    try {
      await dispatch(
        updateScheduleEvent(editEvent._id, {
          ...updates,
        })
      );
      setOpenEditDialog(false);
      setEditEvent(null);
      refreshSchedule();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateWorkoutForEdit = async () => {
    if (!editWorkoutClientId || !editEvent) return;
    const created = await dispatch(
      createTrainingForAccount({
        training: { date: dayjs(editDate).toISOString() },
        accountId: editWorkoutClientId,
      })
    );
    if (created?._id) {
      setEditWorkoutId(created._id);
      await dispatch(updateScheduleEvent(editEvent._id, { workoutId: created._id }));
      refreshSchedule();
    }
  };

  useEffect(() => {
    if (!isTrainerView || !quickBookClientId) return;
    const date = selectedDate.format("YYYY-MM-DD");
    dispatch(requestWorkoutsByMonth(date, { _id: quickBookClientId }));
    dispatch(requestWorkoutQueue(quickBookClientId, date));
  }, [dispatch, isTrainerView, quickBookClientId, selectedDate]);

  useEffect(() => {
    setQuickBookWorkoutId("");
  }, [quickBookClientId]);

  const quickBookWorkouts = useMemo(
    () => workoutsByAccount?.[quickBookClientId]?.workouts || EMPTY_WORKOUTS,
    [quickBookClientId, workoutsByAccount]
  );
  const quickBookQueuedWorkouts = useMemo(
    () => workoutQueue?.[quickBookClientId] || EMPTY_WORKOUTS,
    [quickBookClientId, workoutQueue]
  );

  // Selecting a session type auto-fills price, payout, and duration (all still
  // editable for grandfathered-client overrides). Done on change (not in an effect)
  // so manual edits afterward are never clobbered.
  const handleSelectQuickBookSessionType = (typeId) => {
    setQuickBookSessionTypeId(typeId);
    const type = sessionTypes.find((t) => t._id === typeId);
    if (!type) return;
    setQuickBookPrice(type.defaultPrice != null ? String(type.defaultPrice) : "");
    setQuickBookPriceCurrency(type.currency || "USD");
    setQuickBookPayout(type.defaultPayout != null ? String(type.defaultPayout) : "");
    setQuickBookPayoutCurrency(type.payoutCurrency || "USD");
    if (type.durationMinutes && selectionStartTime) {
      setSelectionEndTime(
        dayjs(`2000-01-01T${selectionStartTime}`)
          .add(type.durationMinutes, "minute")
          .format("HH:mm")
      );
    }
  };

  // Expand the booking into weekly occurrences when "repeat weekly" is on and an end
  // date is set. Each occurrence is created as its own appointment (the calendar has no
  // recurrence expansion). Capped at 26 for safety.
  const buildBookingOccurrences = () => {
    const baseStart = selectionRangeAdjusted.start;
    const baseEnd = selectionRangeAdjusted.end;
    if (!quickBookRecurring || !quickBookRecurUntil) {
      return [{ start: baseStart, end: baseEnd }];
    }
    const until = dayjs(quickBookRecurUntil).endOf("day");
    const out = [];
    for (let i = 0; i < 26; i++) {
      const start = baseStart.add(i * 7, "day");
      if (start.isAfter(until)) break;
      out.push({ start, end: baseEnd.add(i * 7, "day") });
    }
    return out.length ? out : [{ start: baseStart, end: baseEnd }];
  };

  const quickBookPricingFields = (recurrenceGroupId = null) => ({
    sessionTypeId: quickBookSessionTypeId || null,
    priceAmount: quickBookPrice === "" ? null : Number(quickBookPrice),
    priceCurrency: quickBookPriceCurrency,
    payoutAmount: quickBookPayout === "" ? null : Number(quickBookPayout),
    payoutCurrency: quickBookPayoutCurrency,
    ...(recurrenceGroupId ? { recurrenceGroupId } : {}),
  });

  const handleQuickBookClient = async () => {
    if (!isTrainerView || !selectionRangeAdjusted || !quickBookClientId) return;
    const occurrences = buildBookingOccurrences();
    const groupId = occurrences.length > 1 ? generateObjectId() : null;
    for (const occ of occurrences) {
      const payload = {
        startDateTime: occ.start.toISOString(),
        endDateTime: occ.end.toISOString(),
        eventType: "APPOINTMENT",
        status: "BOOKED",
        clientId: quickBookClientId,
        ...quickBookPricingFields(groupId),
      };
      // Only attach the chosen workout to a single (non-recurring) booking.
      if (quickBookWorkoutId && occurrences.length === 1) {
        payload.workoutId = quickBookWorkoutId;
      }
      await dispatch(createScheduleEvent(payload));
    }
    setDragSelection(null);
    setOpenSelectionDialog(false);
    resetSelectionBookingForm();
    refreshSchedule();
  };

  const handleQuickBookCustom = async () => {
    if (!isTrainerView || !selectionRangeAdjusted || !quickBookCustomName.trim()) return;
    const occurrences = buildBookingOccurrences();
    const groupId = occurrences.length > 1 ? generateObjectId() : null;
    for (const occ of occurrences) {
      await dispatch(
        createScheduleEvent({
          startDateTime: occ.start.toISOString(),
          endDateTime: occ.end.toISOString(),
          eventType: "APPOINTMENT",
          status: "BOOKED",
          customClientName: quickBookCustomName.trim(),
          customClientEmail: quickBookCustomEmail.trim(),
          customClientPhone: quickBookCustomPhone.trim(),
          ...quickBookPricingFields(groupId),
        })
      );
    }
    setDragSelection(null);
    setOpenSelectionDialog(false);
    resetSelectionBookingForm();
    refreshSchedule();
  };

  const handleQuickBookCreateWorkout = async () => {
    if (!isTrainerView || !selectionRangeAdjusted || !quickBookClientId) return;
    const created = await dispatch(
      createTrainingForAccount({
        training: { date: selectionRangeAdjusted.start.toISOString() },
        accountId: quickBookClientId,
      })
    );
    if (!created?._id) return;
    await dispatch(
      createScheduleEvent({
        startDateTime: selectionRangeAdjusted.start.toISOString(),
        endDateTime: selectionRangeAdjusted.end.toISOString(),
        eventType: "APPOINTMENT",
        status: "BOOKED",
        clientId: quickBookClientId,
        workoutId: created._id,
        ...quickBookPricingFields(),
      })
    );
    setDragSelection(null);
    setOpenSelectionDialog(false);
    resetSelectionBookingForm();
    refreshSchedule();
  };

  const handleAttachWorkout = async () => {
    if (!attachEvent || !selectedWorkoutId) return;
    const allAttachWorkouts = [...attachWorkouts, ...attachQueuedWorkouts];
    const selectedWorkout = allAttachWorkouts.find((workout) => workout._id === selectedWorkoutId);
    const selectedWorkoutUserId =
      typeof selectedWorkout?.user === "object" ? selectedWorkout?.user?._id : selectedWorkout?.user;
    const updates =
      attachEvent.eventType === "AVAILABILITY"
        ? {
          workoutId: selectedWorkoutId,
          clientId: selectedWorkoutUserId || selectedClientIds[0],
          eventType: "APPOINTMENT",
          status: "BOOKED",
        }
        : { workoutId: selectedWorkoutId };
    await dispatch(updateScheduleEvent(attachEvent._id, updates));
    setOpenAttachDialog(false);
    setAttachEvent(null);
    refreshSchedule();
  };

  const handleCreateWorkout = async () => {
    if (!attachEvent) return;
    const created = await dispatch(
      createTrainingForAccount({
        training: { date: attachEvent.startDateTime },
        accountId: attachAccountId,
      })
    );
    if (created?._id) {
      await dispatch(updateScheduleEvent(attachEvent._id, { workoutId: created._id }));
      setOpenAttachDialog(false);
      setAttachEvent(null);
      refreshSchedule();
    }
  };

  const trainerBookingStartOptions = useMemo(
    () => buildBookingStartOptions(eventActionTarget),
    [eventActionTarget]
  );

  const trainerBookingEndOptions = useMemo(
    () => buildBookingEndOptions(eventActionTarget, trainerBookSlot),
    [eventActionTarget, trainerBookSlot]
  );

  useEffect(() => {
    if (!openTrainerBookDialog) return;
    if (trainerBookingStartOptions.length > 0) {
      setTrainerBookSlot((prev) =>
        trainerBookingStartOptions.some((option) => option.value === prev)
          ? prev
          : trainerBookingStartOptions[0].value
      );
    } else {
      setTrainerBookSlot("");
    }
  }, [openTrainerBookDialog, trainerBookingStartOptions]);

  // Session type duration wins when one is selected; otherwise the trainer's default length.
  const trainerBookDuration =
    sessionTypes.find((type) => type._id === trainerBookSessionTypeId)?.durationMinutes ||
    defaultSessionLength;

  useEffect(() => {
    if (!openTrainerBookDialog) return;
    if (trainerBookingEndOptions.length > 0) {
      // Re-default whenever the start or effective duration changes (incl. switching
      // session type). Manual end-slot edits don't alter these deps, so they persist.
      setTrainerBookEndSlot(
        pickDefaultBookingEnd(trainerBookSlot, trainerBookingEndOptions, trainerBookDuration)
      );
    } else {
      setTrainerBookEndSlot("");
    }
  }, [openTrainerBookDialog, trainerBookSlot, trainerBookingEndOptions, trainerBookDuration]);

  const handleAttachQueuedWorkout = async (workoutId) => {
    const targetEvent = attachableEvents.find((event) => event._id === queueTargetEventId);
    if (!targetEvent) return;
    const workoutMatch = visibleQueuedWorkouts.find((workout) => workout._id === workoutId);
    const workoutUserId =
      typeof workoutMatch?.user === "object" ? workoutMatch?.user?._id : workoutMatch?.user;
    if (targetEvent.eventType === "AVAILABILITY") {
      const start = queueBookingStartOptions.find((item) => item.value === selectedQueueSlot);
      const end = queueBookingEndOptions.find((item) => item.value === selectedQueueEndSlot);
      if (!start || !end) return;
      await dispatch(
        trainerBookAvailability({
          availabilityEventId: targetEvent._id,
          clientId: workoutUserId,
          startDateTime: start.time.toISOString(),
          endDateTime: end.time.toISOString(),
          workoutId,
        })
      );
    } else {
      await dispatch(updateScheduleEvent(targetEvent._id, { workoutId }));
    }
    if (isTrainerView) {
      await Promise.all(
        activeClientIds.map((clientId) =>
          dispatch(requestWorkoutQueue(clientId, selectedDate.startOf("week").format("YYYY-MM-DD")))
        )
      );
    }
    refreshSchedule();
  };

  const handleTrainerBookSlot = async () => {
    if (!eventActionTarget || eventActionTarget.eventType !== "AVAILABILITY") return;
    const start = trainerBookingStartOptions.find((item) => item.value === trainerBookSlot);
    const end = trainerBookingEndOptions.find((item) => item.value === trainerBookEndSlot);
    if (!start || !end) return;
    const hasCustomName = Boolean(trainerBookCustomName.trim());
    if (!trainerBookClientId && !hasCustomName) return;

    await dispatch(
      trainerBookAvailability({
        availabilityEventId: eventActionTarget._id,
        clientId: trainerBookClientId || null,
        startDateTime: start.time.toISOString(),
        endDateTime: end.time.toISOString(),
        customClientName: hasCustomName ? trainerBookCustomName.trim() : "",
        customClientEmail: trainerBookCustomEmail.trim(),
        customClientPhone: trainerBookCustomPhone.trim(),
        sessionTypeId: trainerBookSessionTypeId || null,
      })
    );
    setOpenTrainerBookDialog(false);
    setEventActionTarget(null);
    refreshSchedule();
  };

  const currencyAffix = useMemo(() => {
    const currency = editPriceCurrency || "USD";
    switch (currency) {
      case "EUR":
        return { position: "end", label: "€" };
      case "JPY":
        return { position: "start", label: "¥" };
      case "USD":
      default:
        return { position: "start", label: "$" };
    }
  }, [editPriceCurrency]);
  const formatPrice = useCallback((amount, currency) => {
    if (amount == null || Number.isNaN(Number(amount))) return "";
    const value = Number(amount).toFixed(2);
    switch (currency) {
      case "EUR":
        return `${value} €`;
      case "JPY":
        return `¥${value}`;
      case "USD":
      default:
        return `$${value}`;
    }
  }, []);

  const {
    weekStart,
    weekDays,
    weekRangeLabel,
    weekRangeDisplay,
    timeColumnWidth,
    totalSlots,
    calendarContentHeight,
    weekEvents,
    weekClientOptions,
    filteredWeekEvents,
    weekTotals,
    weekCancelledTotals,
    dayTotalsByColumn,
    dayCancelledByColumn,
    dayCountsByColumn,
    weekEventCount,
    weekEventRows,
    formatTotals,
  } = useScheduleRange({
    selectedDate,
    isShareMode,
    shareWeekStartDate,
    calendarStartHour,
    calendarEndHour,
    scheduleData,
    shareEvents,
    clientLookup,
    isTrainerView,
    activeClientIds,
    formatPrice,
  });

  const {
    openCopyForEvent,
    openCopyDay,
    openCopyWeek,
    handleCopyEvent,
    handleCopyDay,
    handleCopyWeek,
    handleShareWeek,
    handleCopyShareLink,
  } = useScheduleClipboardShare({
    dispatch,
    user,
    selectedTrainerId,
    selectedDate,
    weekStart,
    weekEvents,
    filteredWeekEvents,
    weekCaptureRef,
    refreshSchedule,
    isTrainerView,
    copySourceEvent,
    setCopySourceEvent,
    copyDate,
    setCopyDate,
    copyStartTime,
    setCopyStartTime,
    copyEndTime,
    setCopyEndTime,
    setOpenCopyDialog,
    copyDayDate,
    setCopyDayDate,
    copyDaySourceDate,
    setCopyDaySourceDate,
    setOpenCopyDayDialog,
    copyWeekDate,
    setCopyWeekDate,
    setOpenCopyWeekDialog,
    shareWeekStartDate,
    setShareWeekStartDate,
    setShareEvents,
    setShareInProgress,
    setShareStatus,
    setIsShareMode,
    setShareLinkStatus,
  });

  useEffect(() => {
    if (!openShareDialog) return;
    setShareShownKeys([]);
  }, [openShareDialog, weekClientOptions]);

  useEffect(() => {
    if (!openTimeSettings) return;
    setDraftStartHour(calendarStartHour);
    setDraftEndHour(calendarEndHour);
  }, [calendarEndHour, calendarStartHour, openTimeSettings]);

  useEffect(() => {
    const weekNode = weekScrollRef.current;
    const totalsNode = totalsScrollRef.current;
    if (!weekNode || !totalsNode) return;

    const syncScroll = (source, target) => {
      if (syncingScrollRef.current) return;
      syncingScrollRef.current = true;
      target.scrollLeft = source.scrollLeft;
      requestAnimationFrame(() => {
        syncingScrollRef.current = false;
      });
    };

    const onWeekScroll = () => syncScroll(weekNode, totalsNode);
    const onTotalsScroll = () => syncScroll(totalsNode, weekNode);

    weekNode.addEventListener("scroll", onWeekScroll);
    totalsNode.addEventListener("scroll", onTotalsScroll);
    return () => {
      weekNode.removeEventListener("scroll", onWeekScroll);
      totalsNode.removeEventListener("scroll", onTotalsScroll);
    };
  }, []);

  const resetSelectionBookingForm = useCallback(() => {
    setQuickBookClientId("");
    setQuickBookWorkoutId("");
    setQuickBookCustomName("");
    setQuickBookCustomEmail("");
    setQuickBookCustomPhone("");
    setQuickBookSessionTypeId("");
    setQuickBookPrice("");
    setQuickBookPriceCurrency("USD");
    setQuickBookPayout("");
    setQuickBookPayoutCurrency("USD");
    setQuickBookRecurring(false);
    setQuickBookRecurUntil("");
  }, []);

  const {
    setDragSelection,
    normalizedSelection,
    selectionRange,
    selectionRangeAdjusted,
    selectionStartTime,
    setSelectionStartTime,
    selectionEndTime,
    setSelectionEndTime,
    touchSelectionEnabled,
    handleSlotMouseDown,
    handleSlotMouseEnter,
    handleSlotTouchStart,
    handleSlotTouchMove,
    handleSlotTouchEnd,
    handleClearSelection,
  } = useScheduleSelection({
    isTrainerView,
    weekDays,
    calendarStartHour,
    openSelectionDialog,
    setSelectedDate,
    setOpenSelectionDialog,
    onClearSelection: resetSelectionBookingForm,
    defaultSessionMinutes: defaultSessionLength,
  });

  // Warn (non-blocking) when the chosen booking time overlaps an existing
  // appointment for this trainer in the loaded range.
  const bookingConflictLabels = useMemo(() => {
    if (!selectionRangeAdjusted) return [];
    const selStart = selectionRangeAdjusted.start.valueOf();
    const selEnd = selectionRangeAdjusted.end.valueOf();
    return (scheduleData.events || [])
      .filter((event) => {
        if (event.eventType !== "APPOINTMENT") return false;
        if (event.status === "CANCELLED") return false;
        const evStart = dayjs(event.startDateTime).valueOf();
        const evEnd = dayjs(event.endDateTime).valueOf();
        return evStart < selEnd && evEnd > selStart;
      })
      .map((event) => {
        const who = event.clientId
          ? clientLookup.get(event.clientId) || "Client"
          : event.customClientName || "Client";
        return `${who} · ${dayjs(event.startDateTime).format("h:mm")}–${dayjs(
          event.endDateTime
        ).format("h:mm A")}`;
      });
  }, [scheduleData.events, selectionRangeAdjusted, clientLookup]);

  // Fetch the booking pop-up client's prepaid balance (keyed to the pop-up's chosen
  // client, which can differ from the header's filter-selected client).
  useEffect(() => {
    if (!openSelectionDialog || !isTrainerView || !quickBookClientId || !user?._id) {
      setQuickBookClientSummary(null);
      return;
    }
    let cancelled = false;
    billingApi
      .getSummary({ trainerId: user._id, clientId: quickBookClientId })
      .then((data) => {
        if (!cancelled && data && !data.error) setQuickBookClientSummary(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [openSelectionDialog, isTrainerView, quickBookClientId, user?._id]);

  // Remaining prepaid sessions for the chosen client + session type (overall if no type).
  const quickBookRemainingCredits = useMemo(() => {
    if (!quickBookClientSummary) return null;
    if (quickBookSessionTypeId) {
      const entry = (quickBookClientSummary.bySessionType || []).find(
        (e) => e.sessionTypeId === quickBookSessionTypeId
      );
      return entry ? entry.remainingSessions : 0;
    }
    return quickBookClientSummary.remainingSessions ?? null;
  }, [quickBookClientSummary, quickBookSessionTypeId]);

  const getRowClientLabel = useCallback(
    (event) => {
      if (isTrainerView && (event.clientId || event.customClientName)) {
        return getEventDisplayName(event);
      }
      if (isClientView && selectedTrainerId) {
        return selectedTrainerLabel || "Trainer";
      }
      if (event.eventType === "AVAILABILITY") return "Open slot";
      return "—";
    },
    [getEventDisplayName, isClientView, isTrainerView, selectedTrainerId, selectedTrainerLabel]
  );

  const getRowPriceLabel = useCallback(
    (event) => {
      if (event.priceAmount == null) return "No price";
      return formatPrice(event.priceAmount, event.priceCurrency || "USD");
    },
    [formatPrice]
  );
  const getRowPayoutLabel = useCallback(
    (event) => {
      if (event.payoutAmount != null && !Number.isNaN(Number(event.payoutAmount))) {
        return formatPrice(event.payoutAmount, event.payoutCurrency || "USD");
      }
      if (event.priceAmount != null && !Number.isNaN(Number(event.priceAmount))) {
        return formatPrice(event.priceAmount, event.priceCurrency || "USD");
      }
      return "No payout";
    },
    [formatPrice]
  );

  const getRowTimeLabel = useCallback(
    (event) => dayjs(event.startDateTime).format("h:mm A"),
    []
  );

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, index) => index), []);
  const formatHourLabel = useCallback((hour) => dayjs().hour(hour).minute(0).format("h A"), []);
  const timeSettingsError = draftEndHour <= draftStartHour;

  const {
    tableSortKey,
    tableSortDirection,
    tableFilterTypes,
    setTableFilterTypes,
    tableFilterStatuses,
    setTableFilterStatuses,
    tableFilterClients,
    setTableFilterClients,
    tableFilterPrices,
    setTableFilterPrices,
    tableFilterTimes,
    setTableFilterTimes,
    tableFilterClientQuery,
    setTableFilterClientQuery,
    tableFilterDates,
    setTableFilterDates,
    tableFilterAnchor,
    tableFilterKey,
    tableFilterLabel,
    hiddenTableColumns,
    weekTypeOptions,
    weekStatusOptions,
    weekTableClientOptions,
    weekPriceOptions,
    weekTimeOptions,
    sortedWeekRows,
    openTableFilter,
    closeTableFilter,
    toggleTableSort,
    applyTableSort,
    isColumnHidden,
    toggleColumnVisibility,
    showAllColumns,
    isTableFilterActive,
    activeFilterKeys,
    clearTableFilters,
    tableColumnCount,
  } = useScheduleTableFilters({
    weekEventRows,
    calendarStartHour,
    calendarEndHour,
    isTrainerView,
    isShareMode,
    shareHidePrices,
    getRowClientLabel,
    getRowPriceLabel,
    getRowTimeLabel,
    getEventDisplayName,
  });

  const getEventStyle = (event, day) => {
    const dayStart = day.startOf("day");
    const dayEnd = day.add(1, "day").startOf("day");
    const eventStart = dayjs(event.startDateTime);
    const eventEnd = dayjs(event.endDateTime);
    const start = eventStart.isBefore(dayStart) ? dayStart : eventStart;
    const end = eventEnd.isAfter(dayEnd) ? dayEnd : eventEnd;

    const startMinutes = start.diff(dayStart, "minute");
    const endMinutes = end.diff(dayStart, "minute");
    const topMinutes = Math.max(startMinutes - calendarStartHour * 60, 0);
    const bottomMinutes = Math.min(
      endMinutes - calendarStartHour * 60,
      (calendarEndHour - calendarStartHour) * 60
    );

    if (bottomMinutes <= 0 || topMinutes >= (calendarEndHour - calendarStartHour) * 60) return null;

    return {
      top: Math.floor(topMinutes / SLOT_MINUTES) * SLOT_HEIGHT,
      height: Math.max(1, Math.ceil((bottomMinutes - topMinutes) / SLOT_MINUTES) * SLOT_HEIGHT),
    };
  };

  const handleCreateSlotsFromSelection = async () => {
    if (!selectionRangeAdjusted) return;
    if (selectionRangeAdjusted.end.valueOf() <= selectionRangeAdjusted.start.valueOf()) return;

    await dispatch(
      createScheduleEvent({
        startDateTime: selectionRangeAdjusted.start.toISOString(),
        endDateTime: selectionRangeAdjusted.end.toISOString(),
        eventType: "AVAILABILITY",
        status: "OPEN",
        availabilitySource: "MANUAL",
      })
    );
    setDragSelection(null);
    setOpenSelectionDialog(false);
    refreshSchedule();
  };

  return (
    <>
      <Grid container size={12} spacing={2}>
        <SchedulePageHeader
          isTrainerView={isTrainerView}
          clientParam={clientParam}
          selectedClientLabel={selectedClientLabel}
          onClearClientFilter={handleClearClientFilter}
          onOpenAvailability={handleOpenAvailability}
          billingLoading={billingLoading}
          billingSummary={billingSummary}
          selectedTypeEntry={selectedTypeEntry}
          selectedTypeName={selectedTypeName}
        />

        <WeekNavigator
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          weekPickerRef={weekPickerRef}
          weekRangeDisplay={weekRangeDisplay}
          dayjs={dayjs}
        />

        {!isShareMode && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={viewMode}
              onChange={(_, value) => value && setViewMode(value)}
            >
              <ToggleButton value="calendar">Calendar</ToggleButton>
              <ToggleButton value="agenda">Agenda</ToggleButton>
            </ToggleButtonGroup>
            <Button size="small" variant="outlined" onClick={() => setOpenSubscribe(true)}>
              Subscribe to calendar
            </Button>
          </Stack>
        )}

        {viewMode === "agenda" && !isShareMode ? (
          <AgendaView
            events={weekEventRows}
            weekDays={weekDays}
            isTrainerView={isTrainerView}
            isClientView={isClientView}
            selectedDate={selectedDate}
            getEventDisplayName={getEventDisplayName}
            getSessionTypeLabel={getSessionTypeLabel}
            openActionForEvent={openActionForEvent}
            openRequestForEvent={openRequestForEvent}
          />
        ) : (
        <WeekCalendar
          weekCaptureRef={weekCaptureRef}
          weekScrollRef={weekScrollRef}
          totalsScrollRef={totalsScrollRef}
          isShareMode={isShareMode}
          shareIncludeHeader={shareIncludeHeader}
          user={user}
          weekRangeLabel={weekRangeLabel}
          isTrainerView={isTrainerView}
          isClientView={isClientView}
          shareLinkStatus={shareLinkStatus}
          calendarScale={calendarScale}
          setCalendarScale={setCalendarScale}
          calendarMenuAnchor={calendarMenuAnchor}
          setCalendarMenuAnchor={setCalendarMenuAnchor}
          handleCalendarMenuClose={handleCalendarMenuClose}
          openCopyDay={openCopyDay}
          openCopyWeek={openCopyWeek}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          setShareStatus={setShareStatus}
          setShareWeekStartDate={setShareWeekStartDate}
          setOpenShareDialog={setOpenShareDialog}
          setShareLinkStatus={setShareLinkStatus}
          handleCopyShareLink={handleCopyShareLink}
          setOpenTimeSettings={setOpenTimeSettings}
          calendarContentHeight={calendarContentHeight}
          timeColumnWidth={timeColumnWidth}
          totalSlots={totalSlots}
          calendarStartHour={calendarStartHour}
          weekDays={weekDays}
          normalizedSelection={normalizedSelection}
          handleSlotMouseDown={handleSlotMouseDown}
          handleSlotMouseEnter={handleSlotMouseEnter}
          touchSelectionEnabled={touchSelectionEnabled}
          handleSlotTouchStart={handleSlotTouchStart}
          handleSlotTouchMove={handleSlotTouchMove}
          handleSlotTouchEnd={handleSlotTouchEnd}
          weekEvents={weekEvents}
          getEventStyle={getEventStyle}
          openActionForEvent={openActionForEvent}
          onRescheduleEvent={handleRescheduleEvent}
          openRequestForEvent={openRequestForEvent}
          shareHideDetails={shareHideDetails}
          shareHighlightShown={shareHighlightShown}
          shareShownKeys={shareShownKeys}
          highlightFill={highlightFill}
          clientProfileLookup={clientProfileLookup}
          clientLookup={clientLookup}
          serverURL={serverURL}
          shareHidePrices={shareHidePrices}
          getEventDisplayName={getEventDisplayName}
          getRowPayoutLabel={getRowPayoutLabel}
          dayTotalsByColumn={dayTotalsByColumn}
          formatTotals={formatTotals}
          dayCancelledByColumn={dayCancelledByColumn}
          dayCountsByColumn={dayCountsByColumn}
          weekTotals={weekTotals}
          weekCancelledTotals={weekCancelledTotals}
          weekEventCount={weekEventCount}
        />
        )}

        <ScheduleControlsCard
          user={user}
          clients={clients}
          myTrainers={myTrainers}
          isClientView={isClientView}
          isTrainerView={isTrainerView}
          bookingAsClient={bookingAsClient}
          setBookingAsClient={setBookingAsClient}
          selectedTrainerId={selectedTrainerId}
          setSelectedTrainerId={setSelectedTrainerId}
          setSelectedMyTrainerId={setSelectedMyTrainerId}
          selectedClientIds={selectedClientIds}
          setSelectedClientIds={setSelectedClientIds}
          setHasClientSelection={setHasClientSelection}
          setSessionTypesStatus={setSessionTypesStatus}
          setOpenSessionTypesDialog={setOpenSessionTypesDialog}
          setOpenSellPackageDialog={setOpenSellPackageDialog}
          setOpenClientAccessDialog={setOpenClientAccessDialog}
        />
        <Grid container size={12} sx={{ minWidth: 0 }}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ alignItems: "baseline" }}
            >
              <Typography variant="h6">
                Week of {weekRangeLabel}
              </Typography>
              {isTrainerView && Object.keys(weekTotals).length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Week total:{" "}
                  {Object.entries(weekTotals)
                    .map(([currency, total]) => formatPrice(total, currency))
                    .join(" • ")}
                </Typography>
              )}
              {isTrainerView && selectedClientIds.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Select one or more clients to load their workouts.
                </Typography>
              )}
            </Stack>
            {isTrainerView && clientParam && (
              <Card sx={{ borderLeft: "4px solid", borderColor: "primary.main" }}>
                <CardContent>
                  <Typography variant="body2">
                    Filter applied: showing sessions for{" "}
                    {selectedClientLabel
                      ? `${selectedClientLabel.client.firstName} ${selectedClientLabel.client.lastName}`
                      : "this client"}
                    .
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleClearClientFilter}
                    sx={{ mt: 1, px: 0 }}
                  >
                    Clear filter
                  </Button>
                </CardContent>
              </Card>
            )}
            <SessionEventsTable
              sortedWeekRows={sortedWeekRows}
              tableColumnCount={tableColumnCount}
              isTableFilterActive={isTableFilterActive}
              activeFilterKeys={activeFilterKeys}
              onClearFilters={clearTableFilters}
              isColumnHidden={isColumnHidden}
              openTableFilter={openTableFilter}
              toggleTableSort={toggleTableSort}
              tableSortKey={tableSortKey}
              tableSortDirection={tableSortDirection}
              isTrainerView={isTrainerView}
              isClientView={isClientView}
              isShareMode={isShareMode}
              shareHidePrices={shareHidePrices}
              getEventDisplayName={getEventDisplayName}
              getRowPayoutLabel={getRowPayoutLabel}
              selectedTrainerId={selectedTrainerId}
              selectedTrainerLabel={selectedTrainerLabel}
              openActionForEvent={openActionForEvent}
              openRequestForEvent={openRequestForEvent}
            />
            <UnassignedWorkoutsPanel
              isTrainerView={isTrainerView}
              queueTargetEventId={queueTargetEventId}
              setQueueTargetEventId={setQueueTargetEventId}
              attachableEvents={attachableEvents}
              queueTargetEvent={queueTargetEvent}
              queueBookingStartOptions={queueBookingStartOptions}
              selectedQueueSlot={selectedQueueSlot}
              setSelectedQueueSlot={setSelectedQueueSlot}
              queueBookingEndOptions={queueBookingEndOptions}
              selectedQueueEndSlot={selectedQueueEndSlot}
              setSelectedQueueEndSlot={setSelectedQueueEndSlot}
              visibleQueuedWorkouts={visibleQueuedWorkouts}
              selectedClientIds={selectedClientIds}
              clientLookup={clientLookup}
              serverURL={serverURL}
              handleAttachQueuedWorkout={handleAttachQueuedWorkout}
            />
          </Stack>
        </Grid>
      </Grid>

      <EventActionDialogs
        openSelectionDialog={openSelectionDialog}
        handleClearSelection={handleClearSelection}
        selectionRange={selectionRange}
        selectionRangeAdjusted={selectionRangeAdjusted}
        selectionStartTime={selectionStartTime}
        setSelectionStartTime={setSelectionStartTime}
        selectionEndTime={selectionEndTime}
        setSelectionEndTime={setSelectionEndTime}
        clients={clients}
        quickBookClientId={quickBookClientId}
        setQuickBookClientId={setQuickBookClientId}
        quickBookWorkoutId={quickBookWorkoutId}
        setQuickBookWorkoutId={setQuickBookWorkoutId}
        quickBookWorkouts={quickBookWorkouts}
        quickBookQueuedWorkouts={quickBookQueuedWorkouts}
        quickBookSessionTypeId={quickBookSessionTypeId}
        setQuickBookSessionTypeId={setQuickBookSessionTypeId}
        handleSelectQuickBookSessionType={handleSelectQuickBookSessionType}
        quickBookPrice={quickBookPrice}
        setQuickBookPrice={setQuickBookPrice}
        quickBookPriceCurrency={quickBookPriceCurrency}
        setQuickBookPriceCurrency={setQuickBookPriceCurrency}
        quickBookPayout={quickBookPayout}
        setQuickBookPayout={setQuickBookPayout}
        quickBookPayoutCurrency={quickBookPayoutCurrency}
        setQuickBookPayoutCurrency={setQuickBookPayoutCurrency}
        quickBookRecurring={quickBookRecurring}
        setQuickBookRecurring={setQuickBookRecurring}
        quickBookRecurUntil={quickBookRecurUntil}
        setQuickBookRecurUntil={setQuickBookRecurUntil}
        sessionTypes={sessionTypes}
        bookingConflictLabels={bookingConflictLabels}
        quickBookRemainingCredits={quickBookRemainingCredits}
        handleQuickBookClient={handleQuickBookClient}
        handleQuickBookCreateWorkout={handleQuickBookCreateWorkout}
        quickBookCustomName={quickBookCustomName}
        setQuickBookCustomName={setQuickBookCustomName}
        quickBookCustomEmail={quickBookCustomEmail}
        setQuickBookCustomEmail={setQuickBookCustomEmail}
        quickBookCustomPhone={quickBookCustomPhone}
        setQuickBookCustomPhone={setQuickBookCustomPhone}
        handleQuickBookCustom={handleQuickBookCustom}
        handleCreateSlotsFromSelection={handleCreateSlotsFromSelection}
        openAvailabilityDialog={openAvailabilityDialog}
        setOpenAvailabilityDialog={setOpenAvailabilityDialog}
        startTime={startTime}
        setStartTime={setStartTime}
        endTime={endTime}
        setEndTime={setEndTime}
        availabilityType={availabilityType}
        setAvailabilityType={setAvailabilityType}
        availabilityRecurrence={availabilityRecurrence}
        setAvailabilityRecurrence={setAvailabilityRecurrence}
        handleCreateAvailability={handleCreateAvailability}
        openRequestDialog={openRequestDialog}
        setOpenRequestDialog={setOpenRequestDialog}
        activeRequestEvent={activeRequestEvent}
        formatRange={formatRange}
        bookingType={bookingType}
        setBookingType={setBookingType}
        bookingStartOptions={bookingStartOptions}
        selectedBookingSlot={selectedBookingSlot}
        setSelectedBookingSlot={setSelectedBookingSlot}
        bookingEndOptions={bookingEndOptions}
        selectedBookingEndSlot={selectedBookingEndSlot}
        setSelectedBookingEndSlot={setSelectedBookingEndSlot}
        handleRequestBooking={handleRequestBooking}
        openAttachDialog={openAttachDialog}
        setOpenAttachDialog={setOpenAttachDialog}
        attachEvent={attachEvent}
        selectedWorkoutId={selectedWorkoutId}
        setSelectedWorkoutId={setSelectedWorkoutId}
        attachWorkouts={attachWorkouts}
        attachQueuedWorkouts={attachQueuedWorkouts}
        handleCreateWorkout={handleCreateWorkout}
        handleAttachWorkout={handleAttachWorkout}
        openEditDialog={openEditDialog}
        setOpenEditDialog={setOpenEditDialog}
        editClientProfile={editClientProfile}
        editClientAvatar={editClientAvatar}
        editClientName={editClientName}
        editEvent={editEvent}
        attachedEditWorkout={attachedEditWorkout}
        editDate={editDate}
        setEditDate={setEditDate}
        editStartTime={editStartTime}
        setEditStartTime={setEditStartTime}
        editEndTime={editEndTime}
        setEditEndTime={setEditEndTime}
        isTrainerView={isTrainerView}
        editClientId={editClientId}
        setEditClientId={setEditClientId}
        editCustomName={editCustomName}
        setEditCustomName={setEditCustomName}
        editCustomEmail={editCustomEmail}
        setEditCustomEmail={setEditCustomEmail}
        editCustomPhone={editCustomPhone}
        setEditCustomPhone={setEditCustomPhone}
        editPriceAmount={editPriceAmount}
        setEditPriceAmount={setEditPriceAmount}
        currencyAffix={currencyAffix}
        editPriceCurrency={editPriceCurrency}
        setEditPriceCurrency={setEditPriceCurrency}
        editPayoutAmount={editPayoutAmount}
        setEditPayoutAmount={setEditPayoutAmount}
        editPayoutCurrency={editPayoutCurrency}
        setEditPayoutCurrency={setEditPayoutCurrency}
        editPublicLabel={editPublicLabel}
        setEditPublicLabel={setEditPublicLabel}
        editSessionTypeId={editSessionTypeId}
        setEditSessionTypeId={setEditSessionTypeId}
        applyDefaultPriceForType={applyDefaultPriceForType}
        applyDefaultPayoutForType={applyDefaultPayoutForType}
        editStatus={editStatus}
        setEditStatus={setEditStatus}
        editWorkoutClientId={editWorkoutClientId}
        workoutsByAccount={workoutsByAccount}
        workoutQueue={workoutQueue}
        editWorkoutId={editWorkoutId}
        setEditWorkoutId={setEditWorkoutId}
        handleCreateWorkoutForEdit={handleCreateWorkoutForEdit}
        openCopyForEvent={openCopyForEvent}
        handleReopenEvent={handleReopenEvent}
        openDeleteConfirm={openDeleteConfirm}
        handleSaveEdit={handleSaveEdit}
        savingEdit={savingEdit}
        openEventActionDialog={openEventActionDialog}
        setOpenEventActionDialog={setOpenEventActionDialog}
        eventActionTarget={eventActionTarget}
        eventActionAnchor={eventActionAnchor}
        onQuickStatus={handleQuickStatus}
        getEventDisplayName={getEventDisplayName}
        getSessionTypeLabel={getSessionTypeLabel}
        openTrainerBookForEvent={openTrainerBookForEvent}
        openEditForEvent={openEditForEvent}
        handleCancelEvent={handleCancelEvent}
        openTrainerBookDialog={openTrainerBookDialog}
        setOpenTrainerBookDialog={setOpenTrainerBookDialog}
        trainerBookingStartOptions={trainerBookingStartOptions}
        trainerBookSlot={trainerBookSlot}
        setTrainerBookSlot={setTrainerBookSlot}
        trainerBookingEndOptions={trainerBookingEndOptions}
        trainerBookEndSlot={trainerBookEndSlot}
        setTrainerBookEndSlot={setTrainerBookEndSlot}
        trainerBookClientId={trainerBookClientId}
        setTrainerBookClientId={setTrainerBookClientId}
        trainerBookSessionTypeId={trainerBookSessionTypeId}
        setTrainerBookSessionTypeId={setTrainerBookSessionTypeId}
        trainerBookCustomName={trainerBookCustomName}
        setTrainerBookCustomName={setTrainerBookCustomName}
        trainerBookCustomEmail={trainerBookCustomEmail}
        setTrainerBookCustomEmail={setTrainerBookCustomEmail}
        trainerBookCustomPhone={trainerBookCustomPhone}
        setTrainerBookCustomPhone={setTrainerBookCustomPhone}
        handleTrainerBookSlot={handleTrainerBookSlot}
      />

      <SellPackageDialog
        open={openSellPackageDialog}
        onClose={() => setOpenSellPackageDialog(false)}
        clients={clients}
        trainerId={user?._id}
        onSold={refreshBillingSummary}
      />

      <ClientAccessDialog
        open={openClientAccessDialog}
        onClose={() => setOpenClientAccessDialog(false)}
        clients={clients}
        sessionTypes={sessionTypes}
      />

      <SessionTypeDialogs
        openSessionTypesDialog={openSessionTypesDialog}
        setOpenSessionTypesDialog={setOpenSessionTypesDialog}
        sessionTypesStatus={sessionTypesStatus}
        sessionTypes={sessionTypes}
        formatPrice={formatPrice}
        handleEditSessionType={handleEditSessionType}
        handleDeleteSessionType={handleDeleteSessionType}
        handleArchiveSessionType={handleArchiveSessionType}
        handleUnarchiveSessionType={handleUnarchiveSessionType}
        repriceTarget={repriceTarget}
        repriceForm={repriceForm}
        setRepriceForm={setRepriceForm}
        openRepriceDialog={openRepriceDialog}
        closeRepriceDialog={closeRepriceDialog}
        handleReprice={handleReprice}
        resetSessionTypeForm={resetSessionTypeForm}
        setOpenSessionTypeFormDialog={setOpenSessionTypeFormDialog}
        openSessionTypeFormDialog={openSessionTypeFormDialog}
        editingSessionTypeId={editingSessionTypeId}
        sessionTypeForm={sessionTypeForm}
        setSessionTypeForm={setSessionTypeForm}
        handleSaveSessionType={handleSaveSessionType}
      />

      <ScheduleTableFilterMenu
        anchorEl={tableFilterAnchor}
        onClose={closeTableFilter}
        tableFilterLabel={tableFilterLabel}
        tableSortKey={tableSortKey}
        tableFilterKey={tableFilterKey}
        tableSortDirection={tableSortDirection}
        applyTableSort={applyTableSort}
        toggleColumnVisibility={toggleColumnVisibility}
        isColumnHidden={isColumnHidden}
        hiddenTableColumns={hiddenTableColumns}
        showAllColumns={showAllColumns}
        tableColumnLabels={tableColumnLabels}
        tableFilterTypes={tableFilterTypes}
        setTableFilterTypes={setTableFilterTypes}
        weekTypeOptions={weekTypeOptions}
        tableFilterDates={tableFilterDates}
        setTableFilterDates={setTableFilterDates}
        weekDays={weekDays}
        tableFilterTimes={tableFilterTimes}
        setTableFilterTimes={setTableFilterTimes}
        weekTimeOptions={weekTimeOptions}
        tableFilterStatuses={tableFilterStatuses}
        setTableFilterStatuses={setTableFilterStatuses}
        weekStatusOptions={weekStatusOptions}
        tableFilterClientQuery={tableFilterClientQuery}
        setTableFilterClientQuery={setTableFilterClientQuery}
        weekTableClientOptions={weekTableClientOptions}
        tableFilterClients={tableFilterClients}
        setTableFilterClients={setTableFilterClients}
        tableFilterPrices={tableFilterPrices}
        setTableFilterPrices={setTableFilterPrices}
        weekPriceOptions={weekPriceOptions}
      />

      <CopyShareDialogs
        openCopyDialog={openCopyDialog}
        setOpenCopyDialog={setOpenCopyDialog}
        copySourceEvent={copySourceEvent}
        getEventDisplayName={getEventDisplayName}
        formatRange={formatRange}
        copyDate={copyDate}
        setCopyDate={setCopyDate}
        copyStartTime={copyStartTime}
        setCopyStartTime={setCopyStartTime}
        copyEndTime={copyEndTime}
        setCopyEndTime={setCopyEndTime}
        handleCopyEvent={handleCopyEvent}
        openCopyDayDialog={openCopyDayDialog}
        setOpenCopyDayDialog={setOpenCopyDayDialog}
        copyDaySourceDate={copyDaySourceDate}
        setCopyDaySourceDate={setCopyDaySourceDate}
        copyDayDate={copyDayDate}
        setCopyDayDate={setCopyDayDate}
        handleCopyDay={handleCopyDay}
        openCopyWeekDialog={openCopyWeekDialog}
        setOpenCopyWeekDialog={setOpenCopyWeekDialog}
        weekStart={weekStart}
        copyWeekDate={copyWeekDate}
        setCopyWeekDate={setCopyWeekDate}
        handleCopyWeek={handleCopyWeek}
        openShareDialog={openShareDialog}
        setOpenShareDialog={setOpenShareDialog}
        shareWeekStartDate={shareWeekStartDate}
        setShareWeekStartDate={setShareWeekStartDate}
        shareHideDetails={shareHideDetails}
        setShareHideDetails={setShareHideDetails}
        shareHidePrices={shareHidePrices}
        setShareHidePrices={setShareHidePrices}
        weekClientOptions={weekClientOptions}
        shareShownKeys={shareShownKeys}
        setShareShownKeys={setShareShownKeys}
        shareHighlightShown={shareHighlightShown}
        setShareHighlightShown={setShareHighlightShown}
        shareHighlightColor={shareHighlightColor}
        setShareHighlightColor={setShareHighlightColor}
        shareIncludeHeader={shareIncludeHeader}
        setShareIncludeHeader={setShareIncludeHeader}
        shareStatus={shareStatus}
        shareInProgress={shareInProgress}
        handleShareWeek={handleShareWeek}
      />

      <CalendarHoursDialog
        open={openTimeSettings}
        onClose={() => setOpenTimeSettings(false)}
        draftStartHour={draftStartHour}
        setDraftStartHour={setDraftStartHour}
        draftEndHour={draftEndHour}
        setDraftEndHour={setDraftEndHour}
        hourOptions={hourOptions}
        formatHourLabel={formatHourLabel}
        timeSettingsError={timeSettingsError}
        onSave={() => {
          setCalendarStartHour(draftStartHour);
          setCalendarEndHour(draftEndHour);
          setOpenTimeSettings(false);
        }}
      />

      <DeleteEventDialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        deleteEvent={deleteEvent}
        onDelete={handleDeleteEvent}
        onDeleteSeries={handleDeleteSeries}
        deleting={deleting}
        dayjs={dayjs}
      />

      <CalendarSubscribeDialog open={openSubscribe} onClose={() => setOpenSubscribe(false)} />
    </>
  );
}
