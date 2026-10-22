"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "Working…",
  className = "button button-dark submit-button",
  formAction,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  formAction?: React.ComponentProps<"button">["formAction"];
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
      type="submit"
      formAction={formAction}
    >
      {pending ? (
        <span className="submit-progress" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
