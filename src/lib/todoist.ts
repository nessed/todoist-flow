import {
  TodoistTask,
  TodoistProject,
  ProcessedTask,
  DayStats,
  ProjectStats,
  HourStats,
  RecapStats,
  TodoistUserProfile,
  TodoistActiveTask,
} from "@/types/todoist";
import { format, parseISO, startOfDay, differenceInDays, isAfter, isBefore } from "date-fns";

const API_BASE = "/api/todoist";

type CompletedItemResponse = {
  task_id?: string | number;
  id?: string | number;
  content?: string;
  completed_at?: string;
  project_id?: string | number;
  labels?: string[];
};

type ProjectResponse = {
  id: string | number;
  name?: string;
  color?: string;
};

type UpcomingTaskResponse = {
  id?: string | number;
  content?: string;
  project_id?: string | number;
  labels?: string[];
  priority?: number;
  due?: {
    date?: string | null;
    datetime?: string | null;
    timezone?: string | null;
  } | null;
  section_id?: string | number | null;
  url?: string;
};

type ProfileResponse = {
  id?: string | number;
  full_name?: string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
  image_id?: string | number | null;
  timezone?: string | null;
};

export class ApiError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function apiRequest(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  if (response.status === 401) {
    throw new Error("Authentication failed");
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let payload: unknown;
    let message = "Request failed";

    if (contentType.includes("application/json")) {
      try {
        payload = await response.json();
        if (payload && typeof payload === "object" && "error" in payload) {
          const errorMessage = (payload as { error?: unknown }).error;
          if (typeof errorMessage === "string" && errorMessage.trim().length > 0) {
            message = errorMessage;
          }
        } else if (payload && typeof payload === "object" && "message" in payload) {
          const errorMessage = (payload as { message?: unknown }).message;
          if (typeof errorMessage === "string" && errorMessage.trim().length > 0) {
            message = errorMessage;
          }
        } else if (typeof payload === "string" && payload.trim().length > 0) {
          message = payload;
        }
      } catch {
        payload = undefined;
      }
    } else {
      const text = await response.text();
      if (text.trim().length > 0) {
        message = text;
      }
    }

    throw new ApiError(message, response.status, payload);
  }

  return response.json();
}

export async function requestTodoistAuthorizeUrl({ state, scope }: { state: string; scope?: string }) {
  const params = new URLSearchParams({ state });
  if (scope) {
    params.set("scope", scope);
  }
  const data = await apiRequest(`/auth-url?${params.toString()}`, {
    method: "GET",
  });
  return data.authorizeUrl as string;
}

export async function completeTodoistOAuth({ code, state }: { code: string; state: string }) {
  const data = await apiRequest("/callback", {
    method: "POST",
    body: JSON.stringify({ code, state }),
  });
  return data as { success: boolean; profile: TodoistUserProfile | null };
}

export async function establishSessionWithToken(token: string) {
  const data = await apiRequest("/token-login", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  return data as { success: boolean; profile: TodoistUserProfile | null };
}

export async function fetchSession() {
  const data = await apiRequest("/session", { method: "GET" });
  return data as { authenticated: boolean; profile: TodoistUserProfile | null };
}

export async function logoutSession() {
  await apiRequest("/logout", { method: "POST" });
}

export async function fetchCompletedTasks(since?: string): Promise<TodoistTask[]> {
  const params = new URLSearchParams();
  if (since) {
    params.set("since", since);
  }

  const data = (await apiRequest(`/completed?${params.toString()}`, {
    method: "GET",
  })) as { items?: CompletedItemResponse[] };

  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((item) => ({
    id: item.task_id !== undefined ? String(item.task_id) : item.id !== undefined ? String(item.id) : "",
    content: item.content ?? "",
    completed_at: item.completed_at ?? "",
    project_id: item.project_id !== undefined ? String(item.project_id) : "",
    labels: Array.isArray(item.labels) ? item.labels : [],
  }));
}

export async function fetchProjects(): Promise<TodoistProject[]> {
  const data = (await apiRequest("/projects", { method: "GET" })) as { projects?: ProjectResponse[] };
  const projectsData = Array.isArray(data.projects) ? data.projects : [];
  return projectsData.map((project) => ({
    id: String(project.id),
    name: project.name ?? `Project ${project.id}`,
    color: project.color ?? "#808080",
  }));
}


export async function fetchUpcomingTasks(
  filter: string = "(overdue | today | due before: +7 days) & !@done"
): Promise<TodoistActiveTask[]> {
  const params = new URLSearchParams({ filter });
  const data = (await apiRequest(`/upcoming?${params.toString()}`, {
    method: "GET",
  })) as { tasks?: UpcomingTaskResponse[] };

  const tasks = Array.isArray(data.tasks) ? data.tasks : [];

  return tasks.map((task) => ({
    id: task.id !== undefined ? String(task.id) : "",
    content: task.content ?? "",
    project_id: task.project_id !== undefined ? String(task.project_id) : "",
    labels: Array.isArray(task.labels) ? task.labels : [],
    priority: typeof task.priority === "number" ? task.priority : 1,
    due: task.due
      ? {
          date: task.due.date ?? null,
          datetime: task.due.datetime ?? null,
          timezone: task.due.timezone ?? null,
        }
      : null,
    section_id: task.section_id !== undefined && task.section_id !== null ? String(task.section_id) : null,
    url: task.url ?? undefined,
  }));
}


export async function fetchUserProfile(): Promise<TodoistUserProfile> {
  const data = (await apiRequest("/profile", { method: "GET" })) as { profile?: ProfileResponse | null };
  const profile = data?.profile ?? {};

  const rawImageId = profile.image_id ?? null;
  let avatarUrl: string | null = null;

  if (typeof profile.avatar_url === "string" && profile.avatar_url.length > 0) {
    avatarUrl = profile.avatar_url;
  }

  return {
    id: profile.id !== undefined ? String(profile.id) : "user",
    full_name: profile.full_name ?? profile.name ?? "Todoist user",
    email: profile.email ?? "",
    avatar_url: avatarUrl,
    image_id: rawImageId !== null && rawImageId !== undefined ? String(rawImageId) : null,
    timezone: profile.timezone ?? null,
  };
}


// --- Data Processing Functions (Keep the robust versions from previous step) ---

export function processTasks(tasks: TodoistTask[]): ProcessedTask[] {
  // Ensure tasks is an array before processing
  if (!Array.isArray(tasks)) {
    console.error("[processTasks] Input is not an array:", tasks);
    return [];
  }
  return tasks
     .filter(task => task && task.completed_at) // Add check for task itself being truthy
     .map(task => {
        try {
           const completedDate = parseISO(task.completed_at);
            if (isNaN(completedDate.getTime())) {
                throw new Error('Invalid date parsed');
            }
            return {
                ...task,
                completedDate: completedDate,
                hour: completedDate.getHours(),
            };
        } catch (e) {
            console.error(`[processTasks] Error parsing date for task ID ${task.id}: '${task.completed_at}'`, e);
            return null;
        }
    })
    .filter((task): task is ProcessedTask => task !== null);
}


export function calculateDayStats(
  tasks: ProcessedTask[],
  startDate: Date,
  endDate: Date
): DayStats[] {
  const stats = new Map<string, DayStats>();

  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isAfter(startDate, endDate)) {
      console.error("[calculateDayStats] Invalid date range provided:", startDate, endDate);
      return [];
  }

  let currentDate = startOfDay(startDate);
  const endOfDayEndDate = startOfDay(endDate);

  while (!isAfter(currentDate, endOfDayEndDate)) {
    const dateKey = format(currentDate, "yyyy-MM-dd");
    if (!stats.has(dateKey)) {
        stats.set(dateKey, { date: dateKey, count: 0, tasks: [] });
    }
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    // Safety break for potential infinite loops, though less likely now
    if (nextDay.getTime() === currentDate.getTime()) {
        console.error("[calculateDayStats] Date increment failed, breaking loop.");
        break;
    }
    currentDate = nextDay;
  }

  tasks.forEach(task => {
    if (task && task.completedDate && !isNaN(task.completedDate.getTime())) { // Add check for task itself
        const dateKey = format(startOfDay(task.completedDate), "yyyy-MM-dd");
        const dayStat = stats.get(dateKey);
        if (dayStat) {
          dayStat.count++;
          dayStat.tasks.push(task);
        } else {
             console.warn(`[calculateDayStats] Task date ${dateKey} (Task ID: ${task.id}) outside initialized range ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}.`);
        }
    } else {
        console.warn(`[calculateDayStats] Task with ID ${task?.id} has invalid/missing completedDate.`);
    }
  });

  return Array.from(stats.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// --- UPDATED calculateProjectStats with "Other" grouping ---
export function calculateProjectStats(
  tasks: ProcessedTask[],
  projects: TodoistProject[],
  thresholdPercent = 0.02, // Group projects representing less than 2% of total
  minThresholdCount = 5     // Group projects with fewer than 5 tasks
): ProjectStats[] {
  if (!Array.isArray(projects)) {
      console.error("[calculateProjectStats] Invalid projects data provided.");
      projects = [];
  }
   if (!Array.isArray(tasks)) {
      console.error("[calculateProjectStats] Invalid tasks data provided.");
      tasks = [];
  }

  const projectMap = new Map(projects.map(p => [p.id, p]));
  const stats = new Map<string, ProjectStats>();
  const noProjectId = "no-project";
  let totalTasks = 0; // Keep track of total tasks processed for percentage calculation

  // --- First Pass: Calculate counts for all projects ---
  tasks.forEach(task => {
    if(!task) {
        console.warn("[calculateProjectStats] Encountered invalid task object.");
        return;
    }
    totalTasks++; // Increment total task count

    const projectId = task.project_id;
    let projectName = `Unknown/Archived (${task.project_id})`;
    let projectColor = "#808080"; // Default grey
    let projectKey = `unknown-${task.project_id}`;

    if (!projectId) {
        projectKey = noProjectId;
        projectName = "No Project";
    } else {
        const project = projectMap.get(projectId);
        if (project) {
            projectKey = projectId;
            projectName = project.name || `Unnamed Project ${project.id}`;
            projectColor = project.color || "#808080";
        } else {
             console.warn(`[calculateProjectStats] Project ID ${projectId} not found for task ${task.id}. Grouping as Unknown.`);
        }
    }

    const existing = stats.get(projectKey);
    if (existing) {
      existing.count++;
    } else {
      stats.set(projectKey, {
        projectId: projectKey,
        projectName: projectName,
        count: 1,
        color: projectColor,
      });
    }
  });

  // --- Second Pass: Group small projects into "Other" ---
  const allProjectStats = Array.from(stats.values());
  const finalStats: ProjectStats[] = [];
  let otherCount = 0;

  // Determine the actual threshold count
  const percentageThresholdCount = Math.floor(totalTasks * thresholdPercent);
  const actualThreshold = Math.max(1, Math.min(minThresholdCount, percentageThresholdCount)); // Use the smaller of the two thresholds, but at least 1

  console.log(`[calculateProjectStats] Total tasks: ${totalTasks}, Percentage Threshold: ${percentageThresholdCount}, Min Threshold: ${minThresholdCount}, Actual Threshold for 'Other': ${actualThreshold}`);

  allProjectStats.forEach(stat => {
    // Group if count is below threshold (and it's not the "No Project" category itself unless its count is also low)
    if (stat.count < actualThreshold && stat.projectId !== noProjectId) {
      otherCount += stat.count;
    } else {
      finalStats.push(stat); // Keep projects above threshold or the "No Project" category
    }
  });

  // Add the "Other" category if it has any count
  if (otherCount > 0) {
    finalStats.push({
      projectId: "other-projects",
      projectName: "Other",
      count: otherCount,
      color: "#A0A0A0", // A neutral grey for "Other"
    });
  }

  // Sort final list by count, descending
  return finalStats.sort((a, b) => b.count - a.count);
}
// --- END UPDATED calculateProjectStats ---


export function calculateHourStats(tasks: ProcessedTask[]): HourStats[] {
   if (!Array.isArray(tasks)) {
      console.error("[calculateHourStats] Invalid tasks data provided.");
      return []; // Default to empty
  }
  const stats = new Map<number, number>();

  for (let hour = 0; hour < 24; hour++) {
    stats.set(hour, 0);
  }

  tasks.forEach(task => {
     if (task && typeof task.hour === 'number' && task.hour >= 0 && task.hour <= 23) {
         const count = stats.get(task.hour) || 0;
         stats.set(task.hour, count + 1);
     } else {
         console.warn(`[calculateHourStats] Task ${task?.id} has invalid hour: ${task?.hour}.`);
     }
  });

  return Array.from(stats.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);
}


export function calculateRecapStats(
  dayStats: DayStats[],
  projectStats: ProjectStats[]
): RecapStats {
   if (!Array.isArray(dayStats)) { dayStats = []; }
   if (!Array.isArray(projectStats)) { projectStats = []; }

  const totalDone = dayStats.reduce((sum, day) => sum + (day?.count || 0), 0);

  // Calculate streak
  let currentStreak = 0;
  if (dayStats.length > 0) {
    const dayMap = new Map(dayStats.map(d => d ? [d.date, d.count] : [null, 0]).filter(entry => entry[0])); // Filter invalid entries
    let currentDate = startOfDay(new Date());
    const earliestDateStr = dayStats.map(d => d?.date).filter(Boolean).sort((a,b) => a!.localeCompare(b!))[0];
    const earliestDate = earliestDateStr ? startOfDay(parseISO(earliestDateStr)) : null;

    while (true) {
      const dateKey = format(currentDate, "yyyy-MM-dd");
      const count = dayMap.get(dateKey);

      if (count !== undefined && count > 0) {
        currentStreak++;
      } else if (count === undefined) {
          // Stop if we check before the earliest data we have
          if(earliestDate && isBefore(currentDate, earliestDate)) {
              break;
          }
          // If within range but missing (assume 0), break streak if it was ongoing
          if (currentStreak > 0) break;
      } else { // count is 0
          // Break if a past day has 0 tasks
          if (format(currentDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd")) {
            break;
          }
           // Allow today to have 0 without breaking streak (yet)
      }

      // Move to the previous day
      const prevDay = new Date(currentDate);
      prevDay.setDate(prevDay.getDate() - 1);
       // Safety break
       if (differenceInDays(new Date(), prevDay) > 730 || prevDay.getTime() === currentDate.getTime()) {
           if(prevDay.getTime() === currentDate.getTime()) console.error("[calculateRecapStats] Date decrement failed.");
           else console.warn("[calculateRecapStats] Streak calculation checked back >2 years.");
           break;
       }
       currentDate = prevDay;
    }
  }

  // Best day
  const bestDay = dayStats.reduce(
    (best, day) => (day && day.count > best.count ? { date: day.date, count: day.count } : best),
    { date: "", count: 0 }
  );

  // Top project
  const topProjectStats = projectStats.length > 0 ? projectStats[0] : null;

  return {
    totalDone,
    currentStreak,
    bestDay: {
        date: bestDay.date || format(new Date(), 'yyyy-MM-dd'),
        count: bestDay.count
    },
    topProject: {
      name: topProjectStats?.projectName || "N/A",
      count: topProjectStats?.count || 0
    },
  };
}