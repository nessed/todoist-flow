import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HourStats } from "@/types/todoist";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TimeOfDayRhythmProps {
  data: HourStats[];
}

export function TimeOfDayRhythm({ data }: TimeOfDayRhythmProps) {
  const chartData = data.map((hour) => ({
    hour: `${hour.hour.toString().padStart(2, "0")}:00`,
    count: hour.count,
  }));

  return (
    <Card className="animate-scale-in">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-chart-4/20 to-chart-4/10 flex items-center justify-center">
            {/* Simple clock icon using SVG */}
             <svg viewBox="0 0 24 24" className="h-4 w-4 fill-chart-4" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/>
                <path d="M13 7h-2v6l5.25 3.15.75-1.23-4-2.42z"/>
             </svg>
          </div>
          <CardTitle className="text-xl">Time-of-Day Rhythm</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            {/* --- Updated XAxis Tick Style --- */}
            <XAxis
              dataKey="hour"
              axisLine={false}
              tickLine={false}
              interval={2} // Show every 3rd label (00, 03, 06...)
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              dy={5}
            />
            {/* --- Updated YAxis Tick Style --- */}
            <YAxis
              axisLine={false}
              tickLine={false}
              width={25}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              dx={-5}
            />
            {/* --- Tooltip Style (Using Shadcn styles) --- */}
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                padding: "8px 12px", // Adjust padding
                boxShadow: "hsl(var(--shadow))"
              }}
              labelStyle={{ marginBottom: '4px', fontWeight: 600 }} // Style the label (hour)
              itemStyle={{ fontSize: '12px' }} // Style item text
              formatter={(value: number) => [`${value} tasks`, null]} // Format the value text, hide name
              labelFormatter={(label: string) => `At ${label}`} // Format the label text
            />
            <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}