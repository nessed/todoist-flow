export interface TodoistTask {
  id: string;
  content: string;
  completed_at: string;
  project_id: string;
  labels: string[];
}

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
}

export interface ProcessedTask extends TodoistTask {
  completedDate: Date;
  hour: number;
}

export interface DayStats {
  date: string;
  count: number;
  tasks: ProcessedTask[];
}

export interface ProjectStats {
  projectId: string;
  projectName: string;
  count: number;
  color: string;
}

export interface HourStats {
  hour: number;
  count: number;
}

export interface RecapStats {
  totalDone: number;
  currentStreak: number;
  bestDay: { date: string; count: number };
  topProject: { name: string; count: number };
}
