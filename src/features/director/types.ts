export interface DirectorNote {
  id: string;
  text: string;
  realTimestamp: number; // ms since epoch
  foundryWorldTime: number; // seconds of in-game world time
}

export interface DirectorBeat {
  id: string;
  name: string;
  description?: string;
  sceneUuid: string | null;
  journalUuids: string[];
  actorUuids: string[];
  itemUuids: string[];
  notes: DirectorNote[];
}

export interface DirectorSession {
  id: string;
  name: string;
  description?: string;
  image?: string;
  createdAt: number; // ms since epoch
  beats: DirectorBeat[];
}

export interface DirectorData {
  sessions: DirectorSession[];
}

export type DirectorView =
  | { name: "sessions" }
  | { name: "beats"; sessionId: string }
  | { name: "beat-detail"; sessionId: string; beatId: string };
