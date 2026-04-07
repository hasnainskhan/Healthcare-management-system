import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Nav from "../Nav Component/Nav";
import Footer from "../Nav Component/Footer";
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Typography,
  Alert,
} from "@mui/material";

const api = () => import.meta.env.VITE_API_URL;
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

function Telemedicine() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${api()}/api/abi/session`, {
          headers: authHeader(),
        });
        if (!cancelled) setSession(data);
      } catch (e) {
        if (!cancelled) {
          setError(
            e.response?.data?.message ||
              "Could not load telemedicine session."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleOnboard = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await axios.post(
        `${api()}/api/abi/onboard`,
        {},
        { headers: authHeader() }
      );
      setSession({
        onboarded: true,
        abi_user_id: data.abby_user_id,
        widget_url: data.widget_url,
        instance_url: data.instance_url,
      });
    } catch (e) {
      const msg =
        e.response?.data?.message ||
        (e.response?.data?.errors &&
          e.response.data.errors.map((x) => x.msg || x.message).join(" ")) ||
        "Registration with ABI failed.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const widgetSrc = session?.widget_url;

  return (
    <div>
      <Nav />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
          Telemedicine (ABI)
        </Typography>
        <Typography color="text.secondary" paragraph>
          Access your ABI session through the embedded GoApp widget. The
          unique address is created when your account is registered with ABI on
          our servers.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {session?.gp_review_summary && (
          <Alert severity="info" sx={{ mb: 2 }}>
            GP review summary on file. Last updated:{" "}
            {session.gp_reviewed_at
              ? new Date(session.gp_reviewed_at).toLocaleString()
              : "—"}
          </Alert>
        )}

        {!session?.onboarded && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography paragraph>
              You are not linked to ABI yet. Complete your profile (including
              date of birth), then register to open your personal widget.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOnboard}
              disabled={busy}
            >
              {busy ? "Registering…" : "Register with ABI"}
            </Button>
          </Paper>
        )}

        {widgetSrc && (
          <Paper
            elevation={2}
            sx={{
              overflow: "hidden",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <iframe
              src={widgetSrc}
              height="500px"
              width="100%"
              title="Telemedicine Widget"
              loading="lazy"
              className="iframe__content"
              style={{ border: "none", display: "block" }}
            />
          </Paper>
        )}
      </Container>
      <Footer />
    </div>
  );
}

export default Telemedicine;
