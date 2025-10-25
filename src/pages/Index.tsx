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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Download,
  Loader2,
  LogOut,
  RefreshCw,
  Share2,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { DateRange } from "react-day-picker";
import {
  DayStats,
  TodoistTask,
  TodoistProject,
  TodoistUserProfile,
  TodoistActiveTask,
} from "@/types/todoist";
import { generateMockTasks, generateMockProjects } from "@/lib/mockData";
import {
  fetchCompletedTasks,
  fetchProjects,
  processTasks,
  calculateDayStats,
  calculateProjectStats,
  calculateHourStats,
  calculateRecapStats,
  fetchUserProfile,
  fetchUpcomingTasks,
} from "@/lib/todoist";
import {
  subDays,
  startOfDay,
  isAfter,
  isBefore,
  format,
  setHours,
  parseISO,
  differenceInCalendarDays,
  addDays,
} from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ACTION_PLAN_LIMIT = 4;

const resolveDueDate = (task: TodoistActiveTask) => {
  if (!task.due) {
    return null;
  }

  const raw = task.due.datetime ?? task.due.date;
  if (!raw) {
    return null;
  }

  const parsed = parseISO(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
};

type ActionPlanItem = {
  id: string;
  content: string;
  projectName: string;
  dueLabel: string;
  priorityLabel: string;
  priorityTone: string;
  url?: string;
};

type ActionPlanBuckets = Record<"overdue" | "today" | "upcoming" | "unscheduled", ActionPlanItem[]>;

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
  const [userProfile, setUserProfile] = useState<TodoistUserProfile | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<TodoistActiveTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useSampleData, setUseSampleData] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // trigger refetch without full reload

  useEffect(() => {
    const token = localStorage.getItem("todoist_token");
    if (!token && !useSampleData) { // Adjusted condition
      console.log("[Index.tsx] No token found, navigating to /auth");
      setUserProfile(null);
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
            setUserProfile({
              id: "sample",
              full_name: "DoneGlow Explorer",
              email: "explorer@doneglow.app",
              avatar_url: null,
              image_id: null,
              timezone:
                typeof Intl !== "undefined"
                  ? Intl.DateTimeFormat().resolvedOptions().timeZone
                  : null,
            });
            setTasks(generateMockTasks(90));
            setProjects(generateMockProjects());
            const today = new Date();
            setUpcomingTasks([
              {
                id: "sample-upcoming-1",
                content: "Nudge quarterly strategy memo",
                project_id: "proj1",
                labels: ["strategy"],
                priority: 4,
                due: {
                  date: format(addDays(today, -1), "yyyy-MM-dd"),
                  datetime: null,
                  timezone: null,
                },
                url: "#",
                section_id: null,
              },
              {
                id: "sample-upcoming-2",
                content: "Ship DoneGlow release notes",
                project_id: "proj1",
                labels: ["ship"],
                priority: 3,
                due: {
                  date: format(today, "yyyy-MM-dd"),
                  datetime: null,
                  timezone: null,
                },
                url: "#",
                section_id: null,
              },
              {
                id: "sample-upcoming-3",
                content: "Plan weekend hike",
                project_id: "proj4",
                labels: ["health"],
                priority: 2,
                due: {
                  date: format(addDays(today, 2), "yyyy-MM-dd"),
                  datetime: null,
                  timezone: null,
                },
                url: "#",
                section_id: null,
              },
              {
                id: "sample-upcoming-4",
                content: "Clear reading backlog",
                project_id: "proj3",
                labels: ["learning"],
                priority: 1,
                due: null,
                url: "#",
                section_id: null,
              },
            ]);
        } catch (sampleErr) {
             console.error("[Index.tsx] Error generating sample data:", sampleErr);
             setError("Failed to load sample data.");
             setUserProfile(null);
             setUpcomingTasks([]);
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
          let fetchedUser: TodoistUserProfile | null = null;

          try {
            console.log("[Index.tsx] Attempting to fetch projects and tasks in parallel...");
            // Pass `since` to cut payloads when we have a date range
            const since = dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined;
            const upcomingPromise = fetchUpcomingTasks(token).catch((err) => {
              console.warn("[Index.tsx] Unable to fetch upcoming tasks.", err);
              return [] as TodoistActiveTask[];
            });
            const [tasksData, projectsData, upcomingData] = await Promise.all([
              fetchCompletedTasks(token, since),
              fetchProjects(token),
              upcomingPromise,
            ]);
            fetchedTasks = tasksData;
            fetchedProjects = projectsData;
            setUpcomingTasks(upcomingData);
            try {
              fetchedUser = await fetchUserProfile(token);
            } catch (profileErr) {
              console.warn("[Index.tsx] Unable to fetch Todoist user profile.", profileErr);
            }
            console.log(`[Index.tsx] Successfully fetched ${fetchedTasks.length} tasks and ${fetchedProjects.length} projects.`);
            setTasks(fetchedTasks);
            setProjects(fetchedProjects);
            setUserProfile(fetchedUser);
            if (!upcomingData || upcomingData.length === 0) {
              console.info("[Index.tsx] No upcoming tasks returned or feature unavailable.");
            }
          } catch (err) {
            console.error("[Index.tsx] Error during Promise.all fetchData:", err);
            fetchError = err instanceof Error ? err : new Error('Unknown error during fetch');
            setError(`Failed to fetch data: ${fetchError.message}. Please check your connection or API token.`);
            setTasks([]);
            setProjects([]);
            setUserProfile(null);
            setUpcomingTasks([]);
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
    setUserProfile(null);
    setUpcomingTasks([]);
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

  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);

  const projectLookup = useMemo(() => {
    const map = new Map<string, TodoistProject>();
    projects.forEach((project) => {
      map.set(project.id, project);
    });
    return map;
  }, [projects]);

  const actionPlan = useMemo(() => {
    const buckets: ActionPlanBuckets = {
      overdue: [],
      today: [],
      upcoming: [],
      unscheduled: [],
    };

    if (!upcomingTasks.length) {
      return buckets;
    }

    const todayStart = startOfDay(new Date());

    const toPriority = (value: number) => {
      switch (value) {
        case 4:
          return {
            label: "Urgent",
            tone: "border-destructive/40 text-destructive",
          };
        case 3:
          return {
            label: "High",
            tone: "border-amber-400/60 text-amber-300",
          };
        case 2:
          return {
            label: "Medium",
            tone: "border-sky-400/50 text-sky-300",
          };
        default:
          return {
            label: "Low",
            tone: "border-muted/40 text-muted-foreground",
          };
      }
    };

    upcomingTasks.forEach((task) => {
      const dueDate = resolveDueDate(task);
      const projectName = projectLookup.get(task.project_id)?.name ?? "Inbox";
      const { label: priorityLabel, tone: priorityTone } = toPriority(task.priority);

      const addToBucket = (bucket: keyof typeof buckets, dueLabel: string) => {
        buckets[bucket].push({
          id: task.id,
          content: task.content,
          projectName,
          dueLabel,
          priorityLabel,
          priorityTone,
          url: task.url,
        });
      };

      if (!dueDate) {
        addToBucket("unscheduled", "No due date");
        return;
      }

      const dayDiff = differenceInCalendarDays(startOfDay(dueDate), todayStart);

      if (dayDiff < 0) {
        const overdueLabel = dayDiff === -1 ? "1 day overdue" : `${Math.abs(dayDiff)} days overdue`;
        addToBucket("overdue", overdueLabel);
        return;
      }

      if (dayDiff === 0) {
        addToBucket("today", "Today");
        return;
      }

      if (dayDiff === 1) {
        addToBucket("upcoming", "Tomorrow");
        return;
      }

      addToBucket("upcoming", `In ${dayDiff} days`);
    });

    return buckets;
  }, [projectLookup, upcomingTasks]);

  const totalActionable = useMemo(
    () => Object.values(actionPlan).reduce((sum, bucket) => sum + bucket.length, 0),
    [actionPlan],
  );

  const totalActionableLabel = useMemo(
    () => numberFormatter.format(totalActionable),
    [numberFormatter, totalActionable],
  );

  const actionableNoun = useMemo(
    () => (totalActionable === 1 ? "task" : "tasks"),
    [totalActionable],
  );

  const userFirstName = useMemo(() => {
    if (userProfile?.full_name) {
      return userProfile.full_name.trim().split(/\s+/)[0];
    }
    if (useSampleData) {
      return "Explorer";
    }
    return null;
  }, [userProfile?.full_name, useSampleData]);

  const planColumnMeta = useMemo(() => {
    const owner = userFirstName ?? "You";
    return [
      {
        key: "overdue" as const,
        title: "Catch up",
        description: `${owner} can clear these first`,
        gradient: "from-destructive/25 via-destructive/10 to-transparent",
        emptyState: "No overdue tasks - momentum secured!",
      },
      {
        key: "today" as const,
        title: "Today focus",
        description: `${owner} can move the day forward`,
        gradient: "from-primary/20 via-primary/5 to-transparent",
        emptyState: "Nothing else due today.",
      },
      {
        key: "upcoming" as const,
        title: "Next up",
        description: "Lock in your next wins",
        gradient: "from-emerald-300/20 via-emerald-200/10 to-transparent",
        emptyState: "You're ahead for the week.",
      },
      {
        key: "unscheduled" as const,
        title: "Backlog gems",
        description: "Schedule these to keep momentum",
        gradient: "from-muted/30 via-muted/10 to-transparent",
        emptyState: "Everything has a home.",
      },
    ];
  }, [userFirstName]);

  const resolvedAvatarUrl = useMemo(() => {
    if (!userProfile) {
      return null;
    }

    if (userProfile.avatar_url) {
      return userProfile.avatar_url.startsWith("//")
        ? `https:${userProfile.avatar_url}`
        : userProfile.avatar_url;
    }

    if (userProfile.image_id) {
      return `https://dcff1xvirvpb3.cloudfront.net/${userProfile.image_id}.jpg`;
    }

    return null;
  }, [userProfile]);

  const userInitials = useMemo(() => {
    const fullName = userProfile?.full_name ?? (useSampleData ? "DoneGlow Explorer" : "");
    if (!fullName) {
      return "DG";
    }
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }, [userProfile, useSampleData]);

  const formattedRangeLabel = useMemo(() => {
    if (
      !dateRange?.from ||
      !dateRange?.to ||
      isNaN(dateRange.from.getTime()) ||
      isNaN(dateRange.to.getTime())
    ) {
      return "Last 30 days";
    }

    const sameYear =
      dateRange.from.getFullYear() === dateRange.to.getFullYear();

    return sameYear
      ? `${format(dateRange.from, "MMM d")} - ${format(
          dateRange.to,
          "MMM d",
        )}`
      : `${format(dateRange.from, "MMM d, yyyy")} - ${format(
          dateRange.to,
          "MMM d, yyyy",
        )}`;
  }, [dateRange]);

  const activeProjects = useMemo(
    () => projectStats.filter((project) => project.count > 0).length,
    [projectStats],
  );

  const topHour = useMemo(() => {
    if (!hourStats.length) {
      return null;
    }

    return hourStats.reduce((prev, current) =>
      current.count > prev.count ? current : prev,
    );
  }, [hourStats]);

  const topHourLabel = useMemo(() => {
    if (!topHour) {
      return "-";
    }

    const base = setHours(startOfDay(new Date()), topHour.hour);
    return format(base, "h a");
  }, [topHour]);

  const heroHighlights = useMemo(
    () => [
      {
        label: "Tasks captured",
        value: numberFormatter.format(filteredTasks.length),
        description: formattedRangeLabel,
      },
      {
        label: "Active projects",
        value: numberFormatter.format(activeProjects),
        description: "Contributing completions",
      },
      {
        label: "Peak energy",
        value: topHourLabel,
        description: hourStats.length
          ? "Most productive hour"
          : "No completions recorded",
      },
    ],
    [
      activeProjects,
      filteredTasks,
      formattedRangeLabel,
      hourStats.length,
      numberFormatter,
      topHourLabel,
    ],
  );

  const focusTip = useMemo(() => {
    const base =
      topHourLabel === "-"
        ? "Identify your most energetic hour and block it on the calendar."
        : `Protect your ${topHourLabel.toLowerCase()} slot for deep work today.`;

    if (!userFirstName) {
      return base;
    }

    return topHourLabel === "-"
      ? `${userFirstName}, find your most energetic hour and block it on the calendar.`
      : `${userFirstName}, protect your ${topHourLabel.toLowerCase()} slot for deep work today.`;
  }, [topHourLabel, userFirstName]);

  const heroHeadline = useMemo(
    () =>
      userFirstName
        ? `${userFirstName}, command your Todoist momentum`
        : "Command your Todoist momentum",
    [userFirstName],
  );

  const hasStoredToken =
    typeof window !== "undefined" &&
    Boolean(localStorage.getItem("todoist_token"));

  const handleExportSnapshot = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleShareHighlight = () => {
    const summary = `DoneGlow snapshot - ${numberFormatter.format(
      filteredTasks.length,
    )} tasks completed ${formattedRangeLabel}.`;

    if (typeof navigator !== "undefined") {
      if (navigator.share) {
        navigator
          .share({
            title: "DoneGlow snapshot",
            text: summary,
            url: typeof window !== "undefined" ? window.location.href : undefined,
          })
          .catch((err) => console.debug("Share cancelled", err));
        return;
      }

      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(
            `${summary}${
              typeof window !== "undefined" ? `\n${window.location.href}` : ""
            }`,
          )
          .catch((err) => console.debug("Clipboard unavailable", err));
        return;
      }
    }

    console.debug("Share APIs unavailable");
  };

   const triggerFetchData = () => {
       setUseSampleData(false);
       setRefreshTick((n) => n + 1);
   };

  // --- Helper to render main content ---
  const renderContent = () => {
    if (isLoading) {
      return (
        <div
          className="flex min-h-[360px] flex-col items-center justify-center rounded-[2.5rem] border border-white/10 bg-background/80 p-16 text-center shadow-[0_28px_70px_-40px_rgba(15,23,42,0.55)]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <span className="mt-6 text-lg font-medium text-muted-foreground">
            Loading your achievements...
          </span>
        </div>
      );
    }

    if (error) {
      return (
        <div
          className="mx-auto max-w-2xl rounded-[2.5rem] border border-destructive/30 bg-background/85 p-12 text-center shadow-[0_28px_70px_-40px_rgba(190,18,60,0.45)]"
          aria-live="polite"
        >
          <Alert variant="destructive" className="border-0 bg-transparent text-left">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
        <div className="mx-auto max-w-2xl rounded-[2.5rem] border border-white/10 bg-background/85 p-12 text-center shadow-[0_28px_70px_-40px_rgba(15,23,42,0.55)]">
          <Alert className="border-0 bg-transparent text-left text-foreground">
            <AlertDescription>
              Successfully connected to Todoist, but no completed tasks were found in your history. Complete some tasks and refresh!
            </AlertDescription>
          </Alert>
          <Button onClick={() => setUseSampleData(true)} variant="outline" className="mt-8">
            View Sample Data
          </Button>
        </div>
      );
    }

    // Check if there's data to display (either real or sample)
    if (tasks.length > 0 && projects.length > 0) {
      return (
        <div className="space-y-12">
          <section className="grid gap-6 xl:grid-cols-[2.35fr,1fr]">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-primary/12 via-background/95 to-background p-10 shadow-[0_32px_70px_-30px_rgba(15,23,42,0.6)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_65%)]" />
              <div className="relative flex flex-col gap-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <Badge
                      variant="secondary"
                      className="w-fit rounded-full border border-primary/30 bg-primary/15 text-primary"
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      Desktop spotlight
                    </Badge>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      {heroHeadline}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                      Elevate the desktop view with richer context, deeper insights, and quick actions designed for power users.
                    </p>
                    {userProfile && (
                      <div className="mt-6 flex items-center gap-4 rounded-3xl border border-white/10 bg-background/75 p-4 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.55)]">
                        <Avatar className="h-12 w-12 border border-white/10">
                          {resolvedAvatarUrl ? (
                            <AvatarImage src={resolvedAvatarUrl} alt={userProfile.full_name} />
                          ) : null}
                          <AvatarFallback className="text-base font-semibold text-foreground">
                            {userInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {userProfile.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {userProfile.timezone
                              ? `Working in ${userProfile.timezone}`
                              : "Connected Todoist account"}
                          </p>
                        </div>
                      </div>
                    )}
                    {useSampleData && (
                      <Badge
                        variant="outline"
                        className="mt-4 w-fit rounded-full border border-primary/40 text-primary"
                      >
                        Viewing sample insights
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center xl:flex-col xl:items-end">
                    <Button
                      variant="secondary"
                      onClick={triggerFetchData}
                      className="w-full gap-2 rounded-full sm:w-auto"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh insights
                    </Button>
                    <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={handleExportSnapshot}
                        className="flex-1 gap-2 rounded-full border-white/30 bg-background/80 sm:flex-none"
                      >
                        <Download className="h-4 w-4" />
                        Export snapshot
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleShareHighlight}
                        className="flex-1 gap-2 rounded-full border-white/30 bg-background/80 sm:flex-none"
                      >
                        <Share2 className="h-4 w-4" />
                        Share highlight
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {heroHighlights.map((highlight) => (
                    <div
                      key={highlight.label}
                      className="rounded-2xl border border-white/10 bg-background/85 p-4 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)]"
                    >
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground/70">
                        {highlight.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {highlight.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {highlight.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <aside className="hidden flex-col gap-6 rounded-[2.5rem] border border-white/10 bg-background/75 p-8 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.6)] xl:flex">
              <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {userFirstName ? `${userFirstName}'s focus pulse` : "Focus pulse"}
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="space-y-5 text-sm text-muted-foreground">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground/70">
                    Current streak
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {recapStats.currentStreak} days
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground/70">
                    Top project
                  </p>
                  <p className="mt-1 text-base font-medium text-foreground">
                    {recapStats.topProject.name || "No standout yet"}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {numberFormatter.format(recapStats.topProject.count)} tasks
                  </p>
                </div>
              </div>
              <div className="rounded-3xl bg-primary/10 p-5 text-sm text-primary">
                {focusTip}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground/70">
                  Saved filters
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Deep work window", "Inbox zero sprint", "Admin blast"].map((filter) => (
                    <Badge
                      key={filter}
                      variant="outline"
                      className="rounded-full border-white/20 bg-background/80 px-3 py-1 text-xs text-muted-foreground"
                    >
                      {filter}
                    </Badge>
                  ))}
                </div>
              </div>
            </aside>
          </section>

          <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-background/85 p-6 sm:p-8 shadow-[0_32px_70px_-36px_rgba(15,23,42,0.55)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,hsla(var(--primary),0.16),transparent_70%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,hsla(var(--accent),0.12),transparent_68%)]" />
            <div className="relative">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Action plan</h2>
                  <p className="text-sm text-muted-foreground">
                    {totalActionable > 0
                      ? `Grounded in ${totalActionableLabel} active ${actionableNoun} pulled straight from Todoist.`
                      : "We couldn't find any active tasks with due dates. Add a few in Todoist to activate the planner."}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="w-fit rounded-full border border-primary/30 bg-primary/10 text-xs uppercase tracking-[0.28em] text-primary"
                >
                  Live Todoist sync
                </Badge>
              </div>
              <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                {planColumnMeta.map((column) => {
                  const bucket = actionPlan[column.key];
                  return (
                    <div
                      key={column.key}
                      className="relative overflow-hidden rounded-3xl border border-white/10 bg-background/85 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.6)]"
                    >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${column.gradient}`} />
                    <div className="relative space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{column.title}</h3>
                        <p className="text-xs text-muted-foreground">{column.description}</p>
                      </div>
                      {bucket.length ? (
                        <ul className="space-y-3">
                          {bucket.slice(0, ACTION_PLAN_LIMIT).map((item) => (
                            <li
                              key={item.id}
                              className="group rounded-2xl border border-white/10 bg-background/80 p-4 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.55)]"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                    {item.content}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">{item.projectName}</p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`rounded-full border px-2 py-1 text-[11px] ${item.priorityTone}`}
                                >
                                  {item.priorityLabel}
                                </Badge>
                              </div>
                              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground/80">
                                <span>{item.dueLabel}</span>
                                {item.url ? (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
                                  >
                                    Open
                                    <ArrowUpRight className="h-3 w-3" />
                                  </a>
                                ) : null}
                              </div>
                            </li>
                          ))}
                          {bucket.length > ACTION_PLAN_LIMIT && (
                            <p className="text-xs text-muted-foreground/70">
                              +{bucket.length - ACTION_PLAN_LIMIT} more queued in Todoist
                            </p>
                          )}
                        </ul>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/15 bg-background/70 p-4 text-sm text-muted-foreground">
                          {column.emptyState}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </section>

          <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-background/80 p-8 shadow-[0_32px_70px_-36px_rgba(15,23,42,0.55)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,hsla(var(--primary),0.16),transparent_65%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,hsla(var(--accent),0.14),transparent_70%)]" />
            <div className="relative">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Plan your focus</h2>
                  <p className="text-sm text-muted-foreground">
                    Adjust the range to surface the trends that matter most.
                  </p>
                </div>
                <div className="max-w-xl lg:w-auto">
                  <h2 id="filters-heading" className="sr-only">
                    Date Range Filters
                  </h2>
                  <Filters dateRange={dateRange} onDateRangeChange={setDateRange} />
                </div>
              </div>
              <div className="mt-8">
                <h2 id="recap-heading" className="sr-only">
                  Summary Statistics
                </h2>
                <RecapCards stats={recapStats} />
              </div>
            </div>
          </section>

          <section className="space-y-8">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-background/80 p-6 sm:p-8 shadow-[0_32px_80px_-38px_rgba(15,23,42,0.55)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsla(var(--primary),0.18),transparent_65%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsla(var(--background),0.95)_0%,hsla(var(--background),0.85)_100%)] opacity-80" />
              <div className="relative">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-foreground">Completion heatmap</h2>
                  <p className="text-sm text-muted-foreground">
                    Spot streaks and quieter days at a glance.
                  </p>
                </div>
                <div className="-mx-4 sm:mx-0">
                  <CompletionHeatmap data={dayStats} onDayClick={handleDayClick} />
                </div>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {dayStats.length > 0 && projectStats.length > 0 && (
                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-background/80 p-6 sm:p-8 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.55)]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsla(var(--accent),0.18),transparent_65%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,hsla(var(--background),0.96)_0%,hsla(var(--background),0.85)_100%)] opacity-80" />
                  <div className="relative">
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold text-foreground">Weekly focus stacks</h2>
                      <p className="text-sm text-muted-foreground">
                        Understand how your attention shifts as weeks progress.
                      </p>
                    </div>
                    <WeeklyFocusStacks data={dayStats} projects={projectStats} />
                  </div>
                </div>
              )}

              {projectStats.length > 0 && (
                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-background/80 p-6 sm:p-8 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.55)]">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,hsla(var(--secondary),0.2),transparent_70%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,hsla(var(--background),0.96)_0%,hsla(var(--background),0.86)_100%)] opacity-75" />
                  <div className="relative">
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold text-foreground">Project share</h2>
                      <p className="text-sm text-muted-foreground">
                        Reveal which initiatives receive the most energy.
                      </p>
                    </div>
                    <ProjectShareDonut data={projectStats} />
                  </div>
                </div>
              )}
            </div>

            {hourStats.length > 0 && (
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-background/80 p-6 sm:p-8 shadow-[0_32px_80px_-38px_rgba(15,23,42,0.55)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsla(var(--primary),0.15),transparent_70%)]" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(200deg,hsla(var(--background),0.96)_0%,hsla(var(--background),0.85)_100%)] opacity-80" />
                <div className="relative">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-foreground">Time-of-day rhythm</h2>
                    <p className="text-sm text-muted-foreground">
                      Understand when your completions peak.
                    </p>
                  </div>
                  <TimeOfDayRhythm data={hourStats} />
                </div>
              </div>
            )}
          </section>
        </div>
      );
    }

     // Fallback for unexpected states (e.g., loading finished but no data set somehow)
     return (
        <div className="mx-auto max-w-2xl rounded-[2.5rem] border border-white/10 bg-background/85 p-12 text-center shadow-[0_28px_70px_-40px_rgba(15,23,42,0.55)]">
          <Alert className="border-0 bg-transparent text-left text-foreground">
            <AlertDescription>
              Loading completed or data is unavailable in the expected format. Please try again.
            </AlertDescription>
          </Alert>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-30 bg-[linear-gradient(135deg,hsla(var(--background),1)_0%,hsla(var(--background),0.94)_40%,hsla(var(--background),1)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 opacity-40 [background-image:radial-gradient(1px_1px_at_1px_1px,hsla(var(--foreground),0.08),transparent)] [background-size:46px_46px]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[480px] w-[480px] animate-orb-drift rounded-full bg-[radial-gradient(circle,hsla(var(--primary),0.28),transparent_65%)] blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] animate-[orb-drift_28s_ease-in-out_infinite_reverse] rounded-full bg-[radial-gradient(circle,hsla(var(--secondary),0.2),transparent_65%)] blur-3xl" />
        <div className="absolute bottom-[-200px] left-1/2 h-[640px] w-[640px] -translate-x-1/2 animate-[orb-drift_32s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,hsla(var(--accent),0.22),transparent_70%)] blur-3xl" />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
          <div className="relative flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/50 via-primary/25 to-primary/60 shadow-[0_18px_30px_-18px_rgba(14,116,144,0.65)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--primary)_0%,transparent_70%)] opacity-70" />
              <CheckCircle2 className="relative h-5 w-5 text-primary-foreground drop-shadow-sm" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                DoneGlow
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground/70">
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary"
                >
                  <Sparkles className="h-3 w-3" />
                  Desktop insights
                </Badge>
                <span className="hidden sm:inline">
                  Todoist completion intelligence
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tasks.length > 0 && (
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-background/80 px-3 py-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] lg:flex">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={triggerFetchData}
                  className="h-8 w-8 rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-primary"
                  aria-label="Refresh insights"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExportSnapshot}
                  className="h-8 w-8 rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-primary"
                  aria-label="Export snapshot"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShareHighlight}
                  className="h-8 w-8 rounded-full border border-white/10 text-muted-foreground transition-colors hover:text-primary"
                  aria-label="Share highlight"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-background/80 px-3 py-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              <Avatar className="h-8 w-8 border border-white/10">
                {resolvedAvatarUrl ? (
                  <AvatarImage src={resolvedAvatarUrl} alt={userProfile?.full_name ?? "DoneGlow explorer"} />
                ) : null}
                <AvatarFallback className="text-xs font-semibold text-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground/70">
                  {useSampleData ? "Sample mode" : "Welcome"}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {userProfile?.full_name ?? "DoneGlow Explorer"}
                </p>
              </div>
            </div>
            <ThemeToggle />
            {(!useSampleData && hasStoredToken) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                aria-label="Logout"
                className="hidden items-center gap-2 rounded-full border border-transparent px-4 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive md:flex"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </Button>
            )}
            {(!useSampleData && hasStoredToken) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Logout"
                className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive md:hidden"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative pb-16 pt-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] -z-10 bg-gradient-to-b from-primary/15 via-background/95 to-background" />
        <div className="pointer-events-none absolute inset-x-0 bottom-[-160px] h-[520px] -z-10 bg-[radial-gradient(circle_at_bottom,hsla(var(--secondary),0.18),transparent_68%)]" />
        <div className="pointer-events-none absolute inset-0 -z-20 opacity-30 [background-image:linear-gradient(180deg,transparent_0,hsla(var(--primary),0.08)_28%,transparent_65%)]" />
        <div className="mx-auto max-w-7xl space-y-12 px-4 lg:px-8">
          {renderContent()}
        </div>
      </main>

      {/* Task Drilldown Dialog */}
      <TaskDrilldown
        day={selectedDay}
        open={drilldownOpen}
        onOpenChange={setDrilldownOpen}
      />

      {/* Footer */}
      <footer className="mt-16 bg-background/95">
        <div className="mx-auto max-w-7xl border-t border-white/5 px-4 py-8 text-center text-xs text-muted-foreground lg:px-8">
          DoneGlow - Visualizing your Todoist progress.
          {useSampleData && (
            <Badge
              variant="outline"
              className="ml-3 inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.24em] text-primary"
            >
              Sample data
            </Badge>
          )}
        </div>
      </footer>
    </div>
  );
}

