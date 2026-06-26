import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AuthModal from "./components/AuthModal";
import ClaimDataModal from "./components/ClaimDataModal";
import LandingPage from "./pages/LandingPage";
import ExplorePage from "./pages/ExplorePage";
import BrewPage from "./pages/BrewPage";
import IndiaMapPage from "./pages/IndiaMapPage";
import AppLayout from "./components/AppLayout";
import "./index.css";

const Root = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/explore" element={<AppLayout><ExplorePage /></AppLayout>} />
        <Route path="/brew/*" element={<AppLayout><BrewPage /></AppLayout>} />
        <Route path="/map" element={<AppLayout><IndiaMapPage /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    <AuthModal />
    <ClaimDataModal />
  </AuthProvider>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
