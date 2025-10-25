import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayStats, ProjectStats } from "@/types/todoist";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

// Define chart colors outside the component
const BASE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const OTHER_COLOR = "hsl(var(--muted-foreground) / 0.5)"; // Use a muted grey for "Other"

interface WeeklyFocusStacksProps {
  data: DayStats[];
  projects: ProjectStats[];
}


export function WeeklyFocusStacks({ data, projects }: WeeklyFocusStacksProps) {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const projectColorMap = new Map<string, string>();
  projects.forEach((project, index) => {
    projectColorMap.set(
      project.projectName,
      project.projectId === "other-projects"
        ? OTHER_COLOR
        : BASE_COLORS[index % BASE_COLORS.length]
    );
  });

  const chartData = weekDays.map((day) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayData = data.find((d) => d.date === dateKey);

    const daySummary: { [key: string]: any } = {
      day: format(day, "EEE"),
      fullDate: dateKey,
      total: dayData?.count || 0,
    };

    projects.forEach(p => {
        daySummary[p.projectName] = 0;
    });

    if (dayData) {
        dayData.tasks.forEach(task => {
            const projectStat = projects.find(p => p.projectId === task.project_id)
                             || projects.find(p => p.projectId === `unknown-${task.project_id}`)
                             || projects.find(p => p.projectId === 'no-project' && !task.project_id)
                             || projects.find(p => p.projectId === 'other-projects');

            if (projectStat) {
                daySummary[projectStat.projectName] = (daySummary[projectStat.projectName] || 0) + 1;
            } else {
                 console.warn(`Task ${task.id} on ${dateKey} could not be mapped to a project stat.`);
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
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              dy={5}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={25}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              dx={-5}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
              content={({ active, payload, label }) => {
                 if (active && payload && payload.length) {
                   return (
                     <div className="rounded-lg border bg-popover text-popover-foreground p-2 shadow-sm min-w-[150px]">
                       <p className="font-semibold mb-1.5 text-sm">{label}</p> {/* Day Name */}
                       {payload.slice().reverse().map((entry, index) => (
                         <div key={`item-${index}`} className="flex items-center justify-between text-xs py-0.5">
                           <div className="flex items-center gap-1.5">
                             <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                             <span className="text-muted-foreground">{entry.name}:</span>
                           </div>
                           <span className="font-semibold text-foreground/90">{entry.value}</span>
                         </div>
                       ))}
                     </div>
                   );
                 }
                 return null;
               }}
            />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ paddingLeft: '20px', fontSize: '12px' }}
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-muted-foreground font-medium">{value}</span>}
            />
            {/* --- Reverted Radius Logic --- */}
            {projects.map((project, index) => (
              <Bar
                key={project.projectId}
                dataKey={project.projectName}
                stackId="a"
                fill={projectColorMap.get(project.projectName) || OTHER_COLOR}
                // Apply radius only to the last Bar defined in the map (usually the visual top)
                radius={index === projects.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
            {/* --- End Reverted Logic --- */}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}