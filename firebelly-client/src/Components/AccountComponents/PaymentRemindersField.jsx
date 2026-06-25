import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { FormControlLabel, Switch } from "@mui/material";
import { updateUserSettings } from "../../Redux/actions";

// Opt-in toggle: auto-email clients a payment reminder when an invoice first goes
// past due. Reads/writes the same Redux-backed user setting (travels in the JWT).
export default function PaymentRemindersField() {
  const dispatch = useDispatch();
  const value = useSelector((state) => state.user.autoPaymentReminders) === true;

  const handleChange = (event) => {
    dispatch(updateUserSettings({ autoPaymentReminders: event.target.checked }));
  };

  return (
    <FormControlLabel
      control={<Switch checked={value} onChange={handleChange} />}
      label={value ? "Automatic reminders are on" : "Automatic reminders are off"}
    />
  );
}
