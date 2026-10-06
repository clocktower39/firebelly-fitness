import React, { useEffect, useMemo, useState } from "react";
import { programApi } from "../../api/programApi";
import AssignProgramDialog from "../../features/program/AssignProgramDialog";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Snackbar,
  Typography,
} from "@mui/material";
import { requestClients } from "../../Redux/actions";
import { compareRelationshipsByClientLastName } from "../../utils/clientRelationships";
import EmptyState from "../../Components/EmptyState";

export default function Programs() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user);
  const clients = useSelector((state) => state.clients);
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [assignProgram, setAssignProgram] = useState(null);
  const [assignSuccess, setAssignSuccess] = useState("");



  useEffect(() => {
    const loadPrograms = async () => {
      setLoading(true);
      try {
        const data = await programApi.listPrograms({ includeShared: true });
        if (data?.error) {
          throw new Error(data.error);
        }
        setPrograms(Array.isArray(data) ? data : []);
        setError("");
      } catch (err) {
        setError(err.message || "Unable to load programs.");
      } finally {
        setLoading(false);
      }
    };
    loadPrograms();
  }, []);

  useEffect(() => {
    if (!user?.isTrainer) return;
    dispatch(requestClients());
  }, [dispatch, user?.isTrainer]);

  const handleDeleteProgram = async (program) => {
    if (!window.confirm(`Delete "${program.title || "this program"}"? This can't be undone.`)) return;
    try {
      await programApi.deleteProgram(program._id);
      setPrograms((prev) => prev.filter((p) => p._id !== program._id));
    } catch (e) {
      window.alert("Couldn't delete the program. Please try again.");
    }
  };

  const hasSharedPrograms = useMemo(() => 
    programs.some((p) => p.isShared), [programs]);

  const filteredAndSortedPrograms = useMemo(() => {
    let result = [...programs];

    if (ownerFilter === "mine") {
      result = result.filter((p) => p.isOwn);
    } else if (ownerFilter === "shared") {
      result = result.filter((p) => p.isShared);
    }

    return result.sort(
      (a, b) => new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf()
    );
  }, [programs, ownerFilter]);

  const acceptedClients = useMemo(
    () => clients.filter((clientRel) => clientRel.accepted).sort(compareRelationshipsByClientLastName),
    [clients]
  );

  const handleOpenAssign = (program) => {
    setAssignProgram(program);
    setOpenAssignDialog(true);
  };


  return (
    <>
      <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
        <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: "center" }}
        >
          <Typography variant="h4" sx={{ flex: 1 }}>
            Programs
          </Typography>
          <Button variant="outlined" onClick={() => navigate("/programs/marketplace-preview")}>
            Marketplace Preview
          </Button>
          <Button variant="contained" onClick={() => navigate("/programs/builder")}>
            New Program
          </Button>
        </Stack>

        {!loading && !error && hasSharedPrograms && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Owner</InputLabel>
            <Select
              value={ownerFilter}
              label="Owner"
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <MenuItem value="all">All Programs</MenuItem>
              <MenuItem value="mine">My Programs</MenuItem>
              <MenuItem value="shared">Shared with Me</MenuItem>
            </Select>
          </FormControl>
        )}

        {loading && <Typography>Loading programs...</Typography>}
        {error && <Typography color="error">{error}</Typography>}
        {!loading && !error && programs.length === 0 && (
          <EmptyState
            title="No programs yet"
            hint="A program is a multi-week training plan you build once and assign to any client — start from the Training Block wizard for a generated draft, or build one by hand."
            action={{ label: "Build your first program", onClick: () => navigate("/programs/builder") }}
          />
        )}
        {!loading && !error && programs.length > 0 && filteredAndSortedPrograms.length === 0 && (
          <Typography color="text.secondary">No programs match your filter.</Typography>
        )}

        <Grid container spacing={2}>
          {filteredAndSortedPrograms.map((program) => (
            <Grid key={program._id} size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Typography variant="h6">
                        {program.title || "Untitled Program"}
                      </Typography>
                      <Chip
                        label={program.status === "PUBLISHED" ? "Published" : "Draft"}
                        color={program.status === "PUBLISHED" ? "success" : "default"}
                        variant={program.status === "PUBLISHED" ? "filled" : "outlined"}
                        size="small"
                      />
                      {program.isShared && (
                        <Chip
                          label={`From ${program.ownerId?.firstName} ${program.ownerId?.lastName}`}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ color: "text.primary", opacity: 0.72 }}>
                      {program.description || "No description"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {program.weeksCount} weeks • {program.daysPerWeek} days/week
                    </Typography>
                  </Stack>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  {program.isOwn ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/programs/${program._id}/edit`)}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/programs/${program._id}/edit`)}
                    >
                      View
                    </Button>
                  )}
                  {user?.isTrainer && program.isOwn && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleOpenAssign(program)}
                    >
                      Assign to client
                    </Button>
                  )}
                  {program.isOwn && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDeleteProgram(program)}
                      sx={{ ml: "auto" }}
                    >
                      Delete
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
        </Stack>
      </Box>
      <AssignProgramDialog
        open={openAssignDialog}
        program={assignProgram}
        acceptedClients={acceptedClients}
        onClose={() => setOpenAssignDialog(false)}
        onAssigned={({ message }) => setAssignSuccess(message)}
      />
      <Snackbar
        open={Boolean(assignSuccess)}
        autoHideDuration={3000}
        onClose={() => setAssignSuccess("")}
      >
        <Alert severity="success" variant="filled">
          {assignSuccess}
        </Alert>
      </Snackbar>
    </>
  );
}
