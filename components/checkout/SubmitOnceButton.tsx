"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitOnceButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
};

export default function SubmitOnceButton({
  children,
  pendingLabel,
  className = "artales-button",
  disabled = false,
}: SubmitOnceButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button className={className} type="submit" disabled={isDisabled} aria-disabled={isDisabled}>
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}
