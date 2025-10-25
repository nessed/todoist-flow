import { TodoistTask, TodoistProject, ProcessedTask, DayStats, ProjectStats, HourStats, RecapStats } from "@/types/todoist";
import { format, parseISO, startOfDay, differenceInDays, isAfter, isBefore } from "date-fns";

const TODOIST_API_BASE = "https://api.todoist.com/rest/v2";
const TODOIST_SYNC_API = "https://api.todoist.com/sync/v9";

// Helper function to handle fetch requests with basic rate limit retries
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    // Check for rate limit error (429)
    if (response.status === 429 && retries > 0) {
      const retryAfter = response.headers.get('Retry-After');
      // Use Retry-After header if available, otherwise use default delay
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
      console.warn(`Rate limited. Retrying after ${waitTime / 1000} seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // You could implement exponential backoff here (e.g., delay * 2)
      return fetchWithRetry(url, options, retries - 1, delay);
    }
    // For other errors, you might want more specific handling
    // if (!response.ok && retries > 0) {
    //   console.warn(`Fetch failed with status ${response.status}. Retrying...`);
    //    await new Promise(resolve => setTimeout(resolve, delay));
    //    return fetchWithRetry(url, options, retries - 1, delay * 2); // Exponential backoff
    // }
    return response;
  } catch (error) {
     // Handle network errors
    if (retries > 0) {
      console.warn(`Network error during fetch. Retrying after ${delay / 1000} seconds... (${retries} retries left)`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2); // Exponential backoff
    }
    console.error("Fetch failed after multiple retries.", error);
    throw error; // Re-throw the error after exhausting retries
  }
}


export async function validateToken(token: string): Promise<boolean> {
  try {
    // Using fetchProjects which now includes retry logic
    const response = await fetchWithRetry(`${TODOIST_API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch (error){
    console.error("Token validation failed:", error);
    return false;
  }
}

// --- CORRECTED fetchCompletedTasks function ---
export async function fetchCompletedTasks(token: string, since?: string): Promise<TodoistTask[]> {
  const allItems: TodoistTask[] = [];
  let syncToken: string | null = "*"; // Start with a full sync

  const headers = { Authorization: `Bearer ${token}` };

  console.log("Starting fetchCompletedTasks using Sync API v9...");

  while (syncToken) {
    // Construct the URL and parameters for the Sync API
    const params = new URLSearchParams({
      sync_token: syncToken,
      // Specify only 'items' resource type to fetch tasks/items
      resource_types: '["items"]',
    });
    const url = `${TODOIST_SYNC_API}/sync?${params.toString()}`;

    console.log(`Fetching page with sync_token: ${syncToken === "*" ? "initial (*)" : syncToken.substring(0, 10)}...`);

    // Use the fetchWithRetry helper
    const response = await fetchWithRetry(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Sync API request failed with status ${response.status}: ${errorText}`);
      // Throw a more informative error
      throw new Error(`Failed to fetch tasks via Sync API: ${response.statusText} (${response.status}) - ${errorText}`);
    }

    const data = await response.json();

    // The Sync API returns 'items' which are all tasks (active and completed)
    // We need to filter for completed ones (checked: 1)
    if (data.items) {
       const completedItems = data.items
        .filter((item: any) => item.checked === 1 && item.completed_at) // Filter for completed items with a completion date
        .map((item: any) => ({
            id: item.id.toString(), // Ensure ID is string
            content: item.content || "", // Ensure content exists
            completed_at: item.completed_at, // This should exist based on filter
            project_id: item.project_id ? item.project_id.toString() : "", // Ensure project_id is string, handle null/undefined
            labels: item.labels || [], // Ensure labels is an array
        }));

        allItems.push(...completedItems);
        console.log(`Fetched ${completedItems.length} completed items in this batch. Total fetched so far: ${allItems.length}`);
    } else {
        console.log("No 'items' array found in this sync response batch.");
    }

    // Determine the next sync_token to continue pagination
    // Stop if it's a full_sync response (meaning everything was sent) or if no sync_token is provided
    if (data.full_sync || !data.sync_token) {
       console.log("Full sync indicated or no further sync_token provided. Sync process complete.");
       syncToken = null; // Exit the loop
    } else {
       syncToken = data.sync_token;
       // Optional: Log only part of the token for brevity/security
       console.log(`Received next sync_token: ${syncToken.substring(0, 10)}... Continuing fetch.`);
    }

     // Optional: Add a small delay between requests if needed, especially if hitting rate limits often
     // await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
  }

  console.log(`Finished fetching all completed tasks using Sync API. Total found: ${allItems.length}`);

  // Note: The Sync API fetches *all* items (tasks) matching the sync criteria,
  // including active ones if not careful. The filtering for `checked: 1` ensures we only process completed items.
  // The `/completed/get_all` endpoint used previously is deprecated or unofficial for this purpose.
  return allItems;
}
// --- END CORRECTED fetchCompletedTasks function ---


export async function fetchProjects(token: string): Promise<TodoistProject[]> {
  const url = `${TODOIST_API_BASE}/projects`;
  const headers = { Authorization: `Bearer ${token}` };

  const response = await fetchWithRetry(url, { headers });

  if (!response.ok) {
     const errorText = await response.text();
     console.error(`Fetch projects failed with status ${response.status}: ${errorText}`);
    throw new Error(`Failed to fetch projects: ${response.statusText} (${response.status}) - ${errorText}`);
  }

  const projectsData = await response.json();
  // Map response data to ensure it matches the TodoistProject type
  return projectsData.map((p: any) => ({
      id: p.id.toString(), // Ensure ID is string
      name: p.name || `Project ${p.id}`, // Provide fallback name
      color: p.color || "#808080", // Provide fallback color
  }));
}


// --- Data Processing Functions (Added defensive checks) ---

export function processTasks(tasks: TodoistTask[]): ProcessedTask[] {
  return tasks
     .filter(task => task.completed_at) // Make sure completed_at exists
     .map(task => {
        try {
           const completedDate = parseISO(task.completed_at);
           // Check if parsing resulted in a valid date
            if (isNaN(completedDate.getTime())) {
                throw new Error('Invalid date parsed');
            }
            return {
                ...task,
                completedDate: completedDate,
                hour: completedDate.getHours(),
            };
        } catch (e) {
            console.error(`Error parsing date for task ID ${task.id}: '${task.completed_at}'`, e);
            return null; // Mark tasks with invalid dates as null
        }
    })
    .filter((task): task is ProcessedTask => task !== null); // Filter out the nulls
}


export function calculateDayStats(
  tasks: ProcessedTask[],
  startDate: Date,
  endDate: Date
): DayStats[] {
  const stats = new Map<string, DayStats>();

  // Input validation
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isAfter(startDate, endDate)) {
      console.error("Invalid date range provided to calculateDayStats:", startDate, endDate);
      return [];
  }

  // Initialize all days in the range
  let currentDate = startOfDay(startDate);
  const endOfDayEndDate = startOfDay(endDate); // Use startOfDay for comparison consistency

  // Loop correctly includes the end date
  while (!isAfter(currentDate, endOfDayEndDate)) {
    const dateKey = format(currentDate, "yyyy-MM-dd");
    if (!stats.has(dateKey)) { // Avoid overwriting if map already has the key (though unlikely here)
        stats.set(dateKey, { date: dateKey, count: 0, tasks: [] });
    }
    // Increment day safely
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    currentDate = nextDay;
  }

  // Add tasks to their respective days
  tasks.forEach(task => {
    // Check if completedDate is a valid Date object
    if (task.completedDate && !isNaN(task.completedDate.getTime())) {
        const dateKey = format(startOfDay(task.completedDate), "yyyy-MM-dd");
        const dayStat = stats.get(dateKey);
        if (dayStat) {
          dayStat.count++;
          dayStat.tasks.push(task);
        } else {
             // Log if a task's date falls outside the initialized range (could indicate timezone issues or filtering problems upstream)
             console.warn(`Task date ${dateKey} (Task ID: ${task.id}) is outside the expected range ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}.`);
             // Optionally, add it anyway if needed:
             // stats.set(dateKey, { date: dateKey, count: 1, tasks: [task] });
        }
    } else {
        console.warn(`Task with ID ${task.id} has an invalid or missing completedDate.`);
    }
  });

  return Array.from(stats.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateProjectStats(
  tasks: ProcessedTask[],
  projects: TodoistProject[]
): ProjectStats[] {
  // Ensure projects array is valid
  if (!Array.isArray(projects)) {
      console.error("Invalid projects data provided to calculateProjectStats");
      return [];
  }
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const stats = new Map<string, ProjectStats>();

  tasks.forEach(task => {
    // Check if project_id exists and is valid
    if (!task.project_id) {
        // Handle tasks without a project ID - group them under 'No Project' or similar
        const noProjectId = "no-project";
        const existing = stats.get(noProjectId);
        if (existing) {
            existing.count++;
        } else {
            stats.set(noProjectId, {
                projectId: noProjectId,
                projectName: "No Project",
                count: 1,
                color: "#808080", // Default grey color
            });
        }
        return; // Skip looking up in projectMap
    }

    const project = projectMap.get(task.project_id);
    if (!project) {
        // Handle tasks belonging to projects not in the provided list (e.g., deleted projects)
        const unknownProjectId = `unknown-${task.project_id}`;
         const existing = stats.get(unknownProjectId);
        if (existing) {
            existing.count++;
        } else {
             stats.set(unknownProjectId, {
                projectId: unknownProjectId,
                projectName: `Unknown/Archived (${task.project_id})`,
                count: 1,
                color: "#808080",
            });
        }
        console.warn(`Project ID ${task.project_id} not found in fetched projects list for task ${task.id}.`);
        return; // Skip normal processing
    }

    const existing = stats.get(task.project_id);
    if (existing) {
      existing.count++;
    } else {
      stats.set(task.project_id, {
        projectId: task.project_id,
        projectName: project.name || `Unnamed Project ${project.id}`, // Fallback name
        count: 1,
        color: project.color || "#808080", // Fallback color
      });
    }
  });

  return Array.from(stats.values()).sort((a, b) => b.count - a.count);
}

export function calculateHourStats(tasks: ProcessedTask[]): HourStats[] {
  const stats = new Map<number, number>();

  // Initialize hours 0-23
  for (let hour = 0; hour < 24; hour++) {
    stats.set(hour, 0);
  }

  tasks.forEach(task => {
     // Validate hour is a number between 0 and 23
     if (typeof task.hour === 'number' && task.hour >= 0 && task.hour <= 23) {
         const count = stats.get(task.hour) || 0; // Default to 0 if somehow missing
         stats.set(task.hour, count + 1);
     } else {
         console.warn(`Task ${task.id} has invalid hour: ${task.hour}. Ignoring for hourly stats.`);
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
   // Ensure dayStats is an array
   if (!Array.isArray(dayStats)) {
        console.error("Invalid dayStats provided to calculateRecapStats");
        dayStats = []; // Default to empty array to prevent errors
    }
   // Ensure projectStats is an array
    if (!Array.isArray(projectStats)) {
        console.error("Invalid projectStats provided to calculateRecapStats");
        projectStats = []; // Default to empty array
    }


  const totalDone = dayStats.reduce((sum, day) => sum + (day.count || 0), 0); // Ensure count is treated as 0 if missing

  // Calculate streak robustly
  let currentStreak = 0;
  if (dayStats.length > 0) {
    // Create a Map for quick date lookups
    const dayMap = new Map(dayStats.map(d => [d.date, d.count]));
    let currentDate = startOfDay(new Date()); // Today

    while (true) {
      const dateKey = format(currentDate, "yyyy-MM-dd");
      const count = dayMap.get(dateKey);

      if (count !== undefined && count > 0) {
        currentStreak++;
      } else if (count === undefined) {
          // If the date isn't in our map, assume 0 tasks for streak purposes.
          // Check if this date is *before* the earliest date in dayStats. If so, stop.
          const earliestDateStr = dayStats.length > 0 ? dayStats[0].date : null; // Assumes dayStats is sorted ascending
          if (earliestDateStr && isBefore(currentDate, startOfDay(parseISO(earliestDateStr)))) {
              break; // Stop if we've gone past the range of our data
          }
          // If within the range but count is undefined (or 0), streak breaks here.
          if (currentStreak > 0) break; // Break if streak was ongoing
          // If streak is 0 and count is undefined/0, just continue checking previous day
      } else { // count is 0
          // If it's today and count is 0, the streak is potentially still valid from yesterday.
          // If it's a past day and count is 0, the streak ends *before* this day.
          if (format(currentDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd")) {
            break; // Streak broken if a past day has 0 tasks
          }
           // If it IS today and count is 0, continue checking yesterday
      }

      // Move to the previous day
      currentDate.setDate(currentDate.getDate() - 1);

       // Safety break: Limit how far back we check (e.g., 2 years) to prevent infinite loops with bad data
       if (differenceInDays(new Date(), currentDate) > 730) {
           console.warn("Streak calculation checked back over 2 years, stopping.");
           break;
       }
    }
  }


  // Best day: Find day with max count
  const bestDay = dayStats.reduce(
    (best, day) => (day.count > best.count ? { date: day.date, count: day.count } : best),
    { date: "", count: 0 } // Initial best
  );

  // Top project: Already sorted, take the first one if available
  const topProjectStats = projectStats.length > 0 ? projectStats[0] : null;

  return {
    totalDone,
    currentStreak,
    bestDay: {
        date: bestDay.date || format(new Date(), 'yyyy-MM-dd'), // Fallback date if no tasks
        count: bestDay.count
    },
    topProject: {
      name: topProjectStats?.projectName || "N/A", // Fallback name
      count: topProjectStats?.count || 0 // Fallback count
    },
  };
}