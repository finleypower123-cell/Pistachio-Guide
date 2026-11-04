"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const show = useCallback((text: string) => {
    const key = Date.now();
    setMsg({ text, key });
    setTimeout(() => setMsg((m) => (m?.key === key ? null : m)), 3200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-[80] flex justify-center px-4 md:bottom-8">
        {msg && (
          <div key={msg.key} className="animate-pop rounded-full bg-ink px-5 py-3 text-sm font-semibold text-bg shadow-card">
            {msg.text}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
