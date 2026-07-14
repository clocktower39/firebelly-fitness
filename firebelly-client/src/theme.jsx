import { createTheme } from "@mui/material";
import { store } from "./Redux/store";

const dark = {
  palette: {
    mode: "dark",
    primary: {
      main: "#2e7d32",
      contrastText: "#fff",
    },
    secondary: {
      main: "#ff9800",
      contrastText: "#fff",
    },
    secondaryButton: {
      main: "#ff9800",
      contrastText: "#fff",
    },
    background: {
      default: "#3a3a3a",
      NavDrawer: "#232323",
      ATCPaperBackground: "#121212",
      DashboardCard: "#282828",
      ChartToopTip: "#000",
      Footer: "#000",
    },
    text: {
      primary: "#f8fafc", // Slate 50
      secondary: "#94a3b8", // Slate 400
    },
    divider: "rgba(148, 163, 184, 0.12)",
  },
  typography: {
    fontFamily: "'Roboto', 'Inter', sans-serif",
    h1: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700 },
    h2: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h3: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    subtitle1: { fontSize: "1.1rem", fontWeight: 500 },
    button: { fontWeight: 600, textTransform: "none" },
  },
  shape: {
    borderRadius: 6,
  },
  props: {
    MuiTextField: {
      variant: "outlined",
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
  }
};

// Modern Dark Theme Palette
const moor = {
  palette: {
    mode: "dark",
    primary: {
      main: "#10b981", // Emerald 500
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#f59e0b", // Amber 500
      contrastText: "#ffffff",
    },
    secondaryButton: {
      main: "#f59e0b",
      contrastText: "#ffffff",
    },
    background: {
      default: "#0f172a", // Slate 900
      paper: "#1e293b",   // Slate 800
      NavDrawer: "linear-gradient(90deg, #020617, #0f172a, #1e293b)",
      ATCPaperBackground: "#1e293b",
      DashboardCard: "#334155", // Slate 700
      ChartToopTip: "#0f172a",
      Footer: "rgba(15, 23, 42, 0.96)",
    },
    text: {
      primary: "#f8fafc", // Slate 50
      // Slate 300, not Slate 400: secondary text sits on the lightest surface
      // (DashboardCard #334155), where Slate 400 only reaches 4.04:1. Slate 300
      // hits 6.97:1 there and >=9.8:1 on darker surfaces, clearing WCAG AA.
      secondary: "#cbd5e1", // Slate 300
    },
    divider: "rgba(148, 163, 184, 0.12)",
  },
  typography: {
    fontFamily: "'Roboto', 'Inter', sans-serif",
    h1: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700 },
    h2: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h3: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    subtitle1: { fontSize: "1.1rem", fontWeight: 500 },
    button: { fontWeight: 600, textTransform: "none" }, // Modern buttons usually don't shout
  },
  shape: {
    borderRadius: 12, // Increased border radius for a softer, modern look
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#0f172a",
          scrollbarColor: "#334155 #0f172a",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            backgroundColor: "#0f172a",
            width: "8px",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: "#334155",
            minHeight: 24,
            border: "2px solid #0f172a",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(45deg, #10b981 30%, #34d399 90%)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: "none",
          backgroundColor: "#1e293b",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          border: "1px solid rgba(255,255,255,0.05)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        rounded: {
            borderRadius: 16
        }
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            "& fieldset": {
              borderColor: "rgba(148, 163, 184, 0.3)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(148, 163, 184, 0.5)",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#10b981",
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          backgroundColor: "#1e293b",
          border: "1px solid rgba(255,255,255,0.05)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
  },
};

// Black/Red theme palette
const ember = {
  palette: {
    mode: "dark",
    primary: {
      main: "#ef4444",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#f87171",
      contrastText: "#ffffff",
    },
    secondaryButton: {
      main: "#ef4444",
      contrastText: "#ffffff",
    },
    background: {
      default: "#000000",
      paper: "#121212",
      NavDrawer: "linear-gradient(90deg, #000000, #121212, #1f1f1f)",
      ATCPaperBackground: "#121212",
      DashboardCard: "#1f1f1f",
      ChartToopTip: "#000000",
      Footer: "rgba(0, 0, 0, 0.98)",
    },
    text: {
      primary: "#f8fafc",
      secondary: "#e2e8f0",
    },
    divider: "rgba(239, 68, 68, 0.18)",
  },
  typography: {
    fontFamily: "'Roboto', 'Inter', sans-serif",
    h1: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700 },
    h2: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h3: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    subtitle1: { fontSize: "1.1rem", fontWeight: 500 },
    button: { fontWeight: 600, textTransform: "none" },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#000000",
          scrollbarColor: "#b91c1c #000000",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            backgroundColor: "#000000",
            width: "8px",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: "#b91c1c",
            minHeight: 24,
            border: "2px solid #000000",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 6px 16px rgba(239, 68, 68, 0.25)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(45deg, #b91c1c 30%, #ef4444 90%)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: "none",
          backgroundColor: "#121212",
          border: "1px solid rgba(239, 68, 68, 0.12)",
          boxShadow: "0 6px 18px rgba(0, 0, 0, 0.45)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        rounded: {
          borderRadius: 16,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            "& fieldset": {
              borderColor: "rgba(239, 68, 68, 0.35)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(239, 68, 68, 0.55)",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#ef4444",
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          backgroundColor: "#121212",
          border: "1px solid rgba(239, 68, 68, 0.16)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
  },
};

// Modern Light Theme Palette
const light = {
  palette: {
    mode: "light",
    primary: {
      main: "#10b981", // Emerald 500
      contrastText: "#000",
    },
    secondary: {
      main: "#f59e0b", // Amber 500
      contrastText: "#000",
    },
    secondaryButton: {
      main: "#f59e0b",
      contrastText: "#ffffff",
    },
    background: {
      default: "#eceff3", // soft neutral grey — gives white cards relief, cuts the white glare
      paper: "#ffffff",
      NavDrawer: "linear-gradient(90deg, #e2e8f0, #cbd5e1)",
      ATCPaperBackground: "#ffffff",
      DashboardCard: "#ffffff",
      ChartToopTip: "#334155",
      Footer: "#e2e8f0",
    },
    text: {
      primary: "#1e293b",   // Slate 800 — softer than near-black, less harsh contrast
      secondary: "#475569", // Slate 600
    },
    divider: "rgba(15, 23, 42, 0.12)",
  },

  typography: {
    fontFamily: "'Roboto', 'Inter', sans-serif",
    h1: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700 },
    h2: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h3: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    subtitle1: { fontSize: "1.1rem", fontWeight: 500 },
    button: { fontWeight: 600, textTransform: "none" },
  },

  shape: {
    borderRadius: 12,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#eceff3",
          scrollbarColor: "#cbd5e1 #eceff3",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            backgroundColor: "#eceff3",
            width: "8px",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: "#cbd5e1",
            border: "2px solid #eceff3",
          },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(45deg, #10b981 30%, #34d399 90%)",
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: "#ffffff",
          boxShadow:
            "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
          border: "1px solid rgba(15, 23, 42, 0.08)",
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        rounded: {
          borderRadius: 16,
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "#ffffff",
            "& fieldset": {
              borderColor: "rgba(15, 23, 42, 0.25)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(15, 23, 42, 0.45)",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#10b981",
            },
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          backgroundColor: "#ffffff",
          border: "1px solid rgba(15, 23, 42, 0.08)",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
  },
};

const pinkLemonade = {
  palette: {
    mode: "light",
    primary: {
      // Many components use primary.contrastText for headings/labels that sit on the light page,
      // so it must be dark to stay readable; contained buttons override back to white below.
      main: "#ec4899", // Pink 500
      contrastText: "#3a2b31",
    },
    secondary: {
      main: "#facc15", // Lemon yellow 400
      contrastText: "#3a2b31",
    },
    secondaryButton: {
      main: "#facc15",
      contrastText: "#3a2b31",
    },
    background: {
      default: "#fff1f4", // soft pink wash
      paper: "#ffffff",
      NavDrawer: "linear-gradient(90deg, #fbcfe8, #fef3c7)", // pink -> lemon
      ATCPaperBackground: "#ffffff",
      DashboardCard: "#ffffff",
      ChartToopTip: "#4a2533",
      Footer: "#fbcfe8",
    },
    text: {
      primary: "#3a2b31", // dark berry — strong contrast on the pink wash
      secondary: "#6d4f59",
    },
    divider: "rgba(74, 37, 51, 0.12)",
  },

  typography: {
    fontFamily: "'Roboto', 'Inter', sans-serif",
    h1: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700 },
    h2: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h3: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    subtitle1: { fontSize: "1.1rem", fontWeight: 500 },
    button: { fontWeight: 600, textTransform: "none" },
  },

  shape: {
    borderRadius: 12,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#fff1f4",
          scrollbarColor: "#f9a8d4 #fff1f4",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            backgroundColor: "#fff1f4",
            width: "8px",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: "#f9a8d4",
            border: "2px solid #fff1f4",
          },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(190, 24, 93, 0.18)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(45deg, #ec4899 30%, #f472b6 90%)",
          color: "#ffffff", // white reads best on the pink button
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(74,37,51,0.08), 0 1px 2px rgba(74,37,51,0.06)",
          border: "1px solid rgba(74, 37, 51, 0.08)",
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        rounded: {
          borderRadius: 16,
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "#ffffff",
            "& fieldset": {
              borderColor: "rgba(74, 37, 51, 0.25)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(74, 37, 51, 0.45)",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#ec4899",
            },
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          backgroundColor: "#ffffff",
          border: "1px solid rgba(74, 37, 51, 0.08)",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          // A focused field's label defaults to primary.main (#ec4899, ~3.5:1) — too light on
          // white. Use a deeper pink so the label stays readable; error labels keep their red.
          "&.Mui-focused:not(.Mui-error)": {
            color: "#be185d", // Pink 700
          },
        },
      },
    },
  },
};

const julyFourth = {
  palette: {
    mode: "light",
    primary: {
      // contrastText kept dark for the many headings/labels that use it on the light page;
      // contained buttons override back to white below.
      main: "#2563eb", // Blue 600
      contrastText: "#1e293b",
    },
    secondary: {
      main: "#dc2626", // Red 600
      contrastText: "#ffffff",
    },
    secondaryButton: {
      main: "#dc2626",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f2f5fb", // crisp cool white
      paper: "#ffffff",
      NavDrawer: "linear-gradient(90deg, #dbeafe, #fee2e2)", // light blue -> light red
      ATCPaperBackground: "#ffffff",
      DashboardCard: "#ffffff",
      ChartToopTip: "#172554",
      Footer: "#dbeafe",
    },
    text: {
      primary: "#1e293b", // slate — strong contrast on the light background
      secondary: "#475569",
    },
    divider: "rgba(30, 41, 59, 0.12)",
    setNumber: "#dc2626", // set numbers in red pop against the blue/white theme
  },

  typography: {
    fontFamily: "'Roboto', 'Inter', sans-serif",
    h1: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700 },
    h2: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h3: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
    subtitle1: { fontSize: "1.1rem", fontWeight: 500 },
    button: { fontWeight: 600, textTransform: "none" },
  },

  shape: {
    borderRadius: 12,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f2f5fb",
          scrollbarColor: "#93c5fd #f2f5fb",
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            backgroundColor: "#f2f5fb",
            width: "8px",
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 8,
            backgroundColor: "#93c5fd",
            border: "2px solid #f2f5fb",
          },
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(29, 78, 216, 0.18)",
          },
        },
        containedPrimary: {
          background: "linear-gradient(45deg, #1d4ed8 30%, #3b82f6 90%)",
          color: "#ffffff",
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: "#ffffff",
          boxShadow: "0 1px 3px rgba(30,41,59,0.08), 0 1px 2px rgba(30,41,59,0.06)",
          border: "1px solid rgba(30, 41, 59, 0.08)",
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        rounded: {
          borderRadius: 16,
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "#ffffff",
            "& fieldset": {
              borderColor: "rgba(30, 41, 59, 0.25)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(30, 41, 59, 0.45)",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#1d4ed8",
            },
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          backgroundColor: "#ffffff",
          border: "1px solid rgba(30, 41, 59, 0.08)",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
  },
};

const buildCustomTheme = (customTheme) => {
  const colors = customTheme?.colors;
  if (!colors) {
    return dark;
  }

  const {
    primary,
    secondary,
    backgroundDefault,
    backgroundPaper,
    textPrimary,
    textSecondary,
  } = colors;

  return {
    palette: {
      mode: "dark",
      primary: {
        main: primary,
        contrastText: "#ffffff",
      },
      secondary: {
        main: secondary,
        contrastText: "#ffffff",
      },
      secondaryButton: {
        main: secondary,
        contrastText: "#ffffff",
      },
      background: {
        default: backgroundDefault,
        paper: backgroundPaper,
        NavDrawer: `linear-gradient(90deg, ${backgroundDefault}, ${backgroundPaper})`,
        ATCPaperBackground: backgroundPaper,
        DashboardCard: backgroundPaper,
        ChartToopTip: backgroundDefault,
        Footer: backgroundDefault,
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
      },
      divider: "rgba(148, 163, 184, 0.18)",
    },
    typography: {
      fontFamily: "'Roboto', 'Inter', sans-serif",
      h1: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700 },
      h2: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
      h3: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
      h4: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
      h5: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
      h6: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
      subtitle1: { fontSize: "1.1rem", fontWeight: 500 },
      button: { fontWeight: 600, textTransform: "none" },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: backgroundDefault,
            scrollbarColor: `${primary} ${backgroundDefault}`,
            "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
              backgroundColor: backgroundDefault,
              width: "8px",
            },
            "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
              borderRadius: 8,
              backgroundColor: primary,
              minHeight: 24,
              border: `2px solid ${backgroundDefault}`,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            boxShadow: "none",
          },
          containedPrimary: {
            background: primary,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: "none",
            backgroundColor: backgroundPaper,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
          rounded: {
            borderRadius: 16,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
        },
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 12,
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              "& fieldset": {
                borderColor: textSecondary,
              },
              "&:hover fieldset": {
                borderColor: textPrimary,
              },
              "&.Mui-focused fieldset": {
                borderColor: primary,
              },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            backgroundColor: backgroundPaper,
            border: `1px solid ${textSecondary}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
          },
        },
      },
    },
  };
};

// Built-in "Forest" theme — modeled on a coach's custom forest theme (dark forest greens, bark-brown
// + soft sky-blue accents), rendered through buildCustomTheme so it matches that look. Tiny tweak: a
// deep forest-green background instead of pure black, for a warmer, more cohesive nav gradient.
const FOREST_COLORS = {
  primary: "#99c1f1",
  secondary: "#63452c",
  backgroundDefault: "#0a140d",
  backgroundPaper: "#132617",
  textPrimary: "#ffffff",
  textSecondary: "#e2e8f0",
};

// ---- US holiday themes ----------------------------------------------------------------------------
// One small factory so each holiday is just a color set. Handles light + dark: in light themes many
// components use primary.contrastText for text on the page, so it's set to the dark page text and
// contained buttons override back to white (the pattern used by the Pink Lemonade / 4th of July
// themes). July 4th is intentionally its own hand-tuned theme and is not regenerated here.
const HOLIDAY_TYPOGRAPHY = {
  fontFamily: "'Roboto', 'Inter', sans-serif",
  h1: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700 },
  h2: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
  h3: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
  h4: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
  h5: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
  h6: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
  subtitle1: { fontSize: "1.1rem", fontWeight: 500 },
  button: { fontWeight: 600, textTransform: "none" },
};

const makeHolidayTheme = ({
  mode,
  primary,
  secondary,
  bgDefault,
  bgPaper,
  textPrimary,
  textSecondary,
  navGradient,
  buttonGradient,
  scrollThumb,
}) => {
  const isLight = mode === "light";
  const border = isLight ? "rgba(15, 23, 42, 0.1)" : "rgba(148, 163, 184, 0.16)";
  return {
    palette: {
      mode,
      primary: { main: primary, contrastText: isLight ? textPrimary : "#ffffff" },
      secondary: { main: secondary, contrastText: "#ffffff" },
      secondaryButton: { main: secondary, contrastText: "#ffffff" },
      background: {
        default: bgDefault,
        paper: bgPaper,
        NavDrawer: navGradient || `linear-gradient(90deg, ${bgDefault}, ${bgPaper})`,
        ATCPaperBackground: bgPaper,
        DashboardCard: bgPaper,
        ChartToopTip: isLight ? "#1e293b" : bgDefault,
        Footer: isLight ? bgPaper : bgDefault,
      },
      text: { primary: textPrimary, secondary: textSecondary },
      divider: isLight ? "rgba(15, 23, 42, 0.12)" : "rgba(148, 163, 184, 0.18)",
    },
    typography: HOLIDAY_TYPOGRAPHY,
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: bgDefault,
            scrollbarColor: `${scrollThumb} ${bgDefault}`,
            "&::-webkit-scrollbar, & *::-webkit-scrollbar": { backgroundColor: bgDefault, width: "8px" },
            "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
              borderRadius: 8,
              backgroundColor: scrollThumb,
              border: `2px solid ${bgDefault}`,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { boxShadow: "none", "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.18)" } },
          containedPrimary: { background: buttonGradient || primary, color: "#ffffff" },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundColor: bgPaper,
            boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
            border: `1px solid ${border}`,
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" }, rounded: { borderRadius: 16 } } },
      MuiTextField: {
        defaultProps: { variant: "outlined" },
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 12,
              backgroundColor: bgPaper,
              "& fieldset": { borderColor: border },
              "&:hover fieldset": { borderColor: primary },
              "&.Mui-focused fieldset": { borderColor: primary },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 20, backgroundColor: bgPaper, border: `1px solid ${border}` } },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } } },
    },
  };
};

const newYears = makeHolidayTheme({
  mode: "dark", primary: "#d4af37", secondary: "#c0c0c0", bgDefault: "#0a0a0f", bgPaper: "#17171f",
  textPrimary: "#f8fafc", textSecondary: "#cbd5e1", scrollThumb: "#3a3a44",
  navGradient: "linear-gradient(90deg, #17171f, #b8860b)",
  buttonGradient: "linear-gradient(45deg, #b8860b 30%, #d4af37 90%)",
});
const valentines = makeHolidayTheme({
  mode: "light", primary: "#e11d48", secondary: "#ec4899", bgDefault: "#fff0f3", bgPaper: "#ffffff",
  textPrimary: "#4c0519", textSecondary: "#9f1239", scrollThumb: "#fda4af",
  navGradient: "linear-gradient(90deg, #fecdd3, #fbcfe8)",
  buttonGradient: "linear-gradient(45deg, #e11d48 30%, #fb7185 90%)",
});
const stPatricks = makeHolidayTheme({
  mode: "light", primary: "#16a34a", secondary: "#ca8a04", bgDefault: "#f0fdf4", bgPaper: "#ffffff",
  textPrimary: "#14532d", textSecondary: "#3f6212", scrollThumb: "#86efac",
  navGradient: "linear-gradient(90deg, #bbf7d0, #fef08a)",
  buttonGradient: "linear-gradient(45deg, #15803d 30%, #22c55e 90%)",
});
const easter = makeHolidayTheme({
  mode: "light", primary: "#a78bfa", secondary: "#f472b6", bgDefault: "#faf5ff", bgPaper: "#ffffff",
  textPrimary: "#4a044e", textSecondary: "#7e22ce", scrollThumb: "#d8b4fe",
  navGradient: "linear-gradient(90deg, #ddd6fe, #fbcfe8)",
  buttonGradient: "linear-gradient(45deg, #a78bfa 30%, #c4b5fd 90%)",
});
const halloween = makeHolidayTheme({
  mode: "dark", primary: "#f97316", secondary: "#a855f7", bgDefault: "#0c0a09", bgPaper: "#1c1917",
  textPrimary: "#fafaf9", textSecondary: "#d6d3d1", scrollThumb: "#44403c",
  navGradient: "linear-gradient(90deg, #1c1917, #ea580c)",
  buttonGradient: "linear-gradient(45deg, #ea580c 30%, #f97316 90%)",
});
const thanksgiving = makeHolidayTheme({
  mode: "light", primary: "#b45309", secondary: "#78350f", bgDefault: "#fdf4e3", bgPaper: "#fffcf5",
  textPrimary: "#431407", textSecondary: "#7c2d12", scrollThumb: "#e7c9a0",
  navGradient: "linear-gradient(90deg, #fed7aa, #d6a05a)",
  buttonGradient: "linear-gradient(45deg, #b45309 30%, #d97706 90%)",
});
const christmas = makeHolidayTheme({
  mode: "light", primary: "#dc2626", secondary: "#16a34a", bgDefault: "#f7faf7", bgPaper: "#ffffff",
  textPrimary: "#14532d", textSecondary: "#3f6212", scrollThumb: "#86efac",
  navGradient: "linear-gradient(90deg, #fecaca, #bbf7d0)",
  buttonGradient: "linear-gradient(45deg, #b91c1c 30%, #dc2626 90%)",
});
const hanukkah = makeHolidayTheme({
  mode: "light", primary: "#1d4ed8", secondary: "#64748b", bgDefault: "#eff6ff", bgPaper: "#ffffff",
  textPrimary: "#1e3a8a", textSecondary: "#475569", scrollThumb: "#93c5fd",
  navGradient: "linear-gradient(90deg, #bfdbfe, #e2e8f0)",
  buttonGradient: "linear-gradient(45deg, #1d4ed8 30%, #3b82f6 90%)",
});

// Exporting the same function signature to maintain compatibility
export const theme = () => {
  const { themeMode, customThemes = [] } = store.getState().user;
  const userTheme = themeMode;
  if (userTheme) {
    localStorage.setItem("theme", userTheme);
  } else {
    localStorage.removeItem("theme");
  }

  const resolveCustomTheme = () => {
    if (!userTheme) return null;
    if (userTheme.startsWith("custom:")) {
      const customId = userTheme.split(":")[1];
      return customThemes.find((t) => t.id === customId) || null;
    }
    const directMatch = customThemes.find((t) => t.id === userTheme);
    return directMatch || null;
  };

  const customTheme = resolveCustomTheme();

  const selectedTheme = () => {
    if (customTheme) {
      return buildCustomTheme(customTheme);
    }
    switch (userTheme) {
      case 'dark':
        return dark;
      case 'moor':
        return moor;
      case 'ember':
        return ember;
      case 'light':
        return light;
      case 'pinkLemonade':
        return pinkLemonade;
      case 'julyFourth':
        return julyFourth;
      case 'forest':
        return buildCustomTheme({ colors: FOREST_COLORS });
      case 'newYears':
        return newYears;
      case 'valentines':
        return valentines;
      case 'stPatricks':
        return stPatricks;
      case 'easter':
        return easter;
      case 'halloween':
        return halloween;
      case 'thanksgiving':
        return thanksgiving;
      case 'christmas':
        return christmas;
      case 'hanukkah':
        return hanukkah;
      default:
        return dark;
    }
  }
  return createTheme(selectedTheme());
}
