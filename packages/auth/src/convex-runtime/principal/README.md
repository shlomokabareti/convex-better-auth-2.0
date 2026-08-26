Convex principal-resolution modules.

Current:

- resolve user, service, api-key, oauth-client, and anonymous principals into a shared auth context
- derive execution context defaults from the resolved principal
- enforce active machine-credential guards before issuing service/api-key principal contexts

Still needed for full runtime:

- app-facing fetch/lookup adapters for machine credentials
- explicit restriction-policy helpers beyond record-status guards
