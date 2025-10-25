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
import { CheckCircle2, LogOut, Loader2 } from "lucide-react";
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
import { subDays, startOfDay, isAfter, isBefore, format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator"; // Import Separator

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
  const [refreshTick, setRefreshTick] = useState(0); // trigger refetch without full reload

  useEffect(() => {
    const token = localStorage.getItem("todoist_token");
    if (!token && !useSampleData) { // Adjusted condition
      console.log("[Index.tsx] No token found, navigating to /auth");
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      console.log("[Index.tsx] Starting fetchData...");
      setIsLoading(true);
      setError(null);

      if (useSampleData) {
        console.log("[Index.tsx] Using sample data.");
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            setTasks(generateMockTasks(90));
            setProjects(generateMockProjects());
        } catch (sampleErr) {
             console.error("[Index.tsx] Error generating sample data:", sampleErr);
             setError("Failed to load sample data.");
        } finally {
             setIsLoading(false);
        }
        return;
      }

      // Fetch real data only if token exists
      if (token) {
          let fetchedTasks: TodoistTask[] = [];
          let fetchedProjects: TodoistProject[] = [];
          let fetchError: Error | null = null;

          try {
            console.log("[Index.tsx] Attempting to fetch projects and tasks in parallel...");
            // Pass `since` to cut payloads when we have a date range
            const since = dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined;
            [fetchedTasks, fetchedProjects] = await Promise.all([
              fetchCompletedTasks(token, since),
              fetchProjects(token),
            ]);
            console.log(`[Index.tsx] Successfully fetched ${fetchedTasks.length} tasks and ${fetchedProjects.length} projects.`);
            setTasks(fetchedTasks);
            setProjects(fetchedProjects);
          } catch (err) {
            console.error("[Index.tsx] Error during Promise.all fetchData:", err);
            fetchError = err instanceof Error ? err : new Error('Unknown error during fetch');
            setError(`Failed to fetch data: ${fetchError.message}. Please check your connection or API token.`);
            setTasks([]);
            setProjects([]);
             // If fetch fails due to auth, clear token and redirect
             if ((err as any)?.message?.includes('Authentication failed')) {
                localStorage.removeItem("todoist_token");
                navigate("/auth");
             }
          } finally {
            console.log("[Index.tsx] fetchData finished, setting isLoading to false.");
            setIsLoading(false);
          }
      } else {
          // Should not happen due to initial check, but good failsafe
          setIsLoading(false);
          setError("No API token found.");
          navigate("/auth");
      }
    };

    fetchData();

    return () => {
        console.log("[Index.tsx] Cleanup useEffect");
    };

  }, [navigate, useSampleData, refreshTick]); // trigger re-fetch via refreshTick

  const handleLogout = () => {
    localStorage.removeItem("todoist_token");
    setTasks([]); // Clear data on logout
    setProjects([]);
    navigate("/auth");
  };

  const handleDayClick = (day: DayStats) => {
    setSelectedDay(day);
    setDrilldownOpen(true);
  };

  const processedTasks = useMemo(() => processTasks(tasks), [tasks]);

  const filteredTasks = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to || isNaN(dateRange.from.getTime()) || isNaN(dateRange.to.getTime())) {
       return processedTasks;
    }
    const rangeStart = startOfDay(dateRange.from);
    const rangeEnd = startOfDay(dateRange.to);
    return processedTasks.filter((task) => {
      if (!task.completedDate || isNaN(task.completedDate.getTime())) return false;
      const taskDayStart = startOfDay(task.completedDate);
      return !isBefore(taskDayStart, rangeStart) && !isAfter(taskDayStart, rangeEnd);
    });
  }, [processedTasks, dateRange]);

  const dayStats = useMemo(
    () => {
        const fromDate = dateRange?.from && !isNaN(dateRange.from.getTime()) ? dateRange.from : subDays(new Date(), 30);
        const toDate = dateRange?.to && !isNaN(dateRange.to.getTime()) ? dateRange.to : new Date();
        // Ensure data exists before calculating, provide empty array otherwise
        return filteredTasks.length > 0 ? calculateDayStats(filteredTasks, fromDate, toDate) : [];
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

   const triggerFetchData = () => {
       setUseSampleData(false);
       setRefreshTick((n) => n + 1);
   };

  // --- Helper to render main content ---
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="ml-3 text-lg">Loading your achievements...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="space-y-6 max-w-xl mx-auto text-center py-10" aria-live="polite">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-4 justify-center">
            <Button onClick={triggerFetchData} variant="default">
              Retry Fetching Data
            </Button>
            <Button onClick={() => setUseSampleData(true)} variant="outline">
              Use Sample Data Instead
            </Button>
          </div>
        </div>
      );
    }

    // Check if projects are loaded but tasks are empty *after* successful fetch
    if (!useSampleData && projects.length > 0 && tasks.length === 0) {
      return (
        <div className="space-y-6 max-w-xl mx-auto text-center py-10">
          <Alert>
            <AlertDescription>
              Successfully connected to Todoist, but no completed tasks were found in your history. Complete some tasks and refresh!
            </AlertDescription>
          </Alert>
          <Button onClick={() => setUseSampleData(true)} variant="outline">
            View Sample Data
          </Button>
        </div>
      );
    }

    // Check if there's data to display (either real or sample)
    if (tasks.length > 0 && projects.length > 0) {
      return (
        <>
          {/* Filters - Moved inside conditional rendering */}
          <section aria-labelledby="filters-heading" className="mb-8">
             <h2 id="filters-heading" className="sr-only">Date Range Filters</h2>
             <Filters dateRange={dateRange} onDateRangeChange={setDateRange} />
          </section>

          {/* Recap Section */}
          <section aria-labelledby="recap-heading" className="mb-10">
            <h2 id="recap-heading" className="sr-only">Summary Statistics</h2>
            <RecapCards stats={recapStats} />
          </section>

          <Separator className="my-10" />

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Heatmap (Spans 2 cols on md+) */}
            <section aria-labelledby="heatmap-heading" className="md:col-span-2">
              <h2 id="heatmap-heading" className="sr-only">Completion Heatmap</h2>
              <CompletionHeatmap
                data={dayStats}
                onDayClick={handleDayClick}
              />
            </section>

            {/* Weekly Focus */}
            {dayStats.length > 0 && projectStats.length > 0 && (
                <section aria-labelledby="weekly-focus-heading">
                  <h2 id="weekly-focus-heading" className="sr-only">Weekly Focus</h2>
                  <WeeklyFocusStacks data={dayStats} projects={projectStats} />
                </section>
            )}

            {/* Project Share */}
            {projectStats.length > 0 && (
                 <section aria-labelledby="project-share-heading">
                  <h2 id="project-share-heading" className="sr-only">Project Share</h2>
                  <ProjectShareDonut data={projectStats} />
                </section>
            )}

            {/* Time of Day (Spans 2 cols on md+) */}
             {hourStats.length > 0 && (
                <section aria-labelledby="time-rhythm-heading" className="md:col-span-2">
                  <h2 id="time-rhythm-heading" className="sr-only">Time of Day Rhythm</h2>
                  <TimeOfDayRhythm data={hourStats} />
                </section>
             )}
          </div>
        </>
      );
    }

     // Fallback for unexpected states (e.g., loading finished but no data set somehow)
     return (
         <div className="space-y-6 max-w-xl mx-auto text-center py-10">
            <Alert>
               <AlertDescription>
                 Loading completed or data is unavailable in the expected format. Please try again.
               </AlertDescription>
            </Alert>
             <div className="flex gap-4 justify-center">
                 <Button onClick={triggerFetchData} variant="default">
                   Retry Fetching Data
                 </Button>
                 <Button onClick={() => setUseSampleData(true)} variant="outline">
                   Use Sample Data
                 </Button>
             </div>
         </div>
     );
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-4"> {/* Adjusted padding */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
                <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight"> {/* Adjusted size */}
                  DoneGlow
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block"> {/* Hide on small screens */}
                  Todoist completion insights
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {(!useSampleData && localStorage.getItem("todoist_token")) && ( // Show logout only if logged in
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  aria-label="Logout"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8"> {/* Adjusted padding */}
        {renderContent()}
      </main>

      {/* Task Drilldown Dialog */}
      <TaskDrilldown
        day={selectedDay}
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
      />

      {/* Footer (Optional) */}
       <footer className="container mx-auto px-4 py-6 mt-12 border-t text-center text-xs text-muted-foreground">
          DoneGlow - Visualizing your Todoist progress.
          {useSampleData && <span className="ml-2 px-2 py-0.5 bg-muted rounded"> (Sample Data)</span>}
       </footer>
    </div>
  );
}
