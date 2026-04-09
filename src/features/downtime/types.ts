export interface Activity {
  id: string;
  type: string;
  days: number;
  notes: string;
  status: "planned" | "completed";
  outcome: "success" | "failure" | null;
}

export interface DowntimeData {
  lastActiveTime: number | null;
  endTime: number | null;
  activities: Activity[];
}
