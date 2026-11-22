/* global document */
/* NCS career-tool selector. Every panel stays in the HTML for crawlers and
   no-JS readers; the selector only reveals one when enhancement is available. */
(() => {
  'use strict';

  const workspace = document.querySelector('[data-ncs-tools]');
  if (!workspace) return;

  const buttons = [...workspace.querySelectorAll('[data-tool-choice]')];
  const panels = [...workspace.querySelectorAll('[data-tool-panel]')];
  if (!buttons.length || buttons.length !== panels.length) return;

  function activate(key, moveFocus = false) {
    const button = buttons.find(item => item.dataset.toolChoice === key);
    if (!button) return;

    for (const item of buttons) {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.toolPanel !== key;
    }
    if (moveFocus) button.focus();
  }

  for (const button of buttons) {
    button.addEventListener('click', () => activate(button.dataset.toolChoice));
    button.addEventListener('keydown', event => {
      const current = buttons.indexOf(button);
      let next = current;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % buttons.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next !== current) {
        event.preventDefault();
        activate(buttons[next].dataset.toolChoice, true);
      }
    });
  }

  activate('skill');
})();
