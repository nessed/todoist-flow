import { useState, useMemo, useEffect } from "react"; // Import useState
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayStats } from "@/types/todoist";
import {
  format,
  parseISO,
  getDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getMonth,
  getYear,
  isSameMonth,
  addMonths,
} from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// --- Import Collapsible components ---
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react"; // Icon for trigger
// --- End Import ---

interface CompletionHeatmapProps {
  data: DayStats[]; // Expects data sorted by date ASC
  onDayClick: (day: DayStats) => void;
}

const getWeekDayIndex = (date: Date) => {
  const day = getDay(date);
  return day === 0 ? 6 : day - 1; // Monday = 0, Sunday = 6
};

// --- Adjusted Color Scale (Back to Primary Opacity) ---
const HEATMAP_COLORS = [
  "bg-muted/50 hover:bg-muted/80", // Level 0 (no tasks) - Slightly lighter muted
  "bg-primary/20 hover:bg-primary/30", // Level 1
  "bg-primary/40 hover:bg-primary/50", // Level 2
  "bg-primary/60 hover:bg-primary/70", // Level 3
  "bg-primary/80 hover:bg-primary/90", // Level 4
  "bg-primary hover:bg-primary/90", // Level 5 (max intensity)
];
// --- End Adjusted Color Scale ---

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CompletionHeatmap({
  data,
  onDayClick,
}: CompletionHeatmapProps) {
  // --- State to manage open/closed state of collapsibles (optional, default open) ---
  // If you want them to start closed, initialize useState({})
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('heatmap_open_months');
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch (_) {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('heatmap_open_months', JSON.stringify(openMonths));
    } catch (_) {
      // ignore persistence errors
    }
  }, [openMonths]);
  // --- End State ---

  const monthlyData = useMemo(() => {
    // ... (grouping logic remains the same as previous step) ...
    if (!data || data.length === 0) return [];
    const dataMap = new Map(data.map((d) => [d.date, d]));
    const months: {
      year: number;
      month: number;
      monthKey: string;
      monthName: string;
      days: (DayStats | null)[];
    }[] = [];
    const firstDate = parseISO(data[0].date);
    const lastDate = parseISO(data[data.length - 1].date);
    let loopDate = startOfMonth(firstDate);
    while (loopDate <= lastDate) {
      const year = getYear(loopDate);
      const month = getMonth(loopDate);
      const monthKey = `${year}-${month}`; // Unique key for state
      const monthName = format(loopDate, "MMMM yyyy"); // Use full month name
      const currentMonthData: {
        year: number;
        month: number;
        monthKey: string;
        monthName: string;
        days: (DayStats | null)[];
      } = { year, month, monthKey, monthName, days: [] };
      const firstDayOfMonth = startOfMonth(loopDate);
      const startDayIndex = getWeekDayIndex(firstDayOfMonth);
      for (let i = 0; i < startDayIndex; i++) {
        currentMonthData.days.push(null);
      }
      const daysInMonth = eachDayOfInterval({
        start: firstDayOfMonth,
        end: endOfMonth(loopDate),
      });
      daysInMonth.forEach((dayDate) => {
        const dateKey = format(dayDate, "yyyy-MM-dd");
        if (dataMap.has(dateKey)) {
          currentMonthData!.days.push(dataMap.get(dateKey)!);
        } else {
          currentMonthData!.days.push({ date: dateKey, count: 0, tasks: [] });
        }
      });
      months.push(currentMonthData);
      loopDate = addMonths(loopDate, 1);
    }
    return months;
  }, [data]);

  const maxCount = useMemo(
    () => Math.max(...data.map((d) => d.count), 1),
    [data]
  );

  const getIntensity = (count: number): string => {
    if (count <= 0) return HEATMAP_COLORS[0];
    const percentage = Math.min(count / maxCount, 1);
    // Use length - 1 because array includes level 0
    const level = Math.min(
      Math.ceil(percentage * (HEATMAP_COLORS.length - 1)),
      HEATMAP_COLORS.length - 1
    );
    return HEATMAP_COLORS[level] || HEATMAP_COLORS[0];
  };

  // Handler to toggle month open state
  const toggleMonth = (monthKey: string) => {
    setOpenMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey], // Toggle state, default to true if undefined
    }));
  };

  return (
    <Card className="animate-scale-in">
      <CardHeader>
        {/* ... (Header content remains the same) ... */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-chart-1/20 to-chart-1/10 flex items-center justify-center">
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-chart-1">
              {/* Icon remains same */}
              <rect x="2" y="2" width="4" height="4" rx="1" />{" "}
              <rect x="8" y="2" width="4" height="4" rx="1" />{" "}
              <rect x="14" y="2" width="4" height="4" rx="1" />{" "}
              <rect x="2" y="8" width="4" height="4" rx="1" />{" "}
              <rect x="8" y="8" width="4" height="4" rx="1" />{" "}
              <rect x="14" y="8" width="4" height="4" rx="1" />{" "}
              <rect x="2" y="14" width="4" height="4" rx="1" />{" "}
              <rect x="8" y="14" width="4" height="4" rx="1" />{" "}
              <rect x="14" y="14" width="4" height="4" rx="1" />
            </svg>
          </div>
          <CardTitle className="text-xl">Completion Heatmap</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* Container for scroll or layout adjustments */}
        <div className="flex flex-col space-y-3">
          {/* Optional: Add Weekday Labels */}
          <div className="grid grid-cols-7 gap-2 pl-[3.5rem]">
            {/* Add padding to align with days */}
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-xs text-muted-foreground font-medium text-center"
              >
                {label}
              </div>
            ))}
          </div>

          {monthlyData.map(({ monthKey, monthName, days }) => (
            // --- Wrap month in Collapsible ---
            <Collapsible
              key={monthKey}
              defaultOpen={openMonths[monthKey] ?? true}
              onOpenChange={(open) =>
                setOpenMonths((prev) => ({ ...prev, [monthKey]: open }))
              }
            >
              <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-semibold mb-1 w-full group">
                {monthName}
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {/* Content collapses */}
                {/* Add weekday labels on the side */}
                <div className="flex gap-2">
                  <div className="flex flex-col justify-between pt-1 pb-1 w-8 text-xs text-muted-foreground space-y-[0.6rem]">
                    <span></span> {/* Align with Mon */}
                    <span>Wed</span>
                    <span></span> {/* Align with Fri */}
                    <span></span>
                  </div>
                  {/* Grid for the days */}
                  <div className="grid grid-cols-7 gap-2 flex-1">
                    {days.map((day, index) => {
                      if (day === null) {
                        return (
                          <div
                            key={`pad-${monthKey}-${index}`}
                            className="aspect-square rounded-lg bg-transparent"
                          />
                        );
                      }
                      const dayDate = parseISO(day.date);
                      return (
                        <TooltipProvider key={day.date}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => onDayClick(day)}
                                className={`aspect-square rounded-lg transition-all duration-150 ${getIntensity(
                                  day.count
                                )}`}
                                aria-label={`${format(dayDate, "MMM d")}: ${
                                  day.count
                                } tasks`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <div className="font-semibold">
                                  {format(dayDate, "MMM d, yyyy (EEEE)")}
                                </div>
                                <div>{day.count} tasks completed</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            // --- End Collapsible ---
          ))}
        </div>

        {/* --- Updated Legend (using new color array) --- */}
        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            {HEATMAP_COLORS.map((colorClass, level) => (
              <div
                key={level}
                className={`w-3 h-3 rounded-sm ${colorClass.split(" ")[0]}`}
              />
            ))}
          </div>
          <span>More</span>
        </div>
        {/* --- End Updated Legend --- */}
      </CardContent>
    </Card>
  );
}
