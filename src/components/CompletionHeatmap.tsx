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

  const getIntensity = (count: number): string => {
    if (count === 0) return "bg-muted hover:bg-muted/80"; // Add hover state for muted

    // Calculate intensity level (1 to 5)
    const level = Math.min(Math.ceil((count / maxCount) * 5), 5);

    // Map level to specific Tailwind classes with opacity
    switch (level) {
      case 1: return "bg-primary/20 hover:bg-primary/30"; // Weakest intensity
      case 2: return "bg-primary/40 hover:bg-primary/50";
      case 3: return "bg-primary/60 hover:bg-primary/70";
      case 4: return "bg-primary/80 hover:bg-primary/90";
      case 5: return "bg-primary hover:bg-primary/90";    // Strongest intensity (full color)
      default: return "bg-muted hover:bg-muted/80"; // Fallback, same as 0 count
    }
  };

  return (
    <Card className="animate-scale-in">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-chart-1/20 to-chart-1/10 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-chart-1" />
          </div>
          <CardTitle className="text-xl">Completion Heatmap</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {data.map((day) => (
            <TooltipProvider key={day.date}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDayClick(day)}
                    className={`aspect-square rounded-lg transition-all hover:scale-110 hover:ring-2 hover:ring-primary hover:shadow-lg ${getIntensity(day.count)}`}
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
