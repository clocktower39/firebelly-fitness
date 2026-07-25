import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  Close as CloseIcon,
  InstallMobile as InstallMobileIcon,
  IosShare as IosShareIcon,
} from "@mui/icons-material";

const DISMISS_KEY = "fb_install_nudge_dismissed_at";
const DISMISS_DAYS = 30;

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const recentlyDismissed = () => {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return at && Date.now() - at < DISMISS_DAYS * 24 * 3600 * 1000;
};

// Gentle add-to-home-screen nudge. Android/Chrome: uses the captured beforeinstallprompt
// event for a real install button. iOS never fires that event, so we show Share-menu
// instructions instead (and installing is also the prerequisite for push notifications
// on iOS). Hidden when already installed; dismissal sticks for 30 days.
export default function InstallAppNudge() {
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return undefined;

    if (isIos()) {
      setVisible(true);
      return undefined;
    }

    const onPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleInstall = async () => {
    if (installEvent) {
      installEvent.prompt();
      const choice = await installEvent.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") setVisible(false);
      setInstallEvent(null);
      return;
    }
    setIosHelpOpen(true);
  };

  return (
    <Paper
      variant="outlined"
      sx={{ width: "100%", margin: "10px 5px", padding: "10px 14px" }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <InstallMobileIcon color="primary" />
        <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">Put Firebelly on your home screen</Typography>
          <Typography variant="caption" color="text.secondary">
            One tap to open — no browser bar, just the app.
          </Typography>
        </Stack>
        <Button size="small" variant="contained" onClick={handleInstall}>
          {installEvent ? "Install" : "How"}
        </Button>
        <IconButton size="small" onClick={dismiss} aria-label="dismiss install suggestion">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Dialog open={iosHelpOpen} onClose={() => setIosHelpOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add to Home Screen</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography variant="body2">
              1. Tap the <IosShareIcon fontSize="inherit" sx={{ verticalAlign: "-2px" }} /> Share
              button in your browser toolbar.
            </Typography>
            <Typography variant="body2">
              2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </Typography>
            <Typography variant="body2">
              3. Tap <strong>Add</strong> — Firebelly appears like a regular app.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIosHelpOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
