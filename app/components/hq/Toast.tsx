"use client";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";

export interface ToastState { msg: string; ok: boolean }

export function Toast({ toast }: { toast: ToastState | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { if (toast) { setVisible(true); } else { setVisible(false); } }, [toast]);
  if (!toast || !visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-lg transition-all duration-200"
      style={{ background: toast.ok ? "#111827" : "#EF3B2D", color: "#FFF", minWidth: 220 }}>
      {toast.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
      <span className="text-[13px] font-semibold">{toast.msg}</span>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };
  return { toast, notify };
}
