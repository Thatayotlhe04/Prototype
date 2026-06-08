# Pandora Integration

Prototype is a Vite/static app, so it does not contain a Pandora secret. The
client sends events only to `VITE_PANDORA_PROXY_URL`, which must be a server-side
proxy that signs Pandora ingestion requests.

Tracked events:

- `map.viewed`
- `location.searched`

`model_training` is enabled by default under the Terms. The one-time cookie banner
stores the visitor choice: Continue keeps training enabled, while Reject disables
future raw training payloads. Users can also toggle it from the account modal
Settings screen. When disabled, Prototype omits raw search text and sends only
internal `product_improvement` metadata through the proxy.
