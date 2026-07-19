function setQueryParam(key: string, value: string | null) {
    const urlParams = new URLSearchParams(window.location.search);

    value === null ? urlParams.delete(key) : urlParams.set(key, value);

    const queryString = urlParams.toString();
    const newUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;

    window.history.replaceState(null, '', newUrl + window.location.hash);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = text;

        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';

        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (fallbackErr) {
            document.body.removeChild(textarea);
            console.error('[copyToClipboard] failed', fallbackErr);
            return false;
        }
    }
}

function escapeHtml(string) {
    return String(string).replace(/[&<>"']/g, function (match) {
        const exportMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return exportMap[match];
    });
}

export { setQueryParam, copyToClipboard, escapeHtml }