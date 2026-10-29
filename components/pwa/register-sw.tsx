"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function RegisterServiceWorker() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setInstalled(standalone);

    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Installability still works once HTTPS + manifest are present; ignore SW errors in private mode.
    });

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--cam-bottom,5.5rem)+0.5rem)] z-[60] flex justify-center px-3">
      <button
        type="button"
        disabled={busy}
        className="pointer-events-auto flex min-h-10 items-center gap-2 rounded-full border border-sage/40 bg-panel/95 px-4 text-sm text-paper shadow-lg backdrop-blur disabled:opacity-50"
        onClick={() => {
          void (async () => {
            setBusy(true);
            try {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? "Installing…" : "Install camLUT"}
      </button>
    </div>
  );
}
