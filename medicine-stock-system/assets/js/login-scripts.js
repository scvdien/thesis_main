(function () {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const error = document.getElementById('error');
  const submitButton = document.getElementById('loginBtn');
  const usernameInput = form.querySelector('input[name="username"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const year = document.getElementById('year');

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

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
    event.preventDefault();
    clearError();

    const username = String(usernameInput?.value || '').trim();
    const password = String(passwordInput?.value || '').trim();
    if (!username || !password) {
      showError('Please enter username and password.');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Signing in...';
    }

    window.setTimeout(() => {
      showError('Demo mode only. Connect backend auth to enable actual sign in.');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Sign In';
      }
    }, 700);
  });
})();
