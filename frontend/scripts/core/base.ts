import { updateActiveForm } from "../main";

export abstract class BaseForm {
    protected formEl!: HTMLFormElement;
    protected _isBusy: boolean = false;

    abstract get ac(): Record<string, boolean>;

    public get isBusy(): boolean {
        return this._isBusy;
    }

    public set isBusy(value: boolean) {
        if (this._isBusy !== value) {
            this._isBusy = value;
            this.updateFormState();
        }
    }

    /**
     * Used once in main.ts (onLogin)
     * removes disabled and resets tabindex
     */
    public activateForm(): void {
        if (!this.formEl) return;

        const elements = this.formEl.querySelectorAll('input, button, textarea, select');
        elements.forEach(el => {
            const interactiveEl = el as HTMLInputElement | HTMLButtonElement;
            interactiveEl.removeAttribute('disabled');
            interactiveEl.setAttribute('tabindex', '0');
        });

        this.updateFormState();
    }

    public updateFormState(): void {
        if (!this.formEl) return;

        const inputs = this.formEl.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            (input as HTMLInputElement).disabled = this._isBusy;
        });

        this.onStateUpdate();
        updateActiveForm();
    }

    protected abstract onStateUpdate(): void;
    protected abstract bind(): void;
}