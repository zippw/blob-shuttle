import { copyToClipboard } from "../utils/dom";

export default class CopyInput {
    private readonly el: HTMLInputElement;
    private readonly copyBtn: HTMLButtonElement;

    constructor(wrapperEl?: HTMLElement | null) {
        if (!wrapperEl) {
            const container = document.createElement('div');
            container.innerHTML = `<div><input type="text" readonly /><button type="button" aria-label="Copy link">Copy</button></div>`;
            wrapperEl = container.firstElementChild as HTMLElement;
        }

        const inputEl = wrapperEl.querySelector('input');
        const buttonEl = wrapperEl.querySelector('button');

        if (!inputEl || !buttonEl) throw new Error('CopyInput: requires input, button');

        this.el = inputEl;
        this.copyBtn = buttonEl;

        this.bind();
    }

    public setValue(value: string): void {
        this.el.value = value;
    }

    private bind(): void {
        this.el.addEventListener('click', () => {
            this.el.select();
        });

        this.copyBtn.addEventListener('click', () => {
            if (this.el.value) copyToClipboard(this.el.value).then(() => {
                // TODO: copied notify
            }).catch((err) => {
                console.error(err);
                // TODO: copy error notify
            })
        });
    }
}