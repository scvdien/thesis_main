(() => {
  'use strict';

  document.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.dataset.passwordToggleReady === 'true') return;

    const wrapper = document.createElement('div');
    const button = document.createElement('button');
    const icon = document.createElement('i');

    wrapper.className = 'password-input-wrap';
    button.type = 'button';
    button.className = 'password-visibility-toggle';
    button.setAttribute('aria-label', 'Show password');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Show password';
    icon.className = 'bi bi-eye';
    icon.setAttribute('aria-hidden', 'true');

    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input, button);
    button.appendChild(icon);
    input.classList.add('password-toggle-input');
    input.dataset.passwordToggleReady = 'true';

    button.addEventListener('click', () => {
      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      icon.className = showPassword ? 'bi bi-eye-slash' : 'bi bi-eye';

      const action = showPassword ? 'Hide password' : 'Show password';
      button.setAttribute('aria-label', action);
      button.setAttribute('aria-pressed', String(showPassword));
      button.title = action;
    });
  });
})();
