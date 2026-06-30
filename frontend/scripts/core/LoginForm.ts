import { BaseForm } from "./base";
import { AuthService } from "../AuthService";

export default class LoginForm extends BaseForm {
    private readonly passcode_input = document.getElementById('passcode') as HTMLInputElement;
    private readonly passcode_btn = document.getElementById('passcode_btn') as HTMLButtonElement;
    private readonly loginForm = document.getElementById('auth') as HTMLFormElement;
    private readonly error_el = this.loginForm.querySelector('small.error') as HTMLElement;
    private readonly onLogin: () => void;

    constructor(onLogin = () => { }) {
        super();

        this.onLogin = onLogin;
        this.bind();
        this.autoLogin();
    }

    // login form is standalone form
    get ac() { return {}; }

    public disableForm(toDisable: boolean): void {
        this.passcode_btn.disabled = toDisable;
        this.passcode_input.disabled = toDisable;
    }

    private autoLogin(): void {
        const cached = AuthService.passcode;
        if (cached) {
            this.passcode_input.value = cached;
            this.loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    }

    bind() {
        this.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            this.loginForm.classList.remove('error');
            this.disableForm(true);

            const isAutoSubmit = !!AuthService.passcode;

            try {
                if (!this.passcode_input.value.length) throw new Error('Empty field');

                const passcode = String(this.passcode_input.value);
                const r = await fetch(window.location.pathname + '?path=check-auth', {
                    method: 'POST',
                    body: JSON.stringify({ passcode }),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!r.ok) throw new Error(await r.text());

                AuthService.save(passcode);

                this.disableForm(true);
                setTimeout(() => this.loginForm.remove(), 1000);
                document.body.classList.add('authorized');
                this.onLogin();
            } catch (error) {
                const err = error instanceof Error ? error.message : String(error);

                AuthService.clear();

                this.disableForm(false);
                this.error_el.innerText = err.slice(0, 50) + (err.length > 50 ? '...' : '');
                this.passcode_input.focus();
                this.passcode_input.value = '';
                this.loginForm.classList.add('error')

                return console.error(err);
            }
        });
    }
}