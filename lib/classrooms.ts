export const CLASSROOMS = [
  "A1",
  "A2",
  "A3",
  "STEAM",
  "ARTE",
  "MATEMATICA",
  "ROBOTICA",
  "LABORATORIO",
] as const;

export function classroomOrder(aula: string): number {
  const i = (CLASSROOMS as readonly string[]).indexOf(aula);
  return i === -1 ? 1000 : i;
}
