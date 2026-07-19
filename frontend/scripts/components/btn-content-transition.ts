export const changeBtnContent = async function (
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