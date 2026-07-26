export interface Config {
    /**
     * 'spa': backend serves everything (static + API)
     * 'api': backend serves only JSON API, frontend (/docs) is separately hosted.
     */
    mode: 'spa' | 'api';

    /**
     * Public URL of your function/backend (no trailing slash).
     * This is where the frontend sends API requests.
     */
    apiUrl: string;

    /** Absolute URL of all static files folder (if mode=api) (no trailing slash) */
    staticUrl?: string;

    options: {
        maxPasscodeLength: number;
        maxFileSize: number;
        maxFileCountPerUpload: number;
        inviteURLLifetime: number;
        /**
         * Cache-Control header for static assets (HTML, JS, icons, manifest, if mode=spa).
         * Set to undefined to disable caching entirely.
         */
        staticCacheControl?: string;
        readURLLifetime: number;
        uploadURLLifetime: number;
    },

    storage?: {
        driverPath: string;
    }
}