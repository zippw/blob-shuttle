export const setProgress = function (percent: number, id: string) {
    let ringElement = document.getElementById(id) as HTMLElement;
    if (!ringElement) return;
    const validatedPercent = Math.max(0, Math.min(1, percent));
    ringElement.style.setProperty('--prog', `${validatedPercent * 360}deg`);
}