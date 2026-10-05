"use client";

import { useEffect, useState } from "react";
import { defaultPreferences, parsePreferences, preferencesKey } from "./preferences";

export function usePreferences() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      // Restore after hydration so server and first client render agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreferences(parsePreferences(localStorage.getItem(preferencesKey)));
    } catch { /* Storage can be unavailable in private or restricted browsers. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(preferencesKey, JSON.stringify(preferences)); }
    catch { /* Preferences still work for this visit without storage. */ }
  }, [preferences, ready]);

  return [preferences, setPreferences] as const;
}
