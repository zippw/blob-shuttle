self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    if (e.request.method === 'POST' && url.pathname === '/files' && url.searchParams.get('path') === 'share_target') {
        e.respondWith((async () => {
            const formData = await e.request.formData();
            const files = formData.getAll('media');

            if (files.length > 0) {
                const cache = await caches.open('pwa-share-cache');

                await Promise.all(files.map(async (file, i) => {
                    await cache.put(`/temporary-shared-file-${i}`, new Response(file, {
                        headers: {
                            'X-File-Name': encodeURIComponent(file.name),
                            'Content-Type': file.type,
                            'X-Files-Count': String(files.length)
                        }
                    }));
                }));
            }

            return Response.redirect('/files', 303);
        })());
    }
});