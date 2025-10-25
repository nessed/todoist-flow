import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RecapCards } from "@/components/RecapCards";
import { CompletionHeatmap } from "@/components/CompletionHeatmap";
import { WeeklyFocusStacks } from "@/components/WeeklyFocusStacks";
import { ProjectShareDonut } from "@/components/ProjectShareDonut";
import { TimeOfDayRhythm } from "@/components/TimeOfDayRhythm";
import { Filters } from "@/components/Filters";
import { TaskDrilldown } from "@/components/TaskDrilldown";
import { Button } from "@/components/ui/button";
import { CheckCircle2, LogOut } from "lucide-react";
import { DateRange } from "react-day-picker";
import { DayStats, TodoistTask, TodoistProject } from "@/types/todoist";
import { generateMockTasks, generateMockProjects } from "@/lib/mockData";
import {
  fetchCompletedTasks,
  fetchProjects,
  processTasks,
  calculateDayStats,
  calculateProjectStats,
  calculateHourStats,
  calculateRecapStats,
} from "@/lib/todoist";
// --- *** IMPORT 'format' HERE *** ---
import { subDays, startOfDay, isAfter, isBefore, format } from "date-fns";
// --- *** END IMPORT FIX *** ---
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<DayStats | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [projects, setProjects] = useState<TodoistProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useSampleData, setUseSampleData] = useState(false);

 // --- useEffect Hook (from previous step) ---
 useEffect(() => {
    const token = localStorage.getItem("todoist_token");
    if (!token) {
      console.log("[Index.tsx] No token found, navigating to /auth");
      navigate("/auth");
      return;
    }

    // Define an async function inside useEffect to allow awaiting promises
    const fetchData = async () => {
      // Reset states at the beginning of each fetch attempt
      console.log("[Index.tsx] Starting fetchData...");
      setIsLoading(true);
      setError(null); // Explicitly clear previous errors

      // Exit early if using sample data
      if (useSampleData) {
        console.log("[Index.tsx] Using sample data.");
        try {
            // Simulate async loading slightly even for sample data
            await new Promise(resolve => setTimeout(resolve, 100));
            setTasks(generateMockTasks(90)); // Use a decent amount for testing layouts
            setProjects(generateMockProjects());
        } catch (sampleErr) {
             console.error("[Index.tsx] Error generating sample data:", sampleErr);
             setError("Failed to load sample data.");
        } finally {
             setIsLoading(false);
        }
        return;
      }

      // Fetch real data
      let fetchedTasks: TodoistTask[] = [];
      let fetchedProjects: TodoistProject[] = [];
      let fetchError: Error | null = null;

      try {
        console.log("[Index.tsx] Attempting to fetch projects and tasks in parallel...");
        // Use Promise.all again, but handle potential errors carefully
        [fetchedTasks, fetchedProjects] = await Promise.all([
          fetchCompletedTasks(token /* Removed date arg, let fetchCompletedTasks handle defaults if needed */),
          fetchProjects(token),
        ]);

        console.log(`[Index.tsx] Successfully fetched ${fetchedTasks.length} tasks and ${fetchedProjects.length} projects.`);

        // *** Crucial: Set state only after BOTH promises succeed ***
        setTasks(fetchedTasks);
        setProjects(fetchedProjects);

      } catch (err) {
        // Log the specific error
        console.error("[Index.tsx] Error during Promise.all fetchData:", err);
        fetchError = err instanceof Error ? err : new Error('Unknown error during fetch');
        // Set a user-friendly error message including the caught error
        setError(`Failed to fetch data: ${fetchError.message}. Please check your connection or API token.`);
        // Clear data states on error to prevent displaying stale data
        setTasks([]);
        setProjects([]);
      } finally {
        console.log("[Index.tsx] fetchData finished, setting isLoading to false.");
        setIsLoading(false); // Ensure loading is always turned off
      }
    };

    fetchData(); // Call the async function

    // Cleanup function (optional, runs if component unmounts or deps change)
    return () => {
        console.log("[Index.tsx] Cleanup useEffect");
        // You could add logic here to cancel ongoing fetches if needed
    };

  }, [navigate, useSampleData]); // Dependencies for useEffect
 // --- END useEffect Hook ---


  const handleLogout = () => {
    localStorage.removeItem("todoist_token");
    navigate("/auth");
  };

  const handleDayClick = (day: DayStats) => {
    setSelectedDay(day);
    setDrilldownOpen(true);
  };

  // Process data
  const processedTasks = useMemo(() => processTasks(tasks), [tasks]);

  // Filter tasks by date range
  const filteredTasks = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || isNaN(dateRange.from.getTime()) || isNaN(dateRange.to.getTime())) {
       console.warn("[Index.tsx] Invalid dateRange for filtering:", dateRange);
       return processedTasks;
    }

    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = startOfDay(dateRange.to);

    const filtered = processedTasks.filter((task) => {
      if (!task.completedDate || isNaN(task.completedDate.getTime())) {
          return false;
      }
      const taskDayStart = startOfDay(task.completedDate);
      return !isBefore(taskDayStart, rangeStart) && !isAfter(taskDayStart, rangeEnd);
    });

    if (import.meta.env.DEV) {
      console.log(
        `📊 Tasks: ${processedTasks.length} total, ${
          filtered.length
        } filtered for ${format(rangeStart, "yyyy-MM-dd")} to ${ // format is used here
          format(rangeEnd, "yyyy-MM-dd") // and here
        }`
      );
    }

    return filtered;
  }, [processedTasks, dateRange]);

  // Memoize calculated stats based on filtered tasks and projects
  const dayStats = useMemo(
    () => {
        const fromDate = dateRange?.from && !isNaN(dateRange.from.getTime()) ? dateRange.from : subDays(new Date(), 30);
        const toDate = dateRange?.to && !isNaN(dateRange.to.getTime()) ? dateRange.to : new Date();
        return calculateDayStats(filteredTasks, fromDate, toDate);
    },
    [filteredTasks, dateRange]
  );
  const projectStats = useMemo(
    () => calculateProjectStats(filteredTasks, projects),
    [filteredTasks, projects]
  );
  const hourStats = useMemo(
    () => calculateHourStats(filteredTasks),
    [filteredTasks]
  );
  const recapStats = useMemo(
    () => calculateRecapStats(dayStats, projectStats),
    [dayStats, projectStats]
  );

  // Function reference for Retry button (needed if button is outside useEffect scope)
   const triggerFetchData = () => {
       // A simple way to re-trigger useEffect is to change a dependency,
       // but since `useSampleData` is already a dependency, we can toggle it
       // or introduce another state if needed. A direct call isn't standard practice here.
       // For simplicity, let's just reload or guide user to re-login if token is suspect.
       // Or, if `useSampleData` state is not critical for other logic, use it:
       // setUseSampleData(false); // This would re-trigger useEffect if it was true
       // If it was already false, we might need a dedicated 'retry' state trigger.
       // Let's just reload for now as a simple retry mechanism:
       window.location.reload();
   };


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary-glow rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <CheckCircle2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  DoneGlow
                </h1>
                <p className="text-xs text-muted-foreground">
                  Task completion insights
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Logout"
                className="hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-10 space-y-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading data...</span>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => setUseSampleData(true)} variant="outline">
              Use Sample Data Instead
            </Button>
             <Button onClick={triggerFetchData} variant="default"> {/* Updated onClick handler */}
               Retry Fetching Data
             </Button>
          </div>
        // Check if projects are loaded but tasks are empty *after* successful fetch
        ) : !isLoading && !error && projects.length > 0 && tasks.length === 0 ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Successfully connected to Todoist and fetched projects, but no completed tasks were found in your history.
                Complete some tasks in Todoist and refresh to see your data visualized here!
              </AlertDescription>
            </Alert>
            <Button onClick={() => setUseSampleData(true)} variant="outline">
              Use Sample Data
            </Button>
          </div>
        // Check if both tasks and projects are loaded
        ) : !isLoading && !error && tasks.length > 0 && projects.length > 0 ? (
          <>
            {/* Filters */}
            <Filters dateRange={dateRange} onDateRangeChange={setDateRange} />

            {/* Recap Cards */}
            <RecapCards stats={recapStats} />

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2">
                <CompletionHeatmap
                  data={dayStats}
                  onDayClick={handleDayClick}
                />
              </div>
              {/* Conditionally render charts only if data exists */}
              {projectStats.length > 0 && <WeeklyFocusStacks data={dayStats} projects={projectStats} />}
              {projectStats.length > 0 && <ProjectShareDonut data={projectStats} />}
              <div className="lg:col-span-2">
                 {hourStats.length > 0 && <TimeOfDayRhythm data={hourStats} />}
              </div>
            </div>
          </>
        ) : (
             // Fallback for unexpected states
             <div className="space-y-4">
                <Alert>
                   <AlertDescription>
                     Loading completed or data is unavailable in the expected format. Please try again.
                   </AlertDescription>
                </Alert>
                 <Button onClick={() => setUseSampleData(true)} variant="outline">
                   Use Sample Data
                 </Button>
                  <Button onClick={triggerFetchData} variant="default">
                   Retry Fetching Data
                 </Button>
             </div>
        )}
      </main>

      {/* Task Drilldown Dialog */}
      <TaskDrilldown
        day={selectedDay}
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
      />
    </div>
  );
}