export interface ActivityRoll {
  formula: string;
  result: number;
  timestamp: number;
}

export interface Activity {
  id: string;
  type: string;
  days: number;
  notes: string;
  status: "planned" | "completed";
  outcome: "success" | "failure" | null;
  formula?: string;
  rollCount?: number;
  rolls?: ActivityRoll[];
}

export interface HistoryEntry {
  id: string;
  startTime: number;
  endTime: number;
  activities: Activity[];
}

export interface DowntimeData {
  lastActiveTime: number | null;
  endTime: number | null;
  activities: Activity[];
  history?: HistoryEntry[];
}
