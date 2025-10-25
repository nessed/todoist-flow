import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectStats } from "@/types/todoist";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ChartTooltipContent } from "@/components/ui/chart" // Import the custom tooltip

interface ProjectShareDonutProps {
  data: ProjectStats[];
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

export function ProjectShareDonut({ data }: ProjectShareDonutProps) {
  const chartData = data.map((project, index) => ({
    name: project.projectName,
    value: project.count,
    // Assign color based on project ID or use base colors, reserving grey for "Other"
    fill: project.projectId === "other-projects"
           ? OTHER_COLOR
           : BASE_COLORS[index % BASE_COLORS.length],
  }));

  return (
    <Card className="animate-scale-in">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-chart-3/20 to-chart-3/10 flex items-center justify-center">
            {/* Simple static icon representation */}
            <svg viewBox="0 0 100 100" className="h-4 w-4 fill-chart-3">
               <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="10" fill="none" />
               <circle cx="50" cy="50" r="20" />
            </svg>
          </div>
          <CardTitle className="text-xl">Project Share</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name" // Ensures name is available in tooltip payload
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            {/* Use the custom ChartTooltipContent for better formatting */}
            <Tooltip
               cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
               content={({ active, payload }) => {
                 if (active && payload && payload.length) {
                   const data = payload[0].payload; // Access the underlying data object
                   const total = chartData.reduce((sum, item) => sum + item.value, 0);
                   const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
                   return (
                     <div className="rounded-lg border bg-background p-2 shadow-sm min-w-[120px]">
                       <div className="grid grid-cols-[auto,1fr,auto] items-center gap-2">
                         <div className="flex flex-col space-y-1">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              {data.name}
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {data.value} tasks ({percentage}%)
                            </span>
                         </div>
                       </div>
                     </div>
                   );
                 }
                 return null;
               }}
             />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}