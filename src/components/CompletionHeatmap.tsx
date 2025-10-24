import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayStats } from "@/types/todoist";
import { format, parseISO } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CompletionHeatmapProps {
  data: DayStats[];
  onDayClick: (day: DayStats) => void;
}

export function CompletionHeatmap({ data, onDayClick }: CompletionHeatmapProps) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getIntensity = (count: number) => {
    if (count === 0) return "bg-muted";
    const intensity = Math.ceil((count / maxCount) * 4);
    return `bg-primary/${intensity * 20}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completion Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {data.map((day) => (
            <TooltipProvider key={day.date}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDayClick(day)}
                    className={`aspect-square rounded-md transition-all hover:scale-110 hover:ring-2 hover:ring-primary ${getIntensity(day.count)}`}
                    aria-label={`${format(parseISO(day.date), "MMM d")}: ${day.count} tasks`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <div className="font-semibold">{format(parseISO(day.date), "MMM d, yyyy")}</div>
                    <div>{day.count} tasks completed</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`w-3 h-3 rounded-sm ${level === 0 ? 'bg-muted' : `bg-primary/${level * 20}`}`}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
