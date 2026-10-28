export type TimerRow = {
  id: string;
  aula: string;
  materia: string | null;
  duration_seconds: number;
  remaining_seconds: number;
  /** ISO timestamp: se impostato, il timer è in corso (fine = questo istante) */
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SettingsRow = {
  id: number;
  total_groups: number;
  updated_at: string | null;
};
