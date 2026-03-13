(function () {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const error = document.getElementById('error');
  const submitButton = document.getElementById('loginBtn');
  const mode = String(form.dataset.mode || 'login').toLowerCase();
  const fullNameInput = form.querySelector('input[name="full_name"]');
  const usernameInput = form.querySelector('input[name="username"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const passwordConfirmInput = form.querySelector('input[name="password_confirm"]');

  const showError = (message) => {
    if (!error) return;
    error.textContent = String(message || '');
    error.classList.add('is-visible');
  };

  const clearError = () => {
    if (!error) return;
    error.textContent = '';
    error.classList.remove('is-visible');
  };

  form.addEventListener('submit', (event) => {
    clearError();

    const fullName = String(fullNameInput?.value || '').trim();
    const username = String(usernameInput?.value || '').trim();
    const password = String(passwordInput?.value || '').trim();
    const passwordConfirm = String(passwordConfirmInput?.value || '').trim();

    if (mode === 'setup') {
      if (!fullName || !username || !password || !passwordConfirm) {
        event.preventDefault();
        showError('Complete all fields to create the first captain account.');
        return;
      }
      if (password !== passwordConfirm) {
        event.preventDefault();
        showError('Passwords do not match.');
        return;
      }
      if (password.length < 8 || !/[^A-Za-z0-9]/.test(password)) {
        event.preventDefault();
        showError('Password must be at least 8 characters and include 1 special character.');
        return;
      }
    } else if (!username || !password) {
      event.preventDefault();
      showError('Please enter username and password.');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = mode === 'setup' ? 'Creating account...' : 'Signing in...';
    }
  });
})();
