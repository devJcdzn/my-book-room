import assert from 'node:assert/strict';
import test from 'node:test';
import { HABIT_QUESTIONS, ONBOARDING_VERSION, getOnboardingMessage, normalizeOnboardingAnswers, normalizeOnboardingStep } from '../src/utils/onboarding';

test('aceita apenas respostas conhecidas, sem propriedades extras', () => {
  assert.deepEqual(normalizeOnboardingAnswers(undefined), {});
  assert.deepEqual(normalizeOnboardingAnswers({ frequency: 'unknown', intention: 'relax', moment: 'evening', extra: true }), { intention: 'relax', moment: 'evening' });
});

test('retoma etapas válidas e reinicia o fluxo antigo sem reabrir os concluídos', () => {
  assert.equal(normalizeOnboardingStep(4, ONBOARDING_VERSION, 'in_progress'), 4);
  assert.equal(normalizeOnboardingStep(99, ONBOARDING_VERSION, 'in_progress'), 11);
  assert.equal(normalizeOnboardingStep(NaN, ONBOARDING_VERSION, 'in_progress'), 0);
  assert.equal(normalizeOnboardingStep(2, 1, 'in_progress'), 0);
  assert.equal(normalizeOnboardingStep(3, 1, 'completed'), 11);
});

test('todas as 36 combinações geram mensagens naturais e sem metas ou estatísticas', () => {
  for (const frequency of HABIT_QUESTIONS[0].options) {
    for (const intention of HABIT_QUESTIONS[1].options) {
      for (const moment of HABIT_QUESTIONS[2].options) {
        const message = getOnboardingMessage({ frequency: frequency.id, intention: intention.id, moment: moment.id });
        assert.ok(message.title.length > 20);
        assert.ok(message.body.length > 20);
        assert.doesNotMatch(message.title + message.body, /undefined|\d|%|notifica|meta|estresse/);
      }
    }
  }
  assert.match(getOnboardingMessage({ moment: 'flexible', intention: 'explore', frequency: 'returning' }).title, /^A leitura pode ser um espaço/);
  assert.match(getOnboardingMessage({ frequency: 'returning' }).body, /retomar/);
});

test('o reset remove perfil, onboarding e catálogo do histórico de voltar', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  // Exercise the router shipped with the installed Expo version, without loading native UI.
  const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter.js');
  const { reset, goBack } = require('../node_modules/expo-router/build/react-navigation/routers/CommonActions.js');
  const options = { routeNames: ['(tabs)', 'onboarding', 'books/catalog', 'auth/callback'], routeParamList: {}, routeGetIdList: {} };
  const router = StackRouter({ initialRouteName: '(tabs)' });
  const state = router.getRehydratedState({
    stale: true, index: 3,
    routes: [{ name: '(tabs)', state: { index: 0, routes: [{ name: 'profile' }] } }, { name: 'onboarding' }, { name: 'books/catalog' }, { name: 'auth/callback' }],
  }, options);
  const room = router.getStateForAction(state, reset({
    index: 0, routes: [{ name: '(tabs)', state: { index: 0, routes: [{ name: 'index' }] } }],
  }), options);
  assert.deepEqual(room.routes.map((route: { name: string }) => route.name), ['(tabs)']);
  assert.equal(room.routes[0].state.routes[0].name, 'index');
  assert.equal(router.getStateForAction(room, goBack(), options), null);
});
