(function () {
  'use strict';

  const config = window.BOOKROOM_CONFIG || {};
  const endpoint = String(config.waitlistEndpoint || '').trim();
  const turnstileSiteKey = String(config.turnstileSiteKey || '').trim();
  const totalSlots = 200;
  const forms = Array.from(document.querySelectorAll('[data-waitlist-form]'));
  const counterNodes = Array.from(document.querySelectorAll('[data-counter]'));
  const availabilityNodes = Array.from(document.querySelectorAll('[data-availability]'));
  const configured =
    endpoint.startsWith('https://') &&
    !endpoint.includes('YOUR_PROJECT_REF') &&
    turnstileSiteKey.length > 0 &&
    !turnstileSiteKey.includes('YOUR_');

  const setCounter = (remaining, full) => {
    if (!Number.isFinite(remaining)) return;
    const safeRemaining = Math.max(0, Math.min(totalSlots, Math.round(remaining)));
    const label = full || safeRemaining === 0
      ? 'A primeira turma está completa'
      : `${safeRemaining} de ${totalSlots} convites disponíveis`;

    counterNodes.forEach((node) => {
      node.textContent = label;
    });

    availabilityNodes.forEach((node) => {
      node.dataset.full = String(full || safeRemaining === 0);
    });

    if (full || safeRemaining === 0) {
      forms.forEach((form) => {
        const button = form.querySelector('button[type="submit"]');
        const input = form.querySelector('input[type="email"]');
        if (button) {
          button.disabled = true;
          button.innerHTML = 'Waitlist encerrada';
        }
        if (input) input.disabled = true;
      });
    }
  };

  const setStatus = (form, message, tone) => {
    const status = form.parentElement?.querySelector('[data-form-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone || '';
  };

  const resetTurnstile = (form) => {
    if (!form._turnstileId || !window.turnstile) return;
    window.turnstile.reset(form._turnstileId);
    form.dataset.turnstileToken = '';
    form.dataset.turnstileInteractive = 'false';
  };

  const getTurnstileToken = async (form) => {
    if (form.dataset.turnstileToken) return form.dataset.turnstileToken;
    if (!window.turnstile || !form._turnstileId) {
      throw new Error('TURNSTILE_UNAVAILABLE');
    }

    window.turnstile.execute(form._turnstileId);

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        form._resolveTurnstile = null;
        form._rejectTurnstile = null;
        reject(new Error('TURNSTILE_TIMEOUT'));
      }, 15000);

      form._resolveTurnstile = (token) => {
        window.clearTimeout(timeout);
        form._resolveTurnstile = null;
        form._rejectTurnstile = null;
        resolve(token);
      };

      form._rejectTurnstile = () => {
        window.clearTimeout(timeout);
        form._resolveTurnstile = null;
        form._rejectTurnstile = null;
        reject(new Error('TURNSTILE_FAILED'));
      };
    });
  };

  window.bookroomTurnstileReady = function () {
    if (!configured || !window.turnstile) return;

    forms.forEach((form) => {
      const container = form.querySelector('[data-turnstile]');
      if (!container || form._turnstileId) return;

      form._turnstileId = window.turnstile.render(container, {
        sitekey: turnstileSiteKey,
        appearance: 'interaction-only',
        execution: 'execute',
        action: 'waitlist',
        language: 'pt-BR',
        callback: (token) => {
          form.dataset.turnstileToken = token;
          form.dataset.turnstileInteractive = 'false';
          if (form._resolveTurnstile) form._resolveTurnstile(token);
        },
        'before-interactive-callback': () => {
          form.dataset.turnstileInteractive = 'true';
        },
        'after-interactive-callback': () => {
          form.dataset.turnstileInteractive = 'false';
        },
        'error-callback': () => {
          form.dataset.turnstileInteractive = 'false';
          if (form._rejectTurnstile) form._rejectTurnstile();
        },
        'expired-callback': () => {
          form.dataset.turnstileToken = '';
          form.dataset.turnstileInteractive = 'false';
          if (form._rejectTurnstile) form._rejectTurnstile();
        },
      });
    });
  };

  const fetchAvailability = async () => {
    if (!configured) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const result = await response.json();
      setCounter(result.remaining, result.full);
    } catch (_error) {
      // The fallback text already avoids claiming an unverified live count.
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const submitWaitlist = async (form) => {
    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"]');
    const honeypot = form.querySelector('input[name="company"]');
    if (!input || !button) return;

    const email = input.value.trim().toLowerCase();
    if (!input.checkValidity()) {
      setStatus(form, 'Digite um email válido para sua Conta Apple.', 'error');
      input.focus();
      return;
    }

    if (!configured) {
      setStatus(form, 'A waitlist ainda está sendo configurada. Tente novamente em breve.', 'error');
      return;
    }

    if (honeypot?.value) return;

    button.disabled = true;
    setStatus(form, 'Reservando seu lugar…');

    try {
      const turnstileToken = await getTurnstileToken(form);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, turnstileToken, company: honeypot?.value || '' }),
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 409 || result.status === 'full') {
        setCounter(0, true);
        setStatus(form, 'A primeira turma está completa.', 'error');
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || `HTTP_${response.status}`);
      }

      input.value = '';
      if (result.remaining !== undefined) setCounter(result.remaining, false);
      setStatus(
        form,
        result.status === 'duplicate'
          ? 'Este email já está na lista. Você receberá o convite pelo TestFlight.'
          : 'Você está na lista. Enviaremos o convite pelo TestFlight.',
        'success',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const friendlyMessage = message.startsWith('TURNSTILE')
        ? 'Confirme a proteção anti-spam e tente novamente.'
        : 'Não conseguimos concluir agora. Tente novamente em alguns instantes.';
      setStatus(form, friendlyMessage, 'error');
    } finally {
      resetTurnstile(form);
      button.disabled = false;
    }
  };

  forms.forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void submitWaitlist(form);
    });
  });

  const revealItems = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14 },
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  void fetchAvailability();
})();
