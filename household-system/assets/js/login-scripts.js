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

  // If page loaded with an error from the server, clear any pending staging
  if (error && error.textContent.trim() !== '') {
    try {
      localStorage.removeItem('cabarian_offline_auth_staging');
    } catch {}
  }

  const showError = (message) => {
    if (!error) return;
    error.textContent = String(message || '');
    error.classList.add('is-visible');
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = mode === 'setup' ? 'Create Captain Account' : 'Sign In';
    }
  };

  const clearError = () => {
    if (!error) return;
    error.textContent = '';
    error.classList.remove('is-visible');
  };

  const syncCsrfToken = async () => {
    if (!window.navigator.onLine) return '';
    try {
      const res = await fetch('login.php?csrf_token_refresh=1', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Accept': 'application/json, text/html;q=0.9' }
      });
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data && typeof data.csrf_token === 'string' && data.csrf_token.length > 0) {
            const tokenInput = form.querySelector('input[name="csrf_token"]');
            if (tokenInput) tokenInput.value = data.csrf_token;
            return data.csrf_token;
          }
        } catch {
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const tokenInputInHtml = doc.querySelector('input[name="csrf_token"]');
          if (tokenInputInHtml && tokenInputInHtml.value) {
            const tokenInput = form.querySelector('input[name="csrf_token"]');
            if (tokenInput) tokenInput.value = tokenInputInHtml.value;
            return tokenInputInHtml.value;
          }
        }
      }
    } catch {}
    return '';
  };

  syncCsrfToken();
  window.addEventListener('pageshow', () => syncCsrfToken());

  function sha256(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const words = [];
    const asciiBitLength = ascii.length * 8;
    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let i;
    for (i = 0; i < ascii.length; i++) {
      const j = (i >> 2);
      words[j] = (words[j] || 0) | ((ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8));
    }
    const end = (asciiBitLength >> 5);
    words[end] = (words[end] || 0) | (0x80 << (24 - (asciiBitLength % 32)));
    words[(((asciiBitLength + 64) >>> 9) << 4) + 15] = asciiBitLength;

    for (let j = 0; j < words.length; j += 16) {
      const w = words.slice(j, j + 16);
      const oldHash = hash.slice(0);
      for (i = 0; i < 64; i++) {
        const i2 = i + j;
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? (w[i] || 0) : (
            (w[i - 16] +
              (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
              w[i - 7] +
              (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0
          ));
        const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash[7] = hash[6];
        hash[6] = hash[5];
        hash[5] = hash[4];
        hash[4] = (hash[3] + temp1) | 0;
        hash[3] = hash[2];
        hash[2] = hash[1];
        hash[1] = hash[0];
        hash[0] = (temp1 + temp2) | 0;
      }
      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    let result = '';
    for (i = 0; i < 8; i++) {
      for (let j = 3; j >= 0; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const fullName = String(fullNameInput?.value || '').trim();
    const username = String(usernameInput?.value || '').trim();
    const password = String(passwordInput?.value || '').trim();
    const passwordConfirm = String(passwordConfirmInput?.value || '').trim();

    if (mode === 'setup') {
      if (!fullName || !username || !password || !passwordConfirm) {
        showError('Complete all fields to create the first captain account.');
        return;
      }
      if (password !== passwordConfirm) {
        showError('Passwords do not match.');
        return;
      }
      if (password.length < 8 || !/[^A-Za-z0-9]/.test(password)) {
        showError('Password must be at least 8 characters and include 1 special character.');
        return;
      }
    } else if (!username || !password) {
      showError('Please enter username and password.');
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = mode === 'setup' ? 'Creating account...' : 'Signing in...';
    }

    const performOfflineLogin = async () => {
      let staffAuth = null;
      try {
        const raw = localStorage.getItem('cabarian_offline_staff_auth')
          || localStorage.getItem('cabarian_authenticated_staff');
        staffAuth = raw ? JSON.parse(raw) : null;
      } catch {}

      if (!staffAuth || !staffAuth.username) {
        showError('Please sign in online first with your staff account before using offline mode.');
        return;
      }

      const expectedUsername = String(staffAuth.username || '').toLowerCase().trim();
      if (username.toLowerCase() !== expectedUsername) {
        showError('Invalid username or password.');
        return;
      }

      const enteredHash = sha256(username.toLowerCase() + '::' + password);
      if (!staffAuth.passwordHash || enteredHash !== staffAuth.passwordHash) {
        showError('Invalid username or password.');
        return;
      }

      if (submitButton) {
        submitButton.textContent = 'Opening offline...';
      }

      try {
        if ('caches' in window) {
          const authStateCache = await caches.open('registration-module-auth-state');
          const keys = await authStateCache.keys();
          await Promise.all(keys.map((k) => authStateCache.delete(k)));
          const moduleScopeUrl = new URL('./', window.location.href).href;
          await authStateCache.delete(new URL('.registration-logged-out', moduleScopeUrl).toString());
        }
      } catch {}

      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'OFFLINE_LOGIN_SUCCESS' });
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_LOGGED_OUT_STATE' });
        }
      } catch {}

      try {
        sessionStorage.setItem('cabarian_session_authenticated', 'true');
        sessionStorage.setItem('cabarian_offline_session_active', 'true');
        sessionStorage.setItem('cabarian_offline_reauth_pass', password);
        sessionStorage.setItem('cabarian_offline_reauth_user', username.toLowerCase());
      } catch {}

      await new Promise((resolve) => setTimeout(resolve, 60));

      window.location.assign('registration.php');
    };

    if (window.navigator.onLine === false) {
      await performOfflineLogin();
      return;
    }

    const handleLoginSuccess = async (targetRedirectUrl) => {
      try {
        sessionStorage.setItem('cabarian_session_authenticated', 'true');
        if ('caches' in window) {
          const authStateCache = await caches.open('registration-module-auth-state');
          const keys = await authStateCache.keys();
          await Promise.all(keys.map((k) => authStateCache.delete(k)));
          const moduleScopeUrl = new URL('./', window.location.href).href;
          await authStateCache.delete(new URL('.registration-logged-out', moduleScopeUrl).toString());
        }
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'OFFLINE_LOGIN_SUCCESS' });
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_LOGGED_OUT_STATE' });
        }
        const hash = sha256(username.toLowerCase() + '::' + password);
        let existingReauthToken = '';
        try {
          const rawOld = localStorage.getItem('cabarian_offline_staff_auth') || localStorage.getItem('cabarian_authenticated_staff');
          const parsedOld = rawOld ? JSON.parse(rawOld) : null;
          if (parsedOld && (parsedOld.reauthToken || parsedOld.reauth_token)) {
            existingReauthToken = parsedOld.reauthToken || parsedOld.reauth_token;
          }
        } catch {}
        const authData = {
          username: username.toLowerCase(),
          passwordHash: hash,
          reauthToken: existingReauthToken,
          savedAt: Date.now()
        };
        localStorage.setItem('cabarian_offline_staff_auth', JSON.stringify(authData));
        localStorage.setItem('cabarian_offline_auth_staging', JSON.stringify(authData));
      } catch {}

      window.location.assign(targetRedirectUrl || 'registration.php');
    };

    const performOnlineLogin = async (isRetry = false) => {
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 10000);

        const formData = new FormData(form);
        const response = await fetch(form.action || 'login.php', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json, text/html;q=0.9',
            'X-Requested-With': 'XMLHttpRequest'
          },
          signal: controller.signal
        });
        window.clearTimeout(timeoutId);

        const contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          let payload = null;
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }

          if (payload && payload.success === true) {
            await handleLoginSuccess(payload.redirect || 'registration.php');
            return;
          }

          if (payload && payload.csrf_token) {
            const tokenInput = form.querySelector('input[name="csrf_token"]');
            if (tokenInput) tokenInput.value = payload.csrf_token;
          }

          const errorMsg = payload?.error ? String(payload.error).trim() : '';
          if (errorMsg && /session expired/i.test(errorMsg) && !isRetry) {
            await syncCsrfToken();
            return performOnlineLogin(true);
          }

          showError(errorMsg || 'Invalid username or password.');
          return;
        }

        const responseUrl = String(response.url || '').toLowerCase();
        const isKnownSuccessUrl = responseUrl.includes('registration.php')
          || responseUrl.includes('member.php')
          || responseUrl.includes('households')
          || responseUrl.includes('admin.php')
          || responseUrl.includes('index.php')
          || responseUrl.includes('settings.php');

        if (isKnownSuccessUrl && !responseUrl.includes('login.php')) {
          await handleLoginSuccess(response.url || 'registration.php');
          return;
        }

        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        const newTokenInput = doc.querySelector('input[name="csrf_token"]');
        const currentTokenInput = form.querySelector('input[name="csrf_token"]');
        if (newTokenInput && currentTokenInput && newTokenInput.value) {
          currentTokenInput.value = newTokenInput.value;
        }

        const errorDiv = doc.getElementById('error');
        const errorMsg = errorDiv ? errorDiv.textContent.trim() : '';

        if (errorMsg && /session expired/i.test(errorMsg) && !isRetry) {
          await syncCsrfToken();
          return performOnlineLogin(true);
        }

        if (errorMsg) {
          showError(errorMsg);
          return;
        }

        showError('Invalid username or password.');
      } catch (networkError) {
        await performOfflineLogin();
      }
    };

    await performOnlineLogin(false);
  });

  // Mobile adaptive keyboard handler for smooth viewport transitions
  (function initKeyboardAdaptive() {
    const inputs = document.querySelectorAll('.form-control');
    let blurTimer = null;

    inputs.forEach(function (input) {
      input.addEventListener('focus', function () {
        if (blurTimer) clearTimeout(blurTimer);
        document.body.classList.add('keyboard-open');
      });

      input.addEventListener('blur', function () {
        blurTimer = setTimeout(function () {
          const active = document.activeElement;
          if (!active || !active.classList.contains('form-control')) {
            document.body.classList.remove('keyboard-open');
          }
        }, 120);
      });
    });

    if (window.visualViewport) {
      let baseHeight = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', function () {
        const currentHeight = window.visualViewport.height;
        if (baseHeight - currentHeight > 150) {
          document.body.classList.add('keyboard-open');
        } else if (Math.abs(baseHeight - currentHeight) < 40) {
          const active = document.activeElement;
          if (!active || !active.classList.contains('form-control')) {
            document.body.classList.remove('keyboard-open');
          }
        }
      });
    }
  })();
})();
