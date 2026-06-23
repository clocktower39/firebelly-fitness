import React from "react";
import { Container, Grid, Paper, Typography } from "@mui/material";
import DefaultSessionLengthField from "./DefaultSessionLengthField";

export default function TrainerSchedulingPreferences() {
  return (
    <Container maxWidth="md" sx={{ height: "100%" }}>
      <Grid container size={12} sx={{ padding: "15px" }}>
        <Typography color="primary.contrastText" variant="h5" gutterBottom>
          Scheduling Preferences
        </Typography>
      </Grid>
      <Paper>
        <Grid container spacing={2} sx={{ padding: "15px" }}>
          <Grid container size={12}>
            <Typography variant="subtitle1" gutterBottom>
              Default Session Length
            </Typography>
          </Grid>
          <Grid container size={12}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              The duration pre-filled when you create a new session or open availability. When
              a session type is selected during booking, its own length takes precedence.
            </Typography>
          </Grid>
          <Grid container size={12}>
            <DefaultSessionLengthField />
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
