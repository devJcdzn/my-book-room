export const ONBOARDING_VERSION = 2;
export const ONBOARDING_STEPS = 12;

export const HABIT_QUESTIONS = [
  {
    key: 'frequency',
    title: 'Como anda sua leitura?',
    subtitle: 'Não existe resposta certa. Cada começo tem seu ritmo.',
    options: [
      { id: 'frequent', label: 'Leio com frequência' },
      { id: 'sometimes', label: 'Leio de vez em quando' },
      { id: 'returning', label: 'Quero voltar a ler' },
    ],
  },
  {
    key: 'intention',
    title: 'O que você busca na leitura?',
    subtitle: 'O seu motivo é um bom ponto de partida.',
    options: [
      { id: 'relax', label: 'Um momento para desacelerar' },
      { id: 'explore', label: 'Aprender e explorar ideias' },
      { id: 'consistency', label: 'Ler com mais constância' },
    ],
  },
  {
    key: 'moment',
    title: 'Quando a leitura pode caber no seu dia?',
    subtitle: 'Pode ser só uma preferência, sem compromisso.',
    options: [
      { id: 'morning', label: 'Pela manhã' },
      { id: 'break', label: 'Em uma pausa do dia' },
      { id: 'evening', label: 'À noite' },
      { id: 'flexible', label: 'Sem horário definido' },
    ],
  },
] as const;

export type OnboardingAnswers = {
  frequency?: 'frequent' | 'sometimes' | 'returning';
  intention?: 'relax' | 'explore' | 'consistency';
  moment?: 'morning' | 'break' | 'evening' | 'flexible';
};

export function normalizeOnboardingAnswers(value: unknown): OnboardingAnswers {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(HABIT_QUESTIONS.flatMap((question) => {
    const answer = (value as Record<string, unknown>)[question.key];
    return question.options.some((option) => option.id === answer)
      ? [[question.key, answer]] : [];
  }));
}

export function normalizeOnboardingStep(step: unknown, version: unknown, status: unknown) {
  if (status === 'completed') return ONBOARDING_STEPS - 1;
  if (version !== ONBOARDING_VERSION) return 0;
  return typeof step === 'number' && Number.isFinite(step)
    ? Math.min(ONBOARDING_STEPS - 1, Math.max(0, Math.round(step))) : 0;
}

export function getOnboardingMessage(answers: OnboardingAnswers) {
  const moment = {
    morning: 'Suas manhãs podem ganhar',
    break: 'Uma pausa no seu dia pode trazer',
    evening: 'Suas noites podem ganhar',
    flexible: 'A leitura pode ser',
  }[answers.moment ?? 'flexible'];
  const intention = {
    relax: 'um momento para desacelerar.',
    explore: 'um espaço para descobrir novas ideias.',
    consistency: 'um hábito que cabe na sua vida.',
  }[answers.intention ?? 'consistency'];
  const rhythm = {
    frequent: 'Vamos cuidar desse espaço que a leitura já tem na sua vida.',
    sometimes: 'Vamos abrir espaço para a leitura, no seu ritmo.',
    returning: 'Você pode retomar de onde está, um pouco por vez.',
  }[answers.frequency ?? 'sometimes'];
  return { title: `${moment} ${intention}`, body: rhythm };
}
