export default class TimestampElement {
    private readonly el: HTMLElement;
    private readonly type: string;
    private readonly targetTime: number;
    private readonly locale: string;
    private timerId?: number;

    constructor(el: HTMLElement, locale = 'en-US') {
        this.el = el;
        this.locale = locale;

        console.log(this.el)
        const rawTime = Number(el.getAttribute('data-timestamp')) || Date.now();
        this.targetTime = rawTime > 1e11 ? Math.floor(rawTime / 1000) : rawTime;

        this.type = el.getAttribute('data-timestamp-type') || 'countdown';

        this.start();
    }

    private start(): void {
        this.update();

        if (['countdown', 'R'].includes(this.type)) {
            this.timerId = window.setInterval(() => {
                // Самоочистка, если элемент удален из DOM
                if (!document.body.contains(this.el)) {
                    this.destroy();
                    return;
                }
                this.update();
            }, 1000);
        }
    }

    private update(): void {
        const now = Math.floor(Date.now() / 1000);
        const diff = this.targetTime - now;

        this.el.textContent = this.format(diff);
    }

    private format(diff: number): string {
        const date = new Date(this.targetTime * 1000);

        switch (this.type) {
            case 'countdown': {
                if (diff <= 0) return '00:00';
                const hours = Math.floor(diff / 3600);
                const mins = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
                const secs = (diff % 60).toString().padStart(2, '0');
                return hours > 0 ? `${hours}:${mins}:${secs}` : `${mins}:${secs}`;
            }
            case 'R': {
                const rtf = new Intl.RelativeTimeFormat(this.locale, { style: 'long', numeric: 'auto' });
                if (Math.abs(diff) < 60) return rtf.format(diff, 'second');
                if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
                if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
                return rtf.format(Math.round(diff / 86400), 'day');
            }
            case 'T': return date.toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            case 't': return date.toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' });
            case 'D': return date.toLocaleDateString(this.locale, { day: 'numeric', month: 'long', year: 'numeric' });
            case 'd': return date.toLocaleDateString(this.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
            case 'f': return date.toLocaleString(this.locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            case 'F': return date.toLocaleString(this.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            default: return date.toLocaleString(this.locale);
        }
    }

    public destroy(): void {
        if (this.timerId) clearInterval(this.timerId);
        this.el.remove();
    }
}
