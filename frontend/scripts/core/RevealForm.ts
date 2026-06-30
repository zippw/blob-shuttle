import { AuthService } from "../AuthService";
import { updateActiveForm } from "../main";
import { delay } from "../utils";
import { BaseForm } from "./base";

export default class RevealForm extends BaseForm {
    public readonly inputs = document.querySelectorAll('.code-input') as NodeListOf<HTMLInputElement>;
    private readonly formEl = document.getElementById('reveal') as HTMLFormElement;
    private readonly filesContainer = document.getElementById('files_container') as HTMLElement;

    private isBusy: boolean = false;

    constructor() {
        super();

        this.bind();
    }

    public disableForm(toDisable: boolean = true) {
        this.inputs.forEach(input => input.disabled = toDisable);
    }

    public get ac() {
        let hasFocusedEls = false;
        if (document.activeElement instanceof HTMLInputElement && [...this.inputs].includes(document.activeElement)) hasFocusedEls = true;

        return { hasFocusedEls, hasFileListRendered: this.isExpanded, isBusy: this.isBusy }
    }

    private get isExpanded(): boolean {
        return this.filesContainer.classList.contains('expanded');
    }

    bind() {
        this.inputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                const val = input.value;

                if (!/^[a-zA-Z0-9]$/.test(val)) {
                    input.value = '';
                    return;
                }

                if (index < this.inputs.length - 1) this.inputs[index + 1].focus();

                const fullCode = Array.from(this.inputs).map(inp => inp.value).join('');
                if (fullCode.length === this.inputs.length) this.onFullFilled(fullCode);
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && index > 0) this.inputs[index - 1].focus();
            });

            input.addEventListener('paste', (e) => {
                e.preventDefault();
                if (!e.clipboardData) return;
                const data = e.clipboardData.getData('text').trim();
                if (!/^[a-zA-Z0-9]{6}$/.test(data)) return;

                this.inputs.forEach((inp, idx) => inp.value = data[idx]);
                this.inputs[this.inputs.length - 1].focus();

                this.onFullFilled(data);
            });
        });
    }

    async onFullFilled(value: string) {
        this.isBusy = true;
        this.filesContainer.classList.remove('expanded');
        this.disableForm(true);
        updateActiveForm(); // all lines above affects priority

        this.formEl.classList.remove('error');

        const r = await fetch(window.location.pathname + `?path=reveal-vault`, {
            method: 'POST',
            body: JSON.stringify({ passcode: AuthService.passcode, vault_id: value }),
            headers: { 'Content-Type': 'application/json' }
        });

        await delay(1000);

        if (!r.ok) {
            const errMaxLen = 50;
            const err = await r.text();
            console.error(err);
            this.formEl.querySelector('small.error').textContent = err.slice(0, errMaxLen) + (err.length > errMaxLen ? '...' : '');
            this.formEl.classList.add('error');
            await delay(400);

            this.disableForm(false);
            this.formEl.reset();
            this.inputs[0].focus();
            this.isBusy = false;
            updateActiveForm();
            return
        }

        const files = await r.json();
        this.filesContainer.innerHTML = '';
        files.forEach(file => {
            this.filesContainer.innerHTML += `<a class="file" href="${file.url}" download="${file.name}">${file.name}</a>`;
        });

        this.disableForm(false);
        this.filesContainer.classList.add('expanded');
        this.isBusy = false;
        updateActiveForm();
    }
}