import { TodoistTask, TodoistProject, ProcessedTask, DayStats, ProjectStats, HourStats, RecapStats } from "@/types/todoist";
import { format, parseISO, startOfDay, differenceInDays, isAfter, isBefore } from "date-fns";

const TODOIST_API_BASE = "https://api.todoist.com/rest/v2";
const TODOIST_SYNC_API = "https://api.todoist.com/sync/v9";

// --- Helper function MUST be defined BEFORE it's used ---
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    // Check for rate limit error (429)
    if (response.status === 429 && retries > 0) {
      const retryAfter = response.headers.get('Retry-After');
      // Use Retry-After header if available, otherwise use default delay
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
      console.warn(`[fetchWithRetry] Rate limited. Retrying after ${waitTime / 1000} seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // You could implement exponential backoff here (e.g., delay * 2)
      return fetchWithRetry(url, options, retries - 1, delay);
    }
     // Optional: Add basic retry for generic server errors (5xx)
     if (!response.ok && response.status >= 500 && retries > 0) {
       console.warn(`[fetchWithRetry] Server error (${response.status}). Retrying after ${delay / 1000} seconds... (${retries} retries left)`);
       await new Promise(resolve => setTimeout(resolve, delay));
       return fetchWithRetry(url, options, retries - 1, delay * 2); // Exponential backoff
     }
    return response; // Return response even if !ok for non-retryable errors (like 401, 403, 404)
  } catch (error) {
     // Handle network errors
    if (retries > 0) {
      console.warn(`[fetchWithRetry] Network error during fetch. Retrying after ${delay / 1000} seconds... (${retries} retries left)`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2); // Exponential backoff
    }
    console.error("[fetchWithRetry] Fetch failed after multiple retries.", error);
    throw error; // Re-throw the error after exhausting retries
  }
}
// --- End Helper function ---


export async function validateToken(token: string): Promise<boolean> {
  try {
    // Now uses the defined fetchWithRetry
    const response = await fetchWithRetry(`${TODOIST_API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Check specifically for 401 Unauthorized or 403 Forbidden
    if (response.status === 401 || response.status === 403) {
        console.error(`[validateToken] Authentication failed with status: ${response.status}`);
        return false;
    }
    // Consider any other non-OK status as potentially invalid for this simple check
    if (!response.ok) {
        console.warn(`[validateToken] Received non-OK status during validation: ${response.status}`);
        // Depending on strictness, you might return false here or rely on subsequent fetches to fail more clearly.
        // Let's assume !ok means potential issue for validation.
        return false;
    }
    return true; // Only return true if response.ok
  } catch (error){
    // Network errors or exhausted retries land here
    console.error("[validateToken] Token validation failed due to network error or repeated failures:", error);
    return false;
  }
}

// --- fetchCompletedTasks function (uses fetchWithRetry) ---
// --- UPDATED fetchCompletedTasks function with RAW ITEM LOGGING ---
// --- fetchCompletedTasks using /completed/get_all with CURSOR PAGINATION ---
export async function fetchCompletedTasks(token: string, since?: string /* `since` is often ignored by get_all */): Promise<TodoistTask[]> {
  const allItems: TodoistTask[] = [];
  const headers = { Authorization: `Bearer ${token}` };
  let cursor: string | null = null;
  let pageCount = 0;
  const limit = 200; // Max items per page for this endpoint

  console.log(`[fetchCompletedTasks] Starting fetch using /completed/get_all with limit ${limit}...`);

  do {
    pageCount++;
    const params = new URLSearchParams({
      limit: limit.toString(),
    });
    if (cursor) {
      params.append('cursor', cursor);
    }
    // Optional: Add `since` or `until` if needed, check API docs for exact behavior with get_all
    // if (since) params.append('since', since);

    const url = `${TODOIST_SYNC_API}/completed/get_all?${params.toString()}`;

    console.log(`[fetchCompletedTasks] Fetching page ${pageCount}${cursor ? ` (cursor: ${cursor.substring(0, 10)}...)` : ''}...`);

    const response = await fetchWithRetry(url, { headers });

    if (response.status === 401 || response.status === 403) {
      console.error(`[fetchCompletedTasks] Authentication error (${response.status}). Please check API token.`);
      throw new Error(`Authentication failed (${response.status}). Is your Todoist token valid?`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[fetchCompletedTasks] /completed/get_all request failed! Status: ${response.status}`, errorText);
      throw new Error(`Failed to fetch completed tasks: ${response.statusText} (${response.status}) - ${errorText}`);
    }

    const data = await response.json();

    if (data.items && Array.isArray(data.items)) {
       console.log(`[fetchCompletedTasks] Page ${pageCount} received ${data.items.length} raw completed items.`);

       // Log the first item structure ONCE to verify format
       if (data.items.length > 0 && pageCount === 1) {
          console.log("[fetchCompletedTasks] Structure of the FIRST raw item from /completed/get_all:", JSON.stringify(data.items[0], null, 2));
       }

      // These items should already be completed, just map them
      const completedItems = data.items.map((item: any) => ({
        id: item.id?.toString() || item.task_id?.toString() || `unknown-${Math.random()}`, // task_id is common here
        content: item.content || "",
        completed_at: item.completed_at, // This is the key field from this endpoint
        project_id: item.project_id ? item.project_id.toString() : "",
        labels: item.labels || [], // Might not be present, default to empty
      }));

      allItems.push(...completedItems);
       console.log(`[fetchCompletedTasks] Page ${pageCount} added ${completedItems.length} items. Total fetched so far: ${allItems.length}`);
    } else {
       console.log(`[fetchCompletedTasks] Page ${pageCount} - No 'items' array found in response.`);
    }

    // Check for the next cursor
    cursor = data.next_cursor || null;
    if (cursor) {
       console.log(`[fetchCompletedTasks] Received next_cursor: ${cursor.substring(0, 10)}... Continuing fetch.`);
       // Optional delay
       // await new Promise(resolve => setTimeout(resolve, 100));
    } else {
       console.log("[fetchCompletedTasks] No next_cursor received. Fetch complete.");
    }

  } while (cursor); // Continue looping as long as there's a next_cursor

  console.log(`[fetchCompletedTasks] Finished fetching all completed tasks via /completed/get_all. Total found: ${allItems.length}`);
  return allItems;
}
// --- END fetchCompletedTasks ---

// *** Keep the rest of your src/lib/todoist.ts file the same ***
// --- END UPDATED fetchCompletedTasks function ---

// *** Keep the rest of your src/lib/todoist.ts file the same ***
// (fetchWithRetry, validateToken, fetchProjects, processTasks, calculateDayStats, etc.)
// --- END fetchCompletedTasks function ---


export async function fetchProjects(token: string): Promise<TodoistProject[]> {
  const url = `${TODOIST_API_BASE}/projects`;
  const headers = { Authorization: `Bearer ${token}` };

  // Use the fetchWithRetry helper
  const response = await fetchWithRetry(url, { headers });

   // Handle non-retryable errors like Unauthorized
    if (response.status === 401 || response.status === 403) {
        console.error(`[fetchProjects] Authentication error (${response.status}). Please check API token.`);
        throw new Error(`Authentication failed (${response.status}). Is your Todoist token valid?`);
    }

  if (!response.ok) {
     const errorText = await response.text();
     console.error(`[fetchProjects] Fetch projects failed! Status: ${response.status}`, errorText);
    throw new Error(`Failed to fetch projects: ${response.statusText} (${response.status}) - ${errorText}`);
  }

  const projectsData = await response.json();
  return projectsData.map((p: any) => ({
      id: p.id.toString(),
      name: p.name || `Project ${p.id}`,
      color: p.color || "#808080",
  }));
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

    let projectId = task.project_id;
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