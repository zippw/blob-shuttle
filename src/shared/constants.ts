// shared universal server/client (!) config
export const MAX_PASSCODE_LENGTH: number = 1024;
export const PUT_URL_EXPTIME_SEC: number = 60 * 20;
export const GET_URL_EXPTIME_SEC: number = 60;
export const MAX_BUCKET_SIZE: number = 1024 * 1024 * 1024 // 1 GiB (in bytes)
export const MAX_FILE_SIZE: number = 1024 * 1024 * 50
export const MAX_FILE_COUNT: number = Math.floor(MAX_BUCKET_SIZE / MAX_FILE_SIZE);

/**
 * HOST_SPA: if true, the backend serves the frontend (HTML, static assets) itself using the same endpoint and queries
 * if false, operates strictly as a JSON API - you'll need to host frontend separately.
 * 
 * (!) Hosting frontend separately (HOST_SPA=false) is not the primary use case.
 * CORS is not configured for this scenario, keep things like this in mind.
 * 
 * When HOST_SPA=true (default):
 *   - GET /?path=static&file=... serves assets from /src/static/
 *   - GET / serves index.html from ./views/
 * 
 * When HOST_SPA=false:
 *   - Only POST endpoints work. You serve index.html + sw.js + icons yourself in just 1 folder
 *   - Files must live together in the root and have the same name as in src/static/.
 */
export const HOST_SPA: boolean = true;

/**
 * Cache-Control header for static assets (HTML, JS, icons, manifest).
 * Set to undefined to disable caching entirely.
 */
export const STATIC_CACHE_CONTROL: string | undefined = 'public, max-age=86400';