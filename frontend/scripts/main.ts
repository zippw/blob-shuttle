import LoginForm from "./core/LoginForm";
import RevealForm from "./core/RevealForm";
import CreateForm from "./core/CreateForm";
import { BaseForm } from "./core/base";
import { animate, resizeCanvas, CONFIG, canvas } from "./nebula";
import ShareInvite from "./components/ShareInvite";
import { AuthService } from "./AuthService";
import { registerSW, checkSharedFiles } from "./sw";
registerSW();

let isThrottling = false;

// Handle canvas responsive sizing and animations based on device orientation
window.addEventListener('resize', () => {
    if (isThrottling) return;

    isThrottling = true;
    canvas.classList.add('hidden');

    setTimeout(() => {
        const isPortrait = window.matchMedia("screen and (orientation:portrait)").matches;

        CONFIG.paused = isPortrait;
        canvas.classList.toggle('hidden', isPortrait);

        resizeCanvas();
        isThrottling = false;
    }, 200);
});

resizeCanvas();
animate();

let forms: BaseForm[] = [];

/**
 * Initializes target application forms once session clearance is confirmed
 */
function initializeApp(): void {
    new ShareInvite(
        document.getElementById('share') as HTMLButtonElement,
        document.body.getAttribute('data-vault-id')
    );

    const cf = new CreateForm();
    forms = [cf, new RevealForm()];
    checkSharedFiles().then((files) => {
        if (files) {
            console.log('File array caught via cache storage:', files);
            cf.input.chooseFiles(files);
        }
    });
    document.body.classList.add('authorized');

    const shareBtn = document.getElementById('share');
    if (shareBtn) {
        shareBtn.removeAttribute('disabled');
        shareBtn.setAttribute('tabindex', '0');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Global action trigger to generate secure sharing layout tokens


    document.addEventListener('focusin', () => updateActiveForm());
    document.addEventListener('focusout', () => updateActiveForm());

    // Check if the server pre-authorized the session view markup on cold render
    const isServerAuthorized = document.body.classList.contains('authorized');

    if (isServerAuthorized) {
        initializeApp();
        return;
    }

    // Launch standalone blocker modal if manual password validation is required
    await AuthService.init();
    new LoginForm(() => {
        initializeApp();
        forms.forEach(form => form.activateForm());
    });
});


const formWrapperEls = document.querySelectorAll('main .form-wrapper.create-block, main .form-wrapper.reveal-block') as NodeListOf<HTMLElement>;

const getPriority = (form: BaseForm, i: number) => {
    let p = 0;
    if (form.ac.hasFocusedEls) p += 3;
    if (form.ac.isBusy) p += 2;
    if (form.ac.hasFilesChosen ||
        form.ac.hasFileListRendered ||
        form.ac.isDraggingFiles === true
    ) p += 1;

    return p;
};

export const updateActiveForm = () => {
    const priorities = forms.map(getPriority);
    const max = Math.max(...priorities);
    forms.forEach((form, i) => {
        formWrapperEls[i].classList.toggle('active', priorities[i] === max && max > 0);
    });
};