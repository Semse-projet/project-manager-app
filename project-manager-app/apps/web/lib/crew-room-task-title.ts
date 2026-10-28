/** Keep the room visible in JobTask.title without adding a database migration. */
export const MAX_CREW_ROOM_LENGTH = 60;
export const MAX_CREW_WORK_LENGTH = 130;

export function buildCrewRoomTaskTitle(room: string, work: string): string | null {
  const area = room.replace(/\s+/g, " ").trim();
  const task = work.replace(/\s+/g, " ").trim();
  if (!area || area.length > MAX_CREW_ROOM_LENGTH || task.length < 2 || task.length > MAX_CREW_WORK_LENGTH) return null;
  return `${area} — ${task}`;
}
