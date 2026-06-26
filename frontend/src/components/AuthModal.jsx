import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function AuthModal() {
  const { authModalOpen, closeAuthModal, login, register } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  if (!authModalOpen) return null;

  const reset = () => {
    setError("");
    setFieldErrors([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    reset();
    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      // Success — close modal and reset form
      setEmail("");
      setPassword("");
      setDisplayName("");
      closeAuthModal();
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setFieldErrors(data.errors);
      } else if (data?.error) {
        setError(data.error);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    reset();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && closeAuthModal()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="relative bg-luxury-umber text-white px-6 py-5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-luxury-gold/50 via-luxury-gold to-luxury-gold/50 opacity-30" />
          <h2 className="text-xl font-bold">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-sm text-white/70 mt-1">
            {mode === "login"
              ? "Sign in to access your personal brew space"
              : "Join to save your brews, beans, and preferences"}
          </p>
          <button
            onClick={closeAuthModal}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-luxury-clay/20">
          <button
            onClick={() => switchMode("login")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === "login"
                ? "text-luxury-umber border-b-2 border-luxury-umber"
                : "text-luxury-clay hover:text-luxury-umber"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => switchMode("register")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === "register"
                ? "text-luxury-umber border-b-2 border-luxury-umber"
                : "text-luxury-clay hover:text-luxury-umber"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error display — fail loudly */}
          {(error || fieldErrors.length > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error && <p className="font-medium">{error}</p>}
              {fieldErrors.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5">
                  {fieldErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-luxury-umber mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What should we call you?"
                className="w-full px-4 py-2.5 border border-luxury-clay/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-luxury-gold/50 focus:border-luxury-gold transition-all"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-luxury-umber mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 border border-luxury-clay/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-luxury-gold/50 focus:border-luxury-gold transition-all"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-luxury-umber mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-2.5 border border-luxury-clay/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-luxury-gold/50 focus:border-luxury-gold transition-all"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-luxury-umber text-white font-bold text-sm rounded-xl hover:bg-luxury-umber/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            {submitting
              ? "Please wait..."
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
