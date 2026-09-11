# Security posture

Implemented foundations: RLS on private commerce tables, ownership policies, database-backed permissions, server-only privileged clients, integer money, separate order/payment states, immutable line snapshots, signed Paystack webhooks, unique event IDs, and non-public cost data.

Production gates still required: atomic checkout RPC with row locking, rate limits, upload policies, exhaustive RLS tests, admin route authorization, CSP, secret rotation, live webhook replay tests, refund controls, log-redaction verification, dependency remediation, and penetration testing. Until these pass, the platform is not approved for live payments.
