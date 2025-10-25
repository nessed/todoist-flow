import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectStats } from "@/types/todoist";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ProjectShareDonutProps {
  data: ProjectStats[];
}

const BASE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const OTHER_COLOR = "hsl(var(--muted-foreground) / 0.5)";

export function ProjectShareDonut({ data }: ProjectShareDonutProps) {
  const chartData = data.map((project, index) => ({
    name: project.projectName,
    value: project.count,
    fill: project.projectId === "other-projects"
           ? OTHER_COLOR
           : BASE_COLORS[index % BASE_COLORS.length],
  }));

  const totalTasks = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="animate-scale-in">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-chart-3/20 to-chart-3/10 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-4 w-4 fill-chart-3">
               <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="10" fill="none" />
               <circle cx="50" cy="50" r="20" />
            </svg>
          </div>
          <CardTitle className="text-xl">Project Share</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            {/* --- Tooltip Style (Using Shadcn styles) --- */}
            <Tooltip
               cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
               content={({ active, payload }) => {
                 if (active && payload && payload.length) {
                   const data = payload[0].payload;
                   const percentage = totalTasks > 0 ? ((data.value / totalTasks) * 100).toFixed(1) : 0;
                   return (
                     <div className="rounded-lg border bg-popover text-popover-foreground p-2 shadow-sm min-w-[120px]">
                       <div className="flex flex-col space-y-0.5">
                          <span className="text-[0.75rem] uppercase text-muted-foreground font-medium">
                            {data.name}
                          </span>
                          <span className="font-semibold text-foreground/90">
                            {data.value} tasks ({percentage}%)
                          </span>
                       </div>
                     </div>
                   );
                 }
                 return null;
               }}
             />
             {/* --- Updated Legend Style --- */}
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ paddingLeft: '20px', fontSize: '12px' }} // Added font size
              iconType="circle"
              iconSize={8}
              // Update formatter for better styling
              formatter={(value) => <span className="text-muted-foreground font-medium">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}