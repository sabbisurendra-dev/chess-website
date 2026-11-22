"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface ModalDialogProps {
  open: boolean;
  onClose: (returnValue?: string) => void;
  title: string;
  children: React.ReactNode;
  lightDismiss?: boolean;
}

export function ModalDialog({
  open,
  onClose,
  title,
  children,
  lightDismiss = true,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      const val = dialog.returnValue || "";
      dialog.returnValue = "";
      onClose(val);
    };

    dialog.addEventListener("close", handleClose);

    // Fallback light dismiss for browsers without <dialog closedby="any">
    let cleanupPointer: (() => void) | undefined;
    if (lightDismiss && !("closedBy" in HTMLDialogElement.prototype)) {
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e) && dialog.open) {
          dialog.close("backdrop");
        }
      };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      cleanupPointer = () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupPointer?.();
    };
  }, [lightDismiss, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...(lightDismiss ? { closedby: "any" } : {})}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 id={titleId} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close("close")}
          aria-label="Close modal"
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto scroller">{children}</div>
    </dialog>
  );
}
