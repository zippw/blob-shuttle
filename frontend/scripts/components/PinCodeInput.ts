interface PinCodeInputOptions {
    // count of inputs
    length: number;

    // per each char
    pattern?: RegExp;
    pastePattern?: RegExp;
    onComplete?: (code: string) => void;
    onChange?: (code: string) => void;
}

export default class PinCodeInput {
    private readonly containerEl: HTMLElement;
    private readonly options: PinCodeInputOptions;
    private readonly inputs: NodeListOf<HTMLInputElement>;

    private _value: string = '';
    private _disabled: boolean = false;
    private _listeners: Array<{
        input: HTMLInputElement;
        onInput: (e: Event) => void;
        onKeyDown: (e: KeyboardEvent) => void;
        onPaste: (e: ClipboardEvent) => void;
    }> = [];

    constructor(containerEl: HTMLElement, options: PinCodeInputOptions = { length: 4 }) {
        this.containerEl = containerEl;
        this.options = options;

        this.inputs = this.containerEl.querySelectorAll('input');
        if (this.inputs.length !== this.options.length) throw new Error(`Input count must be ${this.options.length}`);

        this.bind();
    }

    public destroy(): void {
        console.debug('[PinCodeInput] Destroying component, flushing DOM event listeners...');
        this._listeners.forEach(({ input, onInput, onKeyDown, onPaste }) => {
            input.removeEventListener('input', onInput);
            input.removeEventListener('keydown', onKeyDown);
            input.removeEventListener('paste', onPaste);
        });
        this._listeners = [];
    }

    private syncValue(): void {
        const fullCode = Array.from(this.inputs).map(inp => inp.value).join('');
        const isChanged = fullCode !== this._value;

        if (isChanged) {
            this._value = fullCode;
            if (this.options.onChange) this.options.onChange(this._value);
            if (this.isValidInput(fullCode)) this.onCompleteEvent(fullCode);
        }

    }

    private onInputEvent(input: HTMLInputElement, index: number) {
        let val = input.value;

        // if (val.length > 1) input.value = val.charAt(0);
        // in case of autocomplete
        if (val.length > 1) {
            if (val.length === this.options.length) {
                this.inputs.forEach((inp, idx) => inp.value = val[idx] || '');
                this.inputs[this.inputs.length - 1].focus();
                this.syncValue();
                return;
            }

            input.value = val.charAt(0);
            val = input.value;
        }

        if (this.options.pattern && input.value.length === 1) {
            if (!this.options.pattern.test(input.value)) {
                input.value = '';
                this.syncValue();
                return;
            }
        }

        if (input.value && index < this.inputs.length - 1)
            this.inputs[index + 1].focus();

        this.syncValue();
    }

    private onCompleteEvent(fullCode: string): void {
        if (this.options.onComplete) this.options.onComplete(fullCode);
    }

    private onPasteEvent(e: ClipboardEvent) {
        e.preventDefault();
        const data = e.clipboardData?.getData('text').trim() || '';
        let code = data;

        // matching code from strings
        if (this.options.pastePattern) {
            const extracted = data.match(this.options.pastePattern);
            if (extracted) code = extracted[0];
        }

        if (!this.isValidInput(code)) {
            console.warn(`[PinCodeInput] Rejected paste value: "${code}" due to validation rules.`);
            return;
        }

        console.debug(`[PinCodeInput] Code pasted into inputs: ${code}`);
        this.inputs.forEach((inp, idx) => {
            inp.value = code[idx] || '';
        });

        this.inputs[this.inputs.length - 1].focus();
        this.syncValue();
    }

    private bind(): void {
        this.inputs.forEach((input, index) => {
            const onInput = () => this.onInputEvent(input, index);

            const onKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Backspace' && !input.value && index > 0) {
                    this.inputs[index - 1].focus();
                    this.inputs[index - 1].value = '';
                    this.syncValue();
                }
            };

            const onPaste = (e: ClipboardEvent) => this.onPasteEvent(e);

            input.addEventListener('input', onInput);
            input.addEventListener('keydown', onKeyDown);
            input.addEventListener('paste', onPaste);

            this._listeners.push({ input, onInput, onKeyDown, onPaste });
        });
    }

    public get value(): string {
        return this._value;
    }

    public set value(value: string) {
        if (value === '') {
            this.inputs.forEach(input => input.value = '');
            // this._value = '';
            // if (this.options.onChange) this.options.onChange('');
            this.syncValue();
            return;
        }

        if (!this.isValidInput(value)) return;

        this.inputs.forEach((input, i) => {
            input.value = value[i] || '';
        });

        this.syncValue();
    }

    public set disabled(toDisable: boolean) {
        this._disabled = toDisable;
        this.inputs.forEach(input => {
            input.disabled = toDisable;
            input.setAttribute('tabindex', toDisable ? '-1' : '0');
        });
    }

    public get disabled(): boolean {
        return this._disabled;
    }

    public get isValid(): boolean { return this.isValidInput(this._value); }

    private isValidInput(value: string): boolean {
        if (value.length !== this.options.length) return false;
        if (this.options.pattern) return !value.split('').some(v => !this.options.pattern.test(v));

        return true;
    }

    public get isFocused(): boolean {
        if (!(document.activeElement instanceof HTMLInputElement)) return false;
        return [...this.inputs].includes(document.activeElement);
    }

    public focus(index: number = 0) {
        if (index > (this.inputs.length - 1) || index > (this.options.length - 1)) {
            console.warn(`There is no inputs[${index}]`);
            return
        };

        this.inputs[index].focus();
    }
}