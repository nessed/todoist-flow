import { TodoistTask, TodoistProject, ProcessedTask, DayStats, ProjectStats, HourStats, RecapStats } from "@/types/todoist";
import { format, parseISO, startOfDay, differenceInDays, isAfter, isBefore } from "date-fns";

const TODOIST_API_BASE = "https://api.todoist.com/rest/v2";

export async function fetchCompletedTasks(token: string, since?: string): Promise<TodoistTask[]> {
  const url = new URL(`${TODOIST_API_BASE}/tasks`);
  const headers = { Authorization: `Bearer ${token}` };
  
  const response = await fetch(url.toString(), { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.statusText}`);
  }
  
  // Note: Todoist REST API v2 doesn't have a direct "completed tasks" endpoint
  // You'd need to use the Sync API or keep track of completed tasks
  // For MVP, we'll use mock data structure
  return [];
}

export async function fetchProjects(token: string): Promise<TodoistProject[]> {
  const url = `${TODOIST_API_BASE}/projects`;
  const headers = { Authorization: `Bearer ${token}` };
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }
  
  return response.json();
}

export function processTasks(tasks: TodoistTask[]): ProcessedTask[] {
  return tasks.map(task => ({
    ...task,
    completedDate: parseISO(task.completed_at),
    hour: parseISO(task.completed_at).getHours(),
  }));
}

export function calculateDayStats(
  tasks: ProcessedTask[],
  startDate: Date,
  endDate: Date
): DayStats[] {
  const stats = new Map<string, DayStats>();
  
  // Initialize all days in range
  let currentDate = startOfDay(startDate);
  while (isBefore(currentDate, endDate) || currentDate.getTime() === endDate.getTime()) {
    const dateKey = format(currentDate, "yyyy-MM-dd");
    stats.set(dateKey, { date: dateKey, count: 0, tasks: [] });
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }
  
  // Add tasks to their respective days
  tasks.forEach(task => {
    const dateKey = format(startOfDay(task.completedDate), "yyyy-MM-dd");
    const dayStat = stats.get(dateKey);
    if (dayStat) {
      dayStat.count++;
      dayStat.tasks.push(task);
    }
  });
  
  return Array.from(stats.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateProjectStats(
  tasks: ProcessedTask[],
  projects: TodoistProject[]
): ProjectStats[] {
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const stats = new Map<string, ProjectStats>();
  
  tasks.forEach(task => {
    const project = projectMap.get(task.project_id);
    if (!project) return;
    
    const existing = stats.get(task.project_id);
    if (existing) {
      existing.count++;
    } else {
      stats.set(task.project_id, {
        projectId: task.project_id,
        projectName: project.name,
        count: 1,
        color: project.color,
      });
    }
  });
  
  return Array.from(stats.values()).sort((a, b) => b.count - a.count);
}

export function calculateHourStats(tasks: ProcessedTask[]): HourStats[] {
  const stats = new Map<number, number>();
  
  for (let hour = 0; hour < 24; hour++) {
    stats.set(hour, 0);
  }
  
  tasks.forEach(task => {
    const count = stats.get(task.hour) || 0;
    stats.set(task.hour, count + 1);
  });
  
  return Array.from(stats.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);
}

export function calculateRecapStats(
  dayStats: DayStats[],
  projectStats: ProjectStats[]
): RecapStats {
  const totalDone = dayStats.reduce((sum, day) => sum + day.count, 0);
  
  // Calculate streak
  let currentStreak = 0;
  const sortedDays = [...dayStats].reverse();
  for (const day of sortedDays) {
    if (day.count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  // Best day
  const bestDay = dayStats.reduce(
    (best, day) => (day.count > best.count ? day : best),
    { date: "", count: 0, tasks: [] }
  );
  
  // Top project
  const topProjectStats = projectStats[0];
  
  return {
    totalDone,
    currentStreak,
    bestDay: { date: bestDay.date, count: bestDay.count },
    topProject: { 
      name: topProjectStats?.projectName || "None", 
      count: topProjectStats?.count || 0 
    },
  };
}
