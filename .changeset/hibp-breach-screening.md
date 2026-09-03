---
"convex-auth": minor
---

Add native Have I Been Pwned breached-password screening.

`emailAndPassword.checkBreach` is enabled by default and checks new passwords during sign-up and password reset using the HIBP k-Anonymity API. Only the first five characters of the SHA-1 hash are sent to HIBP; the remaining suffix is compared locally, and zero-count padding entries are ignored. Network or API failures fail closed with an explicit error, and a `breached_password` reason is returned for reset flows.
