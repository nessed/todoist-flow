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
import { subDays, startOfDay, isAfter, isBefore } from "date-fns";
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

  useEffect(() => {
    const token = localStorage.getItem("todoist_token");
    if (!token) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      if (useSampleData) {
        setTasks(generateMockTasks(30));
        setProjects(generateMockProjects());
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [fetchedTasks, fetchedProjects] = await Promise.all([
          fetchCompletedTasks(token, subDays(new Date(), 90).toISOString()),
          fetchProjects(token),
        ]);
        setTasks(fetchedTasks);
        setProjects(fetchedProjects);
      } catch (err) {
        setError("Invalid Todoist token or unable to fetch data.");
        console.error("Error fetching Todoist data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [navigate, useSampleData]);

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
    if (!dateRange?.from || !dateRange?.to) return processedTasks;
    const filtered = processedTasks.filter((task) => {
      const taskDate = startOfDay(task.completedDate);
      return (
        (isAfter(taskDate, dateRange.from!) ||
          taskDate.getTime() === dateRange.from!.getTime()) &&
        (isBefore(taskDate, dateRange.to!) ||
          taskDate.getTime() === dateRange.to!.getTime())
      );
    });

    // Debug logging for development
    if (import.meta.env.DEV) {
      console.log(
        `📊 Tasks: ${processedTasks.length} total, ${
          filtered.length
        } filtered for ${dateRange?.from?.toISOString().split("T")[0]} to ${
          dateRange?.to?.toISOString().split("T")[0]
        }`
      );
    }

    return filtered;
  }, [processedTasks, dateRange]);

  const dayStats = useMemo(
    () =>
      calculateDayStats(
        filteredTasks,
        dateRange?.from || subDays(new Date(), 30),
        dateRange?.to || new Date()
      ),
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
          </div>
        ) : error ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => setUseSampleData(true)} variant="outline">
              Use Sample Data
            </Button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                No completed tasks found. Complete some tasks in Todoist to see
                your data visualized here!
              </AlertDescription>
            </Alert>
            <Button onClick={() => setUseSampleData(true)} variant="outline">
              Use Sample Data
            </Button>
          </div>
        ) : (
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
              <WeeklyFocusStacks data={dayStats} projects={projectStats} />
              <ProjectShareDonut data={projectStats} />
              <div className="lg:col-span-2">
                <TimeOfDayRhythm data={hourStats} />
              </div>
            </div>
          </>
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
