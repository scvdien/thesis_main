(function () {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const error = document.getElementById('error');
  const submitButton = document.getElementById('loginBtn');
  const usernameInput = form.querySelector('input[name="username"]');
  const passwordInput = form.querySelector('input[name="password"]');

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

    const username = String(usernameInput?.value || '').trim();
    const password = String(passwordInput?.value || '').trim();
    if (!username || !password) {
      event.preventDefault();
      showError('Please enter username and password.');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Signing in...';
    }
  });
})();
