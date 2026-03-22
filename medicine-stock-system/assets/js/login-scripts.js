(function () {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const error = document.getElementById('error');
  const submitButton = document.getElementById('loginBtn');
  const usernameInput = form.querySelector('input[name="username"]');
  const passwordInput = form.querySelector('input[name="password"]');
  const confirmPasswordField = document.getElementById('confirmPasswordField');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const setupHint = document.getElementById('setupHint');
  const loginEyebrow = document.getElementById('loginEyebrow');
  const loginTitle = document.getElementById('loginTitle');
  const loginDescription = document.getElementById('loginDescription');
  const year = document.getElementById('year');
  const state = {
    mode: 'login'
  };

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const authEndpoint = 'auth-api.php';
  const isSetupMode = () => state.mode === 'setup';
  const idleSubmitLabel = () => isSetupMode() ? 'Create Admin Account' : 'Sign In';

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

  const setSubmitting = (submitting) => {
    if (!submitButton) return;
    submitButton.disabled = submitting;
    submitButton.textContent = submitting
      ? (isSetupMode() ? 'Creating account...' : 'Signing in...')
      : idleSubmitLabel();
  };

  const setMode = (mode) => {
    state.mode = mode === 'setup' ? 'setup' : 'login';

    if (loginEyebrow) {
      loginEyebrow.textContent = isSetupMode() ? 'First-time setup' : 'Welcome back';
    }
    if (loginTitle) {
      loginTitle.textContent = isSetupMode() ? 'Create Admin Credentials' : 'Sign in as Admin or Staff';
    }
    if (loginDescription) {
      loginDescription.textContent = isSetupMode()
        ? 'Create the admin username and password for this system.'
        : 'Use your assigned admin or staff credentials to continue.';
    }
    if (confirmPasswordField) {
      confirmPasswordField.classList.toggle('d-none', !isSetupMode());
    }
    if (confirmPasswordInput) {
      confirmPasswordInput.required = isSetupMode();
      if (!isSetupMode()) {
        confirmPasswordInput.value = '';
      }
    }
    if (setupHint) {
      setupHint.classList.toggle('d-none', !isSetupMode());
    }

    setSubmitting(false);
  };

  const redirectToApp = (target) => {
    window.location.href = String(target || 'index.php');
  };

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const message = String(payload.message || 'Unable to complete sign in right now.');
      const requestError = new Error(message);
      requestError.payload = payload;
      throw requestError;
    }

    return payload;
  };

  const checkExistingSession = async () => {
    try {
      const payload = await requestJson(`${authEndpoint}?t=${Date.now()}`);
      if (payload.authenticated) {
        redirectToApp(payload.redirect);
        return;
      }
      setMode(payload.setupRequired ? 'setup' : 'login');
    } catch (requestError) {
      // Keep the login screen usable even when the backend is not ready yet.
      setMode('login');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const username = String(usernameInput?.value || '').trim();
    const password = String(passwordInput?.value || '').trim();
    if (!username || !password) {
      showError('Please enter username and password.');
      return;
    }
    if (isSetupMode()) {
      const confirmPassword = String(confirmPasswordInput?.value || '').trim();
      if (!confirmPassword) {
        showError('Please confirm the admin password.');
        return;
      }
      if (password !== confirmPassword) {
        showError('Passwords do not match.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = await requestJson(authEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: isSetupMode() ? 'setup_admin' : 'login',
          username,
          password,
          confirmPassword: String(confirmPasswordInput?.value || '')
        })
      });
      redirectToApp(payload.redirect);
    } catch (requestError) {
      if (requestError && typeof requestError === 'object' && requestError.payload && requestError.payload.setupRequired === true) {
        setMode('setup');
      }
      showError(requestError instanceof Error ? requestError.message : 'Unable to complete sign in right now.');
      setSubmitting(false);
    }
  });

  clearError();
  setMode('login');
  checkExistingSession();
})();
