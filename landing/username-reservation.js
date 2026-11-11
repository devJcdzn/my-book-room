(function () {
  'use strict';

  const config = window.NOOKLY_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || '').replace(/\/+$/, '');
  const publishableKey = String(config.supabasePublishableKey || '').trim();
  const form = document.getElementById('username-reservation-form');
  const emailInput = document.getElementById('reservation-email');
  const usernameInput = document.getElementById('reservation-username');
  const submitButton = document.getElementById('username-reservation-submit');
  const status = document.getElementById('username-reservation-status');
  const privacyNote = document.getElementById('username-reservation-privacy');
  const success = document.getElementById('username-reservation-success');
  const reservedUsername = document.getElementById('reserved-username');
  const usernamePattern = /^[a-z0-9_]{3,20}$/;
  let checkedUsername = '';
  let checkedEmail = '';
  let pending = false;

  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state || '';
  }

  function resetAvailability() {
    checkedUsername = '';
    checkedEmail = '';
    submitButton.textContent = 'Verificar disponibilidade';
    setStatus('', '');
  }

  usernameInput.addEventListener('input', function () {
    const normalized = usernameInput.value.trim().toLowerCase();
    if (usernameInput.value !== normalized) usernameInput.value = normalized;
    if (checkedUsername && checkedUsername !== normalized) resetAvailability();
  });

  emailInput.addEventListener('input', function () {
    if (checkedEmail && checkedEmail !== emailInput.value.trim().toLowerCase()) resetAvailability();
  });

  async function requestReservation(payload) {
    if (!supabaseUrl || !publishableKey) throw new Error('configuration_missing');

    const response = await fetch(`${supabaseUrl}/functions/v1/reserve-username`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('invalid_response');
    }

    return { response, result };
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;

    const email = emailInput.value.trim().toLowerCase();
    const username = usernameInput.value.trim().toLowerCase();
    if (!usernamePattern.test(username)) {
      usernameInput.setCustomValidity('Use de 3 a 20 letras, números ou _.');
      form.reportValidity();
      usernameInput.setCustomValidity('');
      return;
    }

    const isConfirmation = checkedUsername === username && checkedEmail === email;
    pending = true;
    submitButton.disabled = true;
    emailInput.disabled = true;
    usernameInput.disabled = true;
    submitButton.textContent = isConfirmation ? 'Salvando sua reserva…' : 'Verificando…';
    setStatus(isConfirmation ? 'Confirmando sua escolha.' : 'Consultando a disponibilidade.', 'pending');

    try {
      const { response, result } = await requestReservation(
        isConfirmation ? { action: 'reserve', email, username } : { action: 'check', username },
      );

      if (!isConfirmation && response.ok && result.available === true) {
        checkedUsername = username;
        checkedEmail = email;
        submitButton.textContent = 'Confirmar reserva';
        setStatus(`@${username} está disponível. Confirme para reservar.`, 'available');
        return;
      }

      if (result.error === 'username_taken' || (!isConfirmation && response.ok && result.available === false)) {
        resetAvailability();
        setStatus('Esse nome já foi reservado. Escolha outro e verifique novamente.', 'error');
        return;
      }

      if (result.error === 'email_already_reserved') {
        resetAvailability();
        setStatus('Este email já tem uma reserva. Para corrigir os dados, fale com o suporte.', 'error');
        return;
      }

      if (isConfirmation && response.ok && result.status === 'reserved') {
        form.hidden = true;
        privacyNote.hidden = true;
        reservedUsername.textContent = `@${username}`;
        success.hidden = false;
        return;
      }

      resetAvailability();
      setStatus('Não foi possível concluir agora. Tente novamente em instantes.', 'error');
    } catch {
      resetAvailability();
      setStatus('Não foi possível conectar ao Nookly agora. Tente novamente em instantes.', 'error');
    } finally {
      pending = false;
      submitButton.disabled = false;
      emailInput.disabled = false;
      usernameInput.disabled = false;
      if (!form.hidden && submitButton.textContent === 'Verificando…') {
        submitButton.textContent = 'Verificar disponibilidade';
      }
      if (!form.hidden && submitButton.textContent === 'Salvando sua reserva…') {
        submitButton.textContent = 'Confirmar reserva';
      }
    }
  });
})();
