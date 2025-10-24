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
import { DayStats } from "@/types/todoist";
import { generateMockTasks, generateMockProjects } from "@/lib/mockData";
import {
  processTasks,
  calculateDayStats,
  calculateProjectStats,
  calculateHourStats,
  calculateRecapStats,
} from "@/lib/todoist";
import { subDays } from "date-fns";

export default function Index() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<DayStats | null>(null);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    const token = localStorage.getItem("todoist_token");
    if (!token) {
      navigate("/auth");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("todoist_token");
    navigate("/auth");
  };

  const handleDayClick = (day: DayStats) => {
    setSelectedDay(day);
    setDrilldownOpen(true);
  };

  // Generate mock data
  const mockTasks = useMemo(() => generateMockTasks(30), []);
  const mockProjects = useMemo(() => generateMockProjects(), []);

  // Process data
  const processedTasks = useMemo(() => processTasks(mockTasks), [mockTasks]);
  const dayStats = useMemo(
    () => calculateDayStats(processedTasks, dateRange?.from || subDays(new Date(), 30), dateRange?.to || new Date()),
    [processedTasks, dateRange]
  );
  const projectStats = useMemo(
    () => calculateProjectStats(processedTasks, mockProjects),
    [processedTasks, mockProjects]
  );
  const hourStats = useMemo(() => calculateHourStats(processedTasks), [processedTasks]);
  const recapStats = useMemo(() => calculateRecapStats(dayStats, projectStats), [dayStats, projectStats]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">DoneGlow</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Filters */}
        <Filters dateRange={dateRange} onDateRangeChange={setDateRange} />

        {/* Recap Cards */}
        <RecapCards stats={recapStats} />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2">
            <CompletionHeatmap data={dayStats} onDayClick={handleDayClick} />
          </div>
          <WeeklyFocusStacks data={dayStats} projects={projectStats} />
          <ProjectShareDonut data={projectStats} />
          <div className="lg:col-span-2">
            <TimeOfDayRhythm data={hourStats} />
          </div>
        </div>
      </main>

      {/* Task Drilldown Dialog */}
      <TaskDrilldown day={selectedDay} open={drilldownOpen} onOpenChange={setDrilldownOpen} />
    </div>
  );
}
