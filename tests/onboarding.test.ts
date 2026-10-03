import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePersistedState, ONBOARDING_VERSION, readLibraryStorageScope, useLibraryStore } from '../src/store/library-store';
test('onboarding ausente em um snapshot antigo começa na primeira etapa', () => {
  const normalized = normalizePersistedState({ books: [] });

  assert.equal(normalized.onboardingVersion, ONBOARDING_VERSION);
  assert.equal(normalized.onboardingStatus, 'not_started');
  assert.equal(normalized.onboardingStep, 0);
});
test('onboarding normaliza retomada e limita a etapa válida', () => {
  const normalized = normalizePersistedState({
    books: [],
    onboardingVersion: ONBOARDING_VERSION,
    onboardingStatus: 'in_progress',
    onboardingStep: 99,
  });

  assert.equal(normalized.onboardingStatus, 'in_progress');
  assert.equal(normalized.onboardingStep, 11);
});
test('ações do onboarding persistem avanço, conclusão, pulo e reinício', async () => {
  useLibraryStore.setState({
    onboardingVersion: ONBOARDING_VERSION,
    onboardingStatus: 'not_started',
    onboardingStep: 0,
    onboardingAnswers: {},
  });

  useLibraryStore.getState().setOnboardingAnswers({ frequency: 'returning', intention: 'relax', moment: 'evening' });
  useLibraryStore.getState().setOnboardingStep(2);
  assert.equal(useLibraryStore.getState().onboardingStatus, 'in_progress');
  assert.equal(useLibraryStore.getState().onboardingStep, 2);
  const saved = await readLibraryStorageScope('guest');
  assert.equal(saved?.onboardingStep, 2);
  assert.deepEqual(saved?.onboardingAnswers, { frequency: 'returning', intention: 'relax', moment: 'evening' });

  useLibraryStore.getState().completeOnboarding();
  assert.equal(useLibraryStore.getState().onboardingStatus, 'completed');
  assert.equal(useLibraryStore.getState().onboardingStep, 11);

  useLibraryStore.getState().restartOnboarding();
  assert.equal(useLibraryStore.getState().onboardingStatus, 'in_progress');
  assert.equal(useLibraryStore.getState().onboardingStep, 0);
  assert.equal(useLibraryStore.getState().onboardingAnswers.moment, 'evening');

  useLibraryStore.getState().skipOnboarding();
  assert.equal(useLibraryStore.getState().onboardingStatus, 'skipped');

  useLibraryStore.setState({ onboardingStatus: 'not_started', onboardingStep: 0, onboardingAnswers: {} });
});

test('a migração reinicia apenas o onboarding antigo em andamento', () => {
  for (const status of ['not_started', 'in_progress', 'completed', 'skipped'] as const) {
    const normalized = normalizePersistedState({
      onboardingVersion: 1, onboardingStatus: status, onboardingStep: 2,
      profile: { name: 'Jean' }, ambienceMode: 'night',
    });
    assert.equal(normalized.onboardingStatus, status);
    assert.equal(normalized.onboardingStep, status === 'completed' ? 11 : 0);
    assert.equal(normalized.profile.name, 'Jean');
    assert.equal(normalized.ambienceMode, 'night');
  }
});
test('respostas e etapa do novo onboarding sobrevivem ao snapshot', () => {
  const normalized = normalizePersistedState({
    onboardingVersion: ONBOARDING_VERSION, onboardingStatus: 'in_progress', onboardingStep: 4,
    onboardingAnswers: { frequency: 'sometimes', intention: 'explore', moment: 'flexible' },
  });
  assert.equal(normalized.onboardingStep, 4);
  assert.deepEqual(normalized.onboardingAnswers, { frequency: 'sometimes', intention: 'explore', moment: 'flexible' });
});

test('as etapas de apresentação retomam sem repetir nem concluir o onboarding', () => {
  for (const step of [6, 7, 8, 9, 10, 11]) {
    const normalized = normalizePersistedState({
      onboardingVersion: ONBOARDING_VERSION, onboardingStatus: 'in_progress', onboardingStep: step,
    });
    assert.equal(normalized.onboardingStep, step);
    assert.equal(normalized.onboardingStatus, 'in_progress');
  }
});
