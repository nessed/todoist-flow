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
    <Card>
      <CardHeader>
        <CardTitle>Time-of-Day Rhythm</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="hour" 
              className="text-xs"
              interval={2}
            />
            <YAxis className="text-xs" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
