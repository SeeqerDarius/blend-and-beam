"use client";
import Link from "next/link";

export default function WorkspaceError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="state-panel">
      <h2>This workspace couldn&apos;t be loaded</h2>
      <p>The connection may have been interrupted. No changes were lost.</p>
      <div className="action-row" style={{ justifyContent: "center" }}>
        <button type="button" className="button button-dark" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/admin" className="button-quiet">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
