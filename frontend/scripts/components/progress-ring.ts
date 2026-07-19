export const setProgress = function (percent: number) {
    let ringElement = document.querySelector('button span.content-old .progress-ring') as HTMLElement;
    if (!ringElement) return;
    const validatedPercent = Math.max(0, Math.min(1, percent));
    ringElement.style.setProperty('--prog', `${validatedPercent * 360}deg`);
}