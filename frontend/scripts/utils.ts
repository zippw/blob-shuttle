const delay = (ms: number) => new Promise(res => setTimeout(res, ms));



function formatBytes(bytes: number, decimals: number = 2) {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

(document.querySelectorAll('[data-bytes]') as NodeListOf<HTMLElement>).forEach(el => el.innerText = formatBytes(Number(el.getAttribute('data-bytes')), 0) + ' ');



document.querySelectorAll('[data-wavy]').forEach(btn => {
    btn.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const span = document.createElement('span');

        span.className = 'wave';
        span.style.left = `${e.clientX - rect.left}px`;
        span.style.top = `${e.clientY - rect.top}px`;

        span.addEventListener('animationend', () => span.remove());

        this.append(span);
    });
});


function setQueryParam(key: string, value: string) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set(key, value);
    const newUrl = window.location.pathname + '?' + urlParams.toString();

    window.history.replaceState(null, '', newUrl);
}

export { delay, formatBytes, setQueryParam }