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
let lastPriority = null;
const updateActiveForm = () => {
    if (!forms.length) return; // not yet initialized, doesn't matter much

    let priority = new Array(forms.length).fill(0);

    if (forms[0].ac.hasFilesChosen) priority[0]++;

    // equivalent priority compared to focus: form elements usually disabled (no focus) when processing
    if (forms[0].ac.isBusy) priority[0] += 2;
    if (forms[0].ac.hasFocusedEls) priority[0] += 2;
    if (forms[0].ac.isDraggingFiles) priority[0] += 2;

    if (forms[1].ac.hasFileListRendered) priority[1] += 1;
    if (forms[1].ac.isBusy) priority[1] += 3;
    if (forms[1].ac.hasFocusedEls) priority[1] += 2;

    if ((forms[1].ac.isBusy || forms[1].ac.hasFileListRendered) &&
        (forms[0].ac.hasFocusedEls || forms[0].ac.isDraggingFiles)
    ) priority = [0, 0];
    if ((forms[0].ac.isBusy || forms[0].ac.hasFilesChosen) &&
        (forms[1].ac.hasFileListRendered || forms[1].ac.isBusy)
    ) priority = [0, 0];

    const maxPriority = Math.max(...priority);
    const avg = priority.reduce((a, c) => a + c, 0) / priority.length;

    if (lastPriority !== priority) {
        console.debug('[main] priority changed: CreateForm', priority[0], '/', priority[1], 'RevealForm')
        lastPriority = priority

        formWrapperEls.forEach((form, i) => {
            const isWinner = priority[i] === maxPriority && maxPriority > 0;

            form.classList.toggle('active', avg === priority[0] ? false : isWinner)
        });
    }
}

export { updateActiveForm };