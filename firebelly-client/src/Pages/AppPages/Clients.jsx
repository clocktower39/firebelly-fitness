import React, { useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { readinessApi } from "../../api/readinessApi";
import { readinessBand } from "../../utils/readiness";
import {
  requestClients,
  changeRelationshipStatus,
  removeRelationship,
  serverURL,
  enterClientAccount,
  updateRelationshipProfile,
} from "../../Redux/actions";
import { accountApi } from "../../api/accountApi";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Delete, Done } from "@mui/icons-material";
import Calendar from "./Calendar";
import Goals from "./Goals";
import TrainingProfileView from "../../Components/AccountComponents/TrainingProfileView";
import ClientTrainingBlocks from "../../Components/Goals/ClientTrainingBlocks";
import { styled } from "@mui/material/styles";
import {
  ENGAGEMENT_STATUS_OPTIONS,
  SERVICE_TAG_OPTIONS,
  getEngagementStatusColor,
  getEngagementStatusLabel,
  getRelationshipEngagementStatus,
  getRelationshipServiceTags,
  getServiceTagLabel,
} from "../../utils/clientRelationships";

const StyledBadge = styled(Badge)(({ theme, status }) => ({
  "& .MuiBadge-badge": {
    backgroundColor: status === "online" ? "#44b700" : "grey",
    color: status === "online" ? "#44b700" : "grey",
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: status === "online" ? "ripple 1.2s infinite ease-in-out" : "none",
      border: "1px solid currentColor",
      content: '""',
    },
  },
  "@keyframes ripple": {
    "0%": {
      transform: "scale(.8)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(2.4)",
      opacity: 0,
    },
  },
}));

const filterOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
  { value: "needsDays", label: "Needs days" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Su", short: "Sun" },
  { value: 1, label: "Mo", short: "Mon" },
  { value: 2, label: "Tu", short: "Tue" },
  { value: 3, label: "We", short: "Wed" },
  { value: 4, label: "Th", short: "Thu" },
  { value: 5, label: "Fr", short: "Fri" },
  { value: 6, label: "Sa", short: "Sat" },
];

const sortClientRelationships = (relationships, sortKey) =>
  [...relationships].sort((a, b) => {
    const nameA = (a?.client?.[sortKey] || "").toLowerCase();
    const nameB = (b?.client?.[sortKey] || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

export default function Clients({ socket }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const clients = useSelector((state) => state.clients);
  const [clientStatuses, setClientStatuses] = useState({});
  const navigate = useNavigate();

  const clientRelationships = useMemo(() => (Array.isArray(clients) ? clients : []), [clients]);
  const [searchTerm, setSearchTerm] = useState("");
  const [openCalendar, setOpenCalendar] = useState(false);
  const [openGoals, setOpenGoals] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [showOnlyOnline, setShowOnlyOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [engagementFilter, setEngagementFilter] = useState("all");
  const [sortKey, setSortKey] = useState("firstName");
  const [searchParams] = useSearchParams();

  // Deep link from the "new client request" notification: /clients?filter=pending
  useEffect(() => {
    const f = searchParams.get("filter");
    if (f && filterOptions.some((o) => o.value === f)) setEngagementFilter(f);
  }, [searchParams]);

  // Trainer at-a-glance readiness per client (latest/avg score).
  const [clientReadiness, setClientReadiness] = useState({});
  useEffect(() => {
    if (!user?.isTrainer) return;
    readinessApi
      .getClientsReadiness()
      .then((data) => {
        if (data && !data.error) setClientReadiness(data);
      })
      .catch(() => {});
  }, [user?.isTrainer]);

  const handleOpenCalendar = (client) => {
    setSelectedClient(client);
    setOpenCalendar(true);
  };

  const handleCloseCalendar = () => {
    setOpenCalendar(false);
    setSelectedClient("");
  };

  const handleOpenGoals = (client) => {
    setSelectedClient(client);
    setOpenGoals(true);
  };

  const handleCloseGoals = () => {
    setOpenGoals(false);
    setSelectedClient("");
  };

  const handleAcceptRelationship = (clientId) => {
    dispatch(changeRelationshipStatus(clientId, true));
  };

  const handleViewAsClient = async (client) => {
    setStatusMessage("");
    const data = await dispatch(enterClientAccount(client._id));
    if (data?.error) {
      setStatusMessage(data.error);
      return;
    }
    try {
      navigate("/");
    } catch (err) {
      setStatusMessage("Unable to enter client view.");
    }
  };

  const filteredClients = useMemo(() => {
    let filtered = clientRelationships.filter((relationship) => {
      const fullName =
        `${relationship?.client?.firstName || ""} ${relationship?.client?.lastName || ""}`.toLowerCase();

      if (!fullName.includes(searchTerm.toLowerCase())) {
        return false;
      }

      if (showOnlyOnline && clientStatuses[relationship?.client?._id] !== "online") {
        return false;
      }

      const engagementStatus = getRelationshipEngagementStatus(relationship);

      switch (engagementFilter) {
        case "active":
          return relationship?.accepted && engagementStatus === "active";
        case "paused":
          return relationship?.accepted && engagementStatus === "paused";
        case "inactive":
          return relationship?.accepted && engagementStatus === "inactive";
        case "pending":
          return !relationship?.accepted;
        case "needsDays":
          return (
            relationship?.accepted &&
            (!relationship.client?.preferredWorkoutDays ||
              relationship.client.preferredWorkoutDays.length === 0)
          );
        case "all":
        default:
          return true;
      }
    });

    // Pending requests: newest first (most recent request at the top).
    if (engagementFilter === "pending") {
      return [...filtered].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
    }
    return sortClientRelationships(filtered, sortKey);
  }, [clientRelationships, clientStatuses, engagementFilter, searchTerm, showOnlyOnline, sortKey]);

  const filterCounts = useMemo(
    () => ({
      all: clientRelationships.length,
      active: clientRelationships.filter(
        (relationship) =>
          relationship?.accepted && getRelationshipEngagementStatus(relationship) === "active"
      ).length,
      paused: clientRelationships.filter(
        (relationship) =>
          relationship?.accepted && getRelationshipEngagementStatus(relationship) === "paused"
      ).length,
      inactive: clientRelationships.filter(
        (relationship) =>
          relationship?.accepted && getRelationshipEngagementStatus(relationship) === "inactive"
      ).length,
      pending: clientRelationships.filter((relationship) => !relationship?.accepted).length,
      needsDays: clientRelationships.filter(
        (relationship) =>
          relationship?.accepted &&
          (!relationship.client?.preferredWorkoutDays ||
            relationship.client.preferredWorkoutDays.length === 0)
      ).length,
    }),
    [clientRelationships]
  );

  const ClientCard = ({ clientRelationship, isOnline }) => {
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [localEngagementStatus, setLocalEngagementStatus] = useState(
      getRelationshipEngagementStatus(clientRelationship)
    );
    const [localServiceTags, setLocalServiceTags] = useState(
      getRelationshipServiceTags(clientRelationship)
    );
    const [localWorkoutDays, setLocalWorkoutDays] = useState(
      (clientRelationship.client.preferredWorkoutDays || []).map(Number)
    );
    const [localWeeklyFrequency, setLocalWeeklyFrequency] = useState(
      clientRelationship.client.weeklyFrequency || ""
    );
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
      setLocalEngagementStatus(getRelationshipEngagementStatus(clientRelationship));
      setLocalServiceTags(getRelationshipServiceTags(clientRelationship));
      setLocalWorkoutDays((clientRelationship.client.preferredWorkoutDays || []).map(Number));
      setLocalWeeklyFrequency(clientRelationship.client.weeklyFrequency || "");
    }, [clientRelationship]);

    const handleDeleteConfirmationOpen = () => setDeleteConfirmationOpen(true);
    const handleDeleteConfirmationClose = () => setDeleteConfirmationOpen(false);

    const saveRelationshipProfile = async (nextEngagementStatus, nextServiceTags) => {
      setStatusMessage("");
      setSavingProfile(true);
      const data = await dispatch(
        updateRelationshipProfile({
          client: clientRelationship.client._id,
          engagementStatus: nextEngagementStatus,
          serviceTags: nextServiceTags,
        })
      );
      setSavingProfile(false);

      if (data?.error) {
        setStatusMessage(data.error);
        return false;
      }

      return true;
    };

    const handleEngagementStatusChange = async (nextStatus) => {
      if (!clientRelationship.accepted || savingProfile || nextStatus === localEngagementStatus) {
        return;
      }

      const previousStatus = localEngagementStatus;
      setLocalEngagementStatus(nextStatus);
      const updated = await saveRelationshipProfile(nextStatus, localServiceTags);
      if (!updated) {
        setLocalEngagementStatus(previousStatus);
      }
    };

    const handleToggleServiceTag = async (serviceTag) => {
      if (!clientRelationship.accepted || savingProfile) return;

      const previousTags = localServiceTags;
      const nextTags = previousTags.includes(serviceTag)
        ? previousTags.filter((value) => value !== serviceTag)
        : [...previousTags, serviceTag].sort(
            (a, b) =>
              SERVICE_TAG_OPTIONS.findIndex((option) => option.value === a) -
              SERVICE_TAG_OPTIONS.findIndex((option) => option.value === b)
          );

      setLocalServiceTags(nextTags);
      const updated = await saveRelationshipProfile(localEngagementStatus, nextTags);
      if (!updated) {
        setLocalServiceTags(previousTags);
      }
    };

    const saveWorkoutPrefs = async (next) => {
      setStatusMessage("");
      const data = await accountApi.setClientWorkoutPreferences(
        clientRelationship.client._id,
        next
      );
      if (data?.error) {
        setStatusMessage(data.error);
        return false;
      }
      dispatch(requestClients());
      return true;
    };

    const handleWorkoutDaysChange = async (event, nextDays) => {
      const previous = localWorkoutDays;
      setLocalWorkoutDays(nextDays);
      const ok = await saveWorkoutPrefs({ preferredWorkoutDays: nextDays });
      if (!ok) setLocalWorkoutDays(previous);
    };

    const handleWeeklyFrequencyChange = async (event) => {
      const value = event.target.value;
      const previous = localWeeklyFrequency;
      setLocalWeeklyFrequency(value);
      const ok = await saveWorkoutPrefs({ weeklyFrequency: value });
      if (!ok) setLocalWeeklyFrequency(previous);
    };

    const sortedWorkoutDays = [...localWorkoutDays].sort((a, b) => a - b);
    const daysSummary = sortedWorkoutDays.length
      ? `${localWeeklyFrequency ? `${localWeeklyFrequency}×/wk · ` : ""}${sortedWorkoutDays
          .map((d) => DAYS_OF_WEEK[d]?.short)
          .join(", ")}`
      : "No workout days set";

    return (
      <Grid container size={12}>
        <Card
          variant="outlined"
          sx={{
            width: "100%",
            borderColor: clientRelationship.accepted
              ? localEngagementStatus === "active"
                ? "success.light"
                : localEngagementStatus === "paused"
                  ? "warning.light"
                  : "divider"
              : "divider",
          }}
        >
          <CardHeader
            avatar={
              <StyledBadge
                overlap="circular"
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                variant="dot"
                status={isOnline ? "online" : "offline"}
              >
                <Avatar
                  alt={`${clientRelationship.client.firstName[0]}${clientRelationship.client.lastName[0]}`}
                  src={
                    clientRelationship.client.profilePicture
                      ? `${serverURL}/user/profilePicture/${clientRelationship.client.profilePicture}`
                      : null
                  }
                >
                  {clientRelationship.client.firstName[0]}
                  {clientRelationship.client.lastName[0]}
                </Avatar>
              </StyledBadge>
            }
            action={
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {!clientRelationship.accepted && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Done />}
                    onClick={() => handleAcceptRelationship(clientRelationship.client._id)}
                  >
                    Accept
                  </Button>
                )}
                <IconButton title="Remove" onClick={handleDeleteConfirmationOpen}>
                  <Delete />
                </IconButton>
              </Stack>
            }
            title={`${clientRelationship.client.firstName} ${clientRelationship.client.lastName}`}
            subheader={
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "8px", mt: 0.5 }}>
                {!clientRelationship.accepted && (
                  <Chip size="small" variant="outlined" label="Pending" />
                )}
                {!clientRelationship.accepted && clientRelationship.createdAt && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Requested ${new Date(clientRelationship.createdAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" }
                    )}`}
                  />
                )}
                {clientRelationship.accepted && (
                  <Chip
                    size="small"
                    color={getEngagementStatusColor(localEngagementStatus)}
                    label={getEngagementStatusLabel(localEngagementStatus)}
                  />
                )}
                {clientRelationship.accepted &&
                  clientReadiness[clientRelationship.client?._id]?.avgScore != null && (
                    <Chip
                      size="small"
                      color={
                        readinessBand(clientReadiness[clientRelationship.client._id].avgScore).color
                      }
                      label={`Readiness ${clientReadiness[clientRelationship.client._id].avgScore}`}
                    />
                  )}
              </Stack>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            <Stack spacing={2}>
              {clientRelationship.accepted ? (
                <>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: "wrap", gap: "8px", alignItems: "center" }}
                  >
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleViewAsClient(clientRelationship.client)}
                    >
                      View Account
                    </Button>
                    <Button
                      size="small"
                      onClick={() => navigate(`/messages?u=${clientRelationship.client._id}`)}
                    >
                      Message
                    </Button>
                    <Button size="small" onClick={(event) => setMenuAnchor(event.currentTarget)}>
                      More
                    </Button>
                    <Menu
                      anchorEl={menuAnchor}
                      open={Boolean(menuAnchor)}
                      onClose={() => setMenuAnchor(null)}
                    >
                      <MenuItem
                        onClick={() => {
                          setMenuAnchor(null);
                          handleOpenCalendar(clientRelationship.client);
                        }}
                      >
                        Calendar
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setMenuAnchor(null);
                          handleOpenGoals(clientRelationship.client);
                        }}
                      >
                        Goals
                      </MenuItem>
                      <MenuItem
                        component={Link}
                        to={`/sessions?client=${clientRelationship.client._id}`}
                        onClick={() => setMenuAnchor(null)}
                      >
                        Training Sessions
                      </MenuItem>
                      <MenuItem
                        component={Link}
                        to={`/invoices?client=${clientRelationship.client._id}`}
                        onClick={() => setMenuAnchor(null)}
                      >
                        Invoices
                      </MenuItem>
                      <MenuItem
                        component={Link}
                        to={`/progress?client=${clientRelationship.client._id}`}
                        onClick={() => setMenuAnchor(null)}
                      >
                        Progress
                      </MenuItem>
                    </Menu>
                  </Stack>

                  <Typography
                    variant="body2"
                    color={localWorkoutDays.length ? "text.secondary" : "warning.main"}
                  >
                    {daysSummary}
                  </Typography>

                  <Button
                    size="small"
                    onClick={() => setExpanded((value) => !value)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {expanded ? "Hide settings" : "Manage settings"}
                  </Button>

                  <Collapse in={expanded} unmountOnExit>
                    <Stack spacing={2} sx={{ pt: 1 }}>

                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="subtitle2">Coaching Status</Typography>
                      {savingProfile && <CircularProgress size={14} />}
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "8px" }}>
                      {ENGAGEMENT_STATUS_OPTIONS.map((option) => (
                        <Chip
                          key={option.value}
                          clickable={!savingProfile}
                          color={
                            localEngagementStatus === option.value ? option.color : "default"
                          }
                          label={option.label}
                          onClick={() => handleEngagementStatusChange(option.value)}
                          variant={localEngagementStatus === option.value ? "filled" : "outlined"}
                        />
                      ))}
                    </Stack>
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Service Tags</Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "8px" }}>
                      {SERVICE_TAG_OPTIONS.map((option) => {
                        const selected = localServiceTags.includes(option.value);
                        return (
                          <Chip
                            key={option.value}
                            clickable={!savingProfile}
                            color={selected ? "primary" : "default"}
                            label={option.label}
                            onClick={() => handleToggleServiceTag(option.value)}
                            variant={selected ? "filled" : "outlined"}
                          />
                        );
                      })}
                    </Stack>
                    {localServiceTags.length > 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        {localServiceTags.map(getServiceTagLabel).join(", ")}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Optional tags like Online or Programming help you organize clients without
                        affecting access.
                      </Typography>
                    )}
                  </Stack>

                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Workout Preferences</Typography>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      sx={{ alignItems: { sm: "center" } }}
                    >
                      <ToggleButtonGroup
                        value={localWorkoutDays}
                        onChange={handleWorkoutDaysChange}
                        size="small"
                        sx={{ flexWrap: "wrap" }}
                        aria-label="workout days"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <ToggleButton key={d.value} value={d.value} sx={{ px: 1.25 }}>
                            {d.label}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel id={`freq-${clientRelationship.client._id}`}>
                          Days / week
                        </InputLabel>
                        <Select
                          labelId={`freq-${clientRelationship.client._id}`}
                          label="Days / week"
                          value={localWeeklyFrequency}
                          onChange={handleWeeklyFrequencyChange}
                        >
                          <MenuItem value="">
                            <em>Not set</em>
                          </MenuItem>
                          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                            <MenuItem key={n} value={n}>
                              {n}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                      </Stack>
                    </Stack>
                  </Collapse>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Pending connection requests do not use coaching status until accepted.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Dialog open={deleteConfirmationOpen} onClose={handleDeleteConfirmationClose}>
          <DialogTitle id="alert-dialog-title">Delete Confirmation</DialogTitle>
          <DialogContent>
            <Grid container spacing={1} sx={{ padding: "10px 0px" }}>
              <Grid container size={12}>
                <Typography variant="body1">
                  Are you sure you would like to remove this client connection?
                </Typography>
              </Grid>
              <Grid container size={12} spacing={2} sx={{ justifyContent: "center" }}>
                <Grid>
                  <Button
                    color="secondaryButton"
                    variant="contained"
                    onClick={handleDeleteConfirmationClose}
                  >
                    Cancel
                  </Button>
                </Grid>
                <Grid item>
                  <Button
                    variant="contained"
                    onClick={() =>
                      dispatch(removeRelationship(user._id, clientRelationship.client._id))
                    }
                  >
                    Confirm
                  </Button>
                </Grid>
              </Grid>
            </Grid>
          </DialogContent>
        </Dialog>
      </Grid>
    );
  };

  useEffect(() => {
    dispatch(requestClients());
  }, [dispatch]);

  useEffect(() => {
    if (socket) {
      socket.on("currentClientStatuses", (statuses) => {
        setClientStatuses(statuses);
      });

      socket.on("clientStatusChanged", ({ userId, status }) => {
        setClientStatuses((prevStatuses) => ({
          ...prevStatuses,
          [userId]: status,
        }));
      });

      socket.emit("requestClientStatuses");

      return () => {
        socket.off("currentClientStatuses");
        socket.off("clientStatusChanged");
      };
    }
  }, [socket]);

  return user.isTrainer ? (
    <>
      <Grid
        container
        size={12}
        sx={{
          justifyContent: "center",
          paddingBottom: "15px",
          alignSelf: "flex-start",
          flex: "initial",
        }}
      >
        <Typography variant="h4" sx={{ padding: "25px 0" }}>
          Training Clients
        </Typography>
        {statusMessage && (
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            {statusMessage}
          </Typography>
        )}
        <TextField
          label="Search Clients"
          variant="outlined"
          fullWidth
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          sx={{ mb: 2 }}
        />
        <Grid container size={12} justifyContent="center">
          <FormControlLabel
            control={
              <Switch
                checked={showOnlyOnline}
                onChange={(event) => setShowOnlyOnline(event.target.checked)}
                name="showOnlyOnline"
                color="primary"
              />
            }
            label="Online"
          />
        </Grid>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: "8px", mb: 2 }}>
          {filterOptions.map((option) => (
            <Chip
              key={option.value}
              clickable
              color={engagementFilter === option.value ? "primary" : "default"}
              label={`${option.label} (${filterCounts[option.value] || 0})`}
              onClick={() => setEngagementFilter(option.value)}
              variant={engagementFilter === option.value ? "filled" : "outlined"}
            />
          ))}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button onClick={() => setSortKey("lastName")} variant="outlined">
            Last Name
          </Button>
          <Button onClick={() => setSortKey("firstName")} variant="outlined">
            First Name
          </Button>
        </Stack>
      </Grid>

      <Grid
        container
        size={12}
        spacing={1}
        sx={{
          overflowY: "scroll",
          scrollbarWidth: "none",
        }}
      >
        {filteredClients.length > 0 ? (
          filteredClients.map((clientRelationship) => (
            <ClientCard
              key={clientRelationship._id}
              clientRelationship={clientRelationship}
              isOnline={clientStatuses[clientRelationship.client._id] === "online"}
            />
          ))
        ) : (
          <Grid container size={12} sx={{ justifyContent: "center", py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No clients match the current filters.
            </Typography>
          </Grid>
        )}
      </Grid>
      <Dialog
        open={openCalendar}
        onClose={handleCloseCalendar}
        slotProps={{ paper: { sx: { minHeight: "80%", height: "80vh", overflow: "hidden" } } }}
      >
        <DialogContent sx={{ p: 1, height: "100%", overflowY: "auto" }}>
          <Calendar view="trainer" client={selectedClient} embedded />
        </DialogContent>
      </Dialog>
      <Dialog
        open={openGoals}
        onClose={handleCloseGoals}
        sx={{ "& .MuiDialog-paper": { padding: "5px", width: "100%", minHeight: "80%" } }}
      >
        <Box sx={{ px: 2, pt: 2 }}>
          <TrainingProfileView client={selectedClient} />
          {selectedClient?._id && <ClientTrainingBlocks client={selectedClient} />}
        </Box>
        <Goals view="trainer" client={selectedClient} />
      </Dialog>
    </>
  ) : (
    <Typography variant="body1">You are not a trainer. This page is unavailable.</Typography>
  );
}
