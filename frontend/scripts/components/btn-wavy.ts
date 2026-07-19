export const init = document.querySelectorAll('[data-wavy]').forEach(btn => {
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