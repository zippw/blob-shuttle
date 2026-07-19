/**
 * Registers the PWA Service Worker environment.
 */
export const registerSW = () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('?path=static&file=sw.js', { scope: '/' })
            .then(() => console.log('SW registered successfully.'))
            .catch(err => console.error('SW registration failed:', err));
    }
};

/**
 * Checks Cache Storage for multi-file payloads, reconstructs them, and wipes the disk clean.
 * @returns {Promise<File[] | null>} Standard native File[] array instance, or null if empty.
 */
export const checkSharedFiles = async (): Promise<File[] | null> => {
    try {
        const cache = await caches.open('pwa-share-cache');
        // Check if at least the first initial file index chunk exists
        const firstResponse = await cache.match('/temporary-shared-file-0');

        if (!firstResponse) return null;

        // Recover total files count from metadata headers
        const totalFiles = parseInt(firstResponse.headers.get('X-Files-Count') || '1', 10);
        const reconstructedFiles: File[] = [];

        for (let i = 0; i < totalFiles; i++) {
            const key = `/temporary-shared-file-${i}`;
            const response = await cache.match(key);

            if (response) {
                const fileName = decodeURIComponent(response.headers.get('X-File-Name') || `shared_file_${i}`);
                const fileType = response.headers.get('Content-Type') || 'application/octet-stream';

                const fileBlob = await response.blob();
                reconstructedFiles.push(new File([fileBlob], fileName, { type: fileType }));

                await cache.delete(key);
            }
        }

        await caches.delete('pwa-share-cache');

        return reconstructedFiles;
    } catch (err) {
        console.error('Failed to parse or clean up multi-share files from Cache API:', err);
        return null;
    }
};