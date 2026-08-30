# Security policy

Report suspected vulnerabilities privately to the Masaar team; do not open a public issue containing customer data, credentials or exploit details.

Masaar requires tenant-scoped authorization, role permissions, validated inputs, append-only audit events, signed customer links, secrets outside source control and encrypted transport. Never commit `.env` files, SQL credentials, Cognito secrets, provider tokens, payment proof or real customer exports. Production releases require the gates in `docs/RELEASE_CHECKLIST.md`.
