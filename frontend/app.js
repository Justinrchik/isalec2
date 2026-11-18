(() => {
  'use strict';

  const app = document.getElementById('app');
  const config = window.APP_CONFIG || {};
  const apiOrigin = typeof config.API_ORIGIN === 'string' ? config.API_ORIGIN.replace(/\/$/, '') : '';
  let session = null;
  let clockTimer = null;

  function route() {
    const value = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    return ['admin', 'page1', 'page2'].includes(value) ? value : 'login';
  }

  function apiUrl(path) {
    if (!/^https?:\/\//.test(apiOrigin)) {
      throw new Error('The frontend API origin has not been configured.');
    }
    return `${apiOrigin}${path}`;
  }

  async function request(path, options = {}) {
    const response = await fetch(apiUrl(path), {
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || 'Request failed.');
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function renderNavigation() {
    const nav = document.createElement('nav');
    const links = [
      ['Admin Landing Page', '#/admin'],
      ['Page 1', '#/page1'],
      ['Page 2', '#/page2']
    ];
    for (const [label, href] of links) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      nav.append(link);
    }
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = 'Logout';
    logout.addEventListener('click', logoutUser);
    nav.append(logout);
    return nav;
  }

  function renderLogin(errorMessage = '') {
    clearInterval(clockTimer);
    app.replaceChildren();
    const intro = document.createElement('p');
    intro.textContent = 'Sign in to access the protected admin pages.';
    const form = document.createElement('form');
    form.noValidate = true;

    const usernameLabel = document.createElement('label');
    usernameLabel.textContent = 'Username';
    const username = document.createElement('input');
    username.name = 'username';
    username.autocomplete = 'username';
    username.required = true;
    usernameLabel.append(username);

    const passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'Password';
    const password = document.createElement('input');
    password.name = 'password';
    password.type = 'password';
    password.autocomplete = 'current-password';
    password.required = true;
    passwordLabel.append(password);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Login';
    form.append(usernameLabel, passwordLabel, submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await request('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.value, password: password.value })
        });
        await refreshSession();
        window.location.hash = '#/admin';
      } catch (error) {
        renderLogin(error.message || 'Unable to log in.');
      }
    });

    app.append(intro, form);
    if (errorMessage) {
      const error = document.createElement('p');
      error.className = 'error';
      error.role = 'alert';
      error.textContent = errorMessage;
      app.append(error);
    }
    username.focus();
  }

  function renderProtectedPage() {
    clearInterval(clockTimer);
    if (!session) {
      window.location.hash = '#/login';
      renderLogin('Please log in to continue.');
      return;
    }
    app.replaceChildren();
    const currentRoute = route();

    if (currentRoute === 'admin') {
      const welcome = document.createElement('h2');
      welcome.textContent = `Welcome to Team ${session.teamId}`;
      const details = document.createElement('div');
      details.className = 'details';
      const secret = document.createElement('p');
      const secretLabel = document.createElement('strong');
      secretLabel.textContent = 'Secret: ';
      secret.append(secretLabel, `"${session.secret}"`);
      const time = document.createElement('p');
      const timeLabel = document.createElement('strong');
      timeLabel.textContent = 'Time: ';
      time.append(timeLabel);
      const clock = document.createElement('span');
      clock.id = 'browser-time';
      time.append(clock);
      details.append(secret, time);
      app.append(welcome, details);
      const updateClock = () => { clock.textContent = new Date().toLocaleString(); };
      updateClock();
      clockTimer = window.setInterval(updateClock, 1000);
    } else {
      const heading = document.createElement('h2');
      heading.textContent = currentRoute === 'page1' ? 'Page 1' : 'Page 2';
      const text = document.createElement('p');
      text.textContent = currentRoute === 'page1' ? 'Page 1' : 'Page 2';
      app.append(heading, text);
    }
    app.append(renderNavigation());
  }

  async function refreshSession() {
    session = await request('/api/session');
    return session;
  }

  async function logoutUser() {
    try {
      await request('/api/logout', { method: 'POST' });
    } catch (_) {
      // The browser should still be returned to the login screen if a network error occurs.
    }
    session = null;
    window.location.hash = '#/login';
    renderLogin('You have been logged out.');
  }

  async function render() {
    if (route() === 'login') {
      renderLogin();
      return;
    }
    try {
      await refreshSession();
      renderProtectedPage();
    } catch (error) {
      session = null;
      window.location.hash = '#/login';
      renderLogin(error.status === 401 ? 'Please log in to continue.' : error.message);
    }
  }

  window.addEventListener('hashchange', render);
  render();
})();

