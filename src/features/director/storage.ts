import { MODULE_ID, SETTINGS } from "../../settings";
import type { DirectorBeat, DirectorData, DirectorNote, DirectorSession } from "./types";

export function loadDirectorData(): DirectorData {
  return ((game.settings as any).get(MODULE_ID, SETTINGS.DIRECTOR_DATA) as DirectorData | undefined) ?? { sessions: [] };
}

export async function saveDirectorData(data: DirectorData): Promise<void> {
  await (game.settings as any).set(MODULE_ID, SETTINGS.DIRECTOR_DATA, data);
}

export async function createSession(name: string, description?: string, image?: string): Promise<DirectorSession> {
  const data = loadDirectorData();
  const session: DirectorSession = {
    id: (foundry.utils as any).randomID() as string,
    name,
    description,
    image,
    createdAt: Date.now(),
    beats: [],
  };
  data.sessions.unshift(session);
  await saveDirectorData(data);
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const data = loadDirectorData();
  data.sessions = data.sessions.filter((s) => s.id !== sessionId);
  await saveDirectorData(data);
}

export async function createBeat(sessionId: string, name: string, description?: string): Promise<DirectorBeat | null> {
  const data = loadDirectorData();
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const beat: DirectorBeat = {
    id: (foundry.utils as any).randomID() as string,
    name,
    description,
    sceneUuid: null,
    journalUuids: [],
    actorUuids: [],
    itemUuids: [],
    notes: [],
  };
  session.beats.push(beat);
  await saveDirectorData(data);
  return beat;
}

export async function deleteBeat(sessionId: string, beatId: string): Promise<void> {
  const data = loadDirectorData();
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.beats = session.beats.filter((b) => b.id !== beatId);
  await saveDirectorData(data);
}

export async function setBeatScene(sessionId: string, beatId: string, sceneUuid: string | null): Promise<void> {
  const data = loadDirectorData();
  const beat = findBeat(data, sessionId, beatId);
  if (!beat) return;
  beat.sceneUuid = sceneUuid;
  await saveDirectorData(data);
}

export async function addUuidToBeat(
  sessionId: string,
  beatId: string,
  field: "journalUuids" | "actorUuids" | "itemUuids",
  uuid: string,
): Promise<void> {
  const data = loadDirectorData();
  const beat = findBeat(data, sessionId, beatId);
  if (!beat) return;
  if (!beat[field].includes(uuid)) {
    beat[field].push(uuid);
  }
  await saveDirectorData(data);
}

export async function removeUuidFromBeat(
  sessionId: string,
  beatId: string,
  field: "journalUuids" | "actorUuids" | "itemUuids",
  uuid: string,
): Promise<void> {
  const data = loadDirectorData();
  const beat = findBeat(data, sessionId, beatId);
  if (!beat) return;
  beat[field] = beat[field].filter((u) => u !== uuid);
  await saveDirectorData(data);
}

export async function addNote(sessionId: string, beatId: string, text: string): Promise<DirectorNote | null> {
  const data = loadDirectorData();
  const beat = findBeat(data, sessionId, beatId);
  if (!beat) return null;
  const note: DirectorNote = {
    id: (foundry.utils as any).randomID() as string,
    text,
    realTimestamp: Date.now(),
    foundryWorldTime: (game as any).time?.worldTime ?? 0,
  };
  beat.notes.push(note);
  await saveDirectorData(data);
  return note;
}

export async function deleteNote(sessionId: string, beatId: string, noteId: string): Promise<void> {
  const data = loadDirectorData();
  const beat = findBeat(data, sessionId, beatId);
  if (!beat) return;
  beat.notes = beat.notes.filter((n) => n.id !== noteId);
  await saveDirectorData(data);
}

function findBeat(data: DirectorData, sessionId: string, beatId: string): DirectorBeat | undefined {
  return data.sessions.find((s) => s.id === sessionId)?.beats.find((b) => b.id === beatId);
}
