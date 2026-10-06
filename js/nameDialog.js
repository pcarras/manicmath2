// Name entry for the ranking. Phaser has no text input, so this is a small DOM dialog over the
// canvas (the phone keyboard, autocorrect off, accents and emoji-free names all work natively).
import { t } from './i18n.js';
import { checkName, NAME_MAX } from './namefilter.js';
import { player, setPlayerName } from './progress.js';
import { uiClick } from './bica.js';

// Resolves with the saved name, or null when cancelled
export function askName() {
    return new Promise((resolve) => {
        const p = player();
        const root = document.createElement('div');
        root.className = 'mm-dialog';
        root.innerHTML = `
            <form class="mm-dialog__panel" autocomplete="off">
                <div class="mm-dialog__title"></div>
                <div class="mm-dialog__hint"></div>
                <input class="mm-dialog__input" maxlength="${NAME_MAX}" spellcheck="false" autocapitalize="words" enterkeyhint="done">
                <div class="mm-dialog__error" aria-live="polite"></div>
                <div class="mm-dialog__row">
                    <button type="button" class="mm-btn mm-btn--grey"></button>
                    <button type="submit" class="mm-btn mm-btn--green"></button>
                </div>
            </form>`;
        const $ = (s) => root.querySelector(s);
        $('.mm-dialog__title').textContent = t('yourName');
        $('.mm-dialog__hint').textContent = t('nameHint');
        const input = $('.mm-dialog__input');
        input.value = p.custom || '';
        input.placeholder = p.generated;
        const error = $('.mm-dialog__error');
        $('.mm-btn--grey').textContent = t('cancel');
        $('.mm-btn--green').textContent = t('save');

        const close = (value) => {
            root.classList.add('mm-dialog--out');
            setTimeout(() => root.remove(), 160);
            resolve(value);
        };
        input.addEventListener('input', () => { error.textContent = ''; });
        $('.mm-btn--grey').addEventListener('click', () => { uiClick(); close(null); });
        $('form').addEventListener('submit', (e) => {
            e.preventDefault();
            uiClick();
            const c = checkName(input.value);
            if (!c.ok) {
                error.textContent = t(`name_${c.reason}`);
                input.focus();
                return;
            }
            setPlayerName(c.name);
            close(c.name);
        });
        // Taps on the dim background cancel; taps inside the panel do not reach the game
        root.addEventListener('pointerdown', (e) => { if (e.target === root) close(null); });
        document.body.appendChild(root);
        setTimeout(() => input.focus(), 50);
    });
}
