import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Snackbar } from "@mui/material";

// A transient top-of-screen toast for incoming notifications (new messages, goals, sessions, …).
// Listens to the same "fb:notification" bridge the NotificationBell uses, so you see an alert
// without opening the sidebar or the bell. Clicking it jumps to the linked page.
export default function NotificationToast() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const onPush = (e) => {
      const n = e?.detail;
      if (!n || (!n.title && !n.body)) return;
      // Don't toast for the page you're already looking at (e.g., the open conversation).
      if (n.link && `${window.location.pathname}${window.location.search}` === n.link) return;
      setToast({ title: n.title, body: n.body, link: n.link });
    };
    window.addEventListener("fb:notification", onPush);
    return () => window.removeEventListener("fb:notification", onPush);
  }, []);

  const handleClose = (_e, reason) => {
    if (reason === "clickaway") return;
    setToast(null);
  };

  const handleClick = () => {
    if (toast?.link) navigate(toast.link);
    setToast(null);
  };

  return (
    <Snackbar
      open={Boolean(toast)}
      autoHideDuration={5000}
      onClose={handleClose}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
    >
      <Alert
        severity="info"
        variant="filled"
        onClose={handleClose}
        onClick={handleClick}
        sx={{ width: "100%", cursor: toast?.link ? "pointer" : "default" }}
      >
        {toast?.title ? <strong>{toast.title}</strong> : null}
        {toast?.title && toast?.body ? " — " : null}
        {toast?.body || ""}
      </Alert>
    </Snackbar>
  );
}
