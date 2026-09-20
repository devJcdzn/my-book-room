import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePersistedState, ONBOARDING_VERSION, useLibraryStore } from '../src/store/library-store';

test('onboarding ausente em um snapshot antigo começa na primeira etapa', () => {
  const normalized = normalizePersistedState({ books: [] });

  assert.equal(normalized.onboardingVersion, ONBOARDING_VERSION);
  assert.equal(normalized.onboardingStatus, 'not_started');
  assert.equal(normalized.onboardingStep, 0);
});

test('onboarding normaliza retomada e limita a etapa válida', () => {
  const normalized = normalizePersistedState({
    books: [],
    onboardingStatus: 'in_progress',
    onboardingStep: 99,
  });

  assert.equal(normalized.onboardingStatus, 'in_progress');
  assert.equal(normalized.onboardingStep, 3);
});

test('ações do onboarding persistem avanço, conclusão, pulo e reinício', () => {
  useLibraryStore.setState({
    onboardingVersion: ONBOARDING_VERSION,
    onboardingStatus: 'not_started',
    onboardingStep: 0,
  });

  useLibraryStore.getState().setOnboardingStep(2);
  assert.equal(useLibraryStore.getState().onboardingStatus, 'in_progress');
  assert.equal(useLibraryStore.getState().onboardingStep, 2);

  useLibraryStore.getState().completeOnboarding();
  assert.equal(useLibraryStore.getState().onboardingStatus, 'completed');
  assert.equal(useLibraryStore.getState().onboardingStep, 3);

  useLibraryStore.getState().restartOnboarding();
  assert.equal(useLibraryStore.getState().onboardingStatus, 'in_progress');
  assert.equal(useLibraryStore.getState().onboardingStep, 0);

  useLibraryStore.getState().skipOnboarding();
  assert.equal(useLibraryStore.getState().onboardingStatus, 'skipped');

  useLibraryStore.setState({ onboardingStatus: 'not_started', onboardingStep: 0 });
});
