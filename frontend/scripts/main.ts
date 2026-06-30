
import LoginForm from "./core/LoginForm";
import RevealForm from "./core/RevealForm";
import CreateForm from "./core/CreateForm";
import { BaseForm } from "./core/base";


let forms: BaseForm[] = [];
document.addEventListener('DOMContentLoaded', async () => {
    forms = [new CreateForm(), new RevealForm()];
    if (!document.body.classList.contains('authorized')) new LoginForm(() => {
        forms[0].disableForm(false);
        forms[1].disableForm(false);
    });

    document.addEventListener('focusin', (e) => updateActiveForm());
    document.addEventListener('focusout', (e) => updateActiveForm());

    // test
    // const r = await fetch(window.location.pathname + '?path=delete-vault', { method: 'DELETE' });
});

const formWrapperEls = document.querySelectorAll('main .form-wrapper.create-block, main .form-wrapper.reveal-block') as NodeListOf<HTMLElement>;
const updateActiveForm = () => {
    if (!forms.length) return; // not yet initialized, doesn't matter much

    let priority = new Array(forms.length).fill(0);
    let activeFormIndex = -1;

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

    formWrapperEls.forEach((form, i) => {
        const isWinner = priority[i] === maxPriority && maxPriority > 0;

        form.classList.toggle('active', avg === priority[0] ? false : isWinner)
    });
}

export { updateActiveForm }