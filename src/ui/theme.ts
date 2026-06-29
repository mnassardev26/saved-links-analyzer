import { createTheme } from "@mui/material/styles"

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2364d8"
    },
    secondary: {
      main: "#0f766e"
    },
    error: {
      main: "#a83b2f"
    },
    background: {
      default: "#f6f2ea",
      paper: "#fbf8f1"
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily: [
      "IBM Plex Sans",
      "Instrument Sans",
      "Roboto",
      "-apple-system",
      "BlinkMacSystemFont",
      "Segoe UI",
      "sans-serif"
    ].join(","),
    h1: {
      fontSize: 24,
      fontWeight: 700
    },
    h2: {
      fontSize: 18,
      fontWeight: 700
    },
    button: {
      fontWeight: 700,
      textTransform: "none"
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          border: "1px solid #d8d1c7"
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      }
    }
  }
})
