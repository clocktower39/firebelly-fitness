import React from "react";
import { Box, Typography, Button } from "@mui/material";

// Contains a render/lifecycle crash in its subtree instead of letting it unmount the whole app to a
// blank screen. Shows the error message (so it's diagnosable) + a Dismiss that resets and calls onReset.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.error) {
      // Fixed overlay so it's visible even when the crashing subtree sat behind a fullscreen dialog.
      return (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2147483647,
            bgcolor: "#b00020",
            color: "#fff",
            p: 2,
            maxHeight: "60vh",
            overflow: "auto",
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Something went wrong.
          </Typography>
          <Typography variant="caption" sx={{ display: "block", mb: 1.5, wordBreak: "break-word", fontFamily: "monospace" }}>
            {String(this.state.error?.message || this.state.error)}
          </Typography>
          <Button size="small" variant="outlined" sx={{ color: "#fff", borderColor: "#fff" }} onClick={this.handleReset}>
            Dismiss
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
