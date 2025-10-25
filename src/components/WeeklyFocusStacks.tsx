import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayStats, ProjectStats } from "@/types/todoist";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { ChartTooltipContent } from "@/components/ui/chart"; // Import custom tooltip if needed

interface WeeklyFocusStacksProps {
  data: DayStats[];
  projects: ProjectStats[]; // Should now include "Other" if applicable
}

// Define chart colors outside the component
const BASE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const OTHER_COLOR = "hsl(var(--muted-foreground) / 0.5)"; // Use a muted grey for "Other"

export function WeeklyFocusStacks({ data, projects }: WeeklyFocusStacksProps) {
  // Get current week
  const now = new Date();
  // Ensure week starts on Monday (iso8601 standard)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Map projects to their colors, assigning grey to "Other"
  const projectColorMap = new Map<string, string>();
  projects.forEach((project, index) => {
    projectColorMap.set(
      project.projectName,
      project.projectId === "other-projects"
        ? OTHER_COLOR
        : BASE_COLORS[index % BASE_COLORS.length]
    );
  });

  // Process data for stacked bar chart
  const chartData = weekDays.map((day) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayData = data.find((d) => d.date === dateKey);

    const daySummary: { [key: string]: any } = {
      day: format(day, "EEE"), // Short day name (Mon, Tue)
      fullDate: dateKey,
      total: dayData?.count || 0, // Add total for potential tooltip use
    };

    // Initialize counts for all projects (including "Other") to 0 for this day
    projects.forEach(p => {
        daySummary[p.projectName] = 0;
    });

    // Populate counts from actual tasks for the day
    if (dayData) {
        dayData.tasks.forEach(task => {
            // Find which projectStat this task belongs to (could be grouped into "Other")
            const projectStat = projects.find(p => p.projectId === task.project_id)
                             || projects.find(p => p.projectId === `unknown-${task.project_id}`)
                             || projects.find(p => p.projectId === 'no-project' && !task.project_id)
                             || projects.find(p => p.projectId === 'other-projects'); // Fallback to "Other" if grouping happened

            if (projectStat) {
                daySummary[projectStat.projectName] = (daySummary[projectStat.projectName] || 0) + 1;
            } else {
                // Should ideally map to "Other" if grouping logic is robust
                 console.warn(`Task ${task.id} on ${dateKey} could not be mapped to a project stat.`);
                 // Optionally count towards a default "Unmapped" or directly "Other"
                 if (daySummary["Other"] !== undefined) {
                      daySummary["Other"] = (daySummary["Other"] || 0) + 1;
                 }
            }
        });
    }


    return daySummary;
  });


  return (
    <Card className="animate-scale-in">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-chart-2/20 to-chart-2/10 flex items-center justify-center">
             {/* Simple static icon representation */}
             <svg viewBox="0 0 100 100" className="h-4 w-4 fill-chart-2">
                <rect x="15" y="60" width="20" height="30" rx="3"/>
                <rect x="40" y="40" width="20" height="50" rx="3"/>
                <rect x="65" y="20" width="20" height="70" rx="3"/>
             </svg>
          </div>
          <CardTitle className="text-xl">Weekly Focus</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis dataKey="day" className="text-xs" axisLine={false} tickLine={false} />
            <YAxis className="text-xs" axisLine={false} tickLine={false} width={20}/>
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
              content={({ active, payload, label }) => {
                 if (active && payload && payload.length) {
                   return (
                     <div className="rounded-lg border bg-background p-2 shadow-sm min-w-[150px]">
                       <p className="font-medium mb-1">{label}</p> {/* Day Name */}
                       {payload.slice().reverse().map((entry, index) => ( // Reverse to show top stack first
                         <div key={`item-${index}`} className="flex items-center justify-between text-xs">
                           <div className="flex items-center gap-1.5">
                             <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                             <span className="text-muted-foreground">{entry.name}:</span>
                           </div>
                           <span className="font-medium">{entry.value}</span>
                         </div>
                       ))}
                     </div>
                   );
                 }
                 return null;
               }}
            />
            <Legend />
            {/* Map through projects (which includes "Other") */}
            {projects.map((project, index) => (
              <Bar
                key={project.projectId}
                dataKey={project.projectName}
                stackId="a" // All bars belong to the same stack
                fill={projectColorMap.get(project.projectName) || OTHER_COLOR} // Use the mapped color
                // Apply radius only to the top segment of the stack
                // Note: Recharts doesn't easily support radius on *top* stack dynamically.
                // We apply it based on the *last* project in the list, which might not always be the top visually if counts vary.
                // For perfect top radius, more complex rendering or a different library might be needed.
                radius={index === projects.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}