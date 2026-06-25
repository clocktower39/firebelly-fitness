import React from "react";
import { Container, Grid, Paper, Typography } from "@mui/material";
import PaymentRemindersField from "./PaymentRemindersField";

export default function TrainerBillingPreferences() {
  return (
    <Container maxWidth="md" sx={{ height: "100%" }}>
      <Grid container size={12} sx={{ padding: "15px" }}>
        <Typography color="primary.contrastText" variant="h5" gutterBottom>
          Billing Preferences
        </Typography>
      </Grid>
      <Paper>
        <Grid container spacing={2} sx={{ padding: "15px" }}>
          <Grid container size={12}>
            <Typography variant="subtitle1" gutterBottom>
              Automatic payment reminders
            </Typography>
          </Grid>
          <Grid container size={12}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              When on, a client is automatically emailed a payment reminder (with the invoice
              attached) the first time an invoice becomes past due. Off by default — you can
              always send a reminder manually from any invoice&apos;s menu.
            </Typography>
          </Grid>
          <Grid container size={12}>
            <PaymentRemindersField />
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}
