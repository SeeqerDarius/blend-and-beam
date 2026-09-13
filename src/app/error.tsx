"use client";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section className="page-shell" role="alert"><h1>We couldn’t load this page.</h1><p>The connection may have been interrupted. Please try again.</p><button className="button button-dark" onClick={() => retry()}>Try again</button><p><a href="/">Return to the store</a></p></section>;
}
