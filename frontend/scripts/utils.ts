const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


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




async function changeBtnContent(
    btn: HTMLButtonElement,
    content = 'new content',
    duration = 400
) {
    const oldSpan = btn.querySelector('.content-old') as HTMLElement;
    const newSpan = btn.querySelector('.content-new') as HTMLElement;

    if (!oldSpan || !newSpan) return;

    btn.setAttribute('data-content-transition', '');

    const startRect = oldSpan.getBoundingClientRect();
    oldSpan.style.width = `${startRect.width}px`;
    oldSpan.style.height = `${startRect.height}px`;

    newSpan.innerHTML = content;
    const { width, height } = newSpan.getBoundingClientRect();

    oldSpan.style.transitionDuration = `${duration}ms`;

    oldSpan.offsetHeight;
    btn.classList.add('is-animating');

    oldSpan.style.width = `${width}px`;
    oldSpan.style.height = `${height}px`;

    await new Promise(resolve => setTimeout(resolve, duration));

    oldSpan.innerHTML = content;

    btn.classList.remove('is-animating');
    oldSpan.style.cssText = '';
    newSpan.innerHTML = '';
}


function setProgress(percent: number) {
    let ringElement = document.querySelector('button span.content-old .progress-ring') as HTMLElement;
    if (!ringElement) return;
    const validatedPercent = Math.max(0, Math.min(1, percent));
    ringElement.style.setProperty('--prog', `${validatedPercent * 360}deg`);
}

export { delay, setQueryParam, copyToClipboard, changeBtnContent, setProgress }