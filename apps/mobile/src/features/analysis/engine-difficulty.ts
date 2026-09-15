export const engineDifficulties = [
  { id: 'apprentice', label: 'Aprendiz' },
  { id: 'beginner', label: 'Iniciante' },
  { id: 'casual', label: 'Casual' },
  { id: 'intermediate', label: 'Intermediário' },
  { id: 'advanced', label: 'Avançado' },
  { id: 'candidate_master', label: 'Candidato a mestre' },
  { id: 'master', label: 'Mestre' },
  { id: 'international_master', label: 'Mestre internacional' },
  { id: 'grandmaster', label: 'Grande mestre' },
  { id: 'world_champion', label: 'Campeão mundial' },
  { id: 'machine', label: 'Máquina' },
] as const;

export type EngineDifficulty = typeof engineDifficulties[number]['id'];
export const defaultEngineDifficulty: EngineDifficulty = 'intermediate';

export function parseEngineDifficulty(value: string | null): EngineDifficulty {
  if (value === 'expert') return 'grandmaster';
  if (value === 'maximum') return 'machine';
  return engineDifficulties.some(level => level.id === value) ? value as EngineDifficulty : defaultEngineDifficulty;
}
