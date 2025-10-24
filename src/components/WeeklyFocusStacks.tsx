import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayStats, ProjectStats } from "@/types/todoist";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

interface WeeklyFocusStacksProps {
  data: DayStats[];
  projects: ProjectStats[];
}

export function WeeklyFocusStacks({ data, projects }: WeeklyFocusStacksProps) {
  // Get current week
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Process data for stacked bar chart
  const chartData = weekDays.map((day) => {
    const dateKey = format(day, "yyyy-MM-dd");
    const dayData = data.find((d) => d.date === dateKey);
    
    const dayProjects: any = {
      day: format(day, "EEE"),
      fullDate: dateKey,
    };

    projects.forEach((project) => {
      const projectTasks = dayData?.tasks.filter((t) => t.project_id === project.projectId) || [];
      dayProjects[project.projectName] = projectTasks.length;
    });

    return dayProjects;
  });

  const colors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Focus Stacks</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            {projects.map((project, index) => (
              <Bar
                key={project.projectId}
                dataKey={project.projectName}
                stackId="a"
                fill={colors[index % colors.length]}
                radius={index === projects.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
