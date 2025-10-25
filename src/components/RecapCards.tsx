import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecapStats } from "@/types/todoist";
import { Trophy, Flame, TrendingUp, Target } from "lucide-react";
import { format, parseISO, isValid } from "date-fns"; // Import isValid

interface RecapCardsProps {
  stats: RecapStats;
}

export function RecapCards({ stats }: RecapCardsProps) {
  // --- Validate date before formatting ---
  const bestDayDateFormatted =
    stats.bestDay.date && isValid(parseISO(stats.bestDay.date))
      ? format(parseISO(stats.bestDay.date), "MMM d")
      : "-";
  // --- End validation ---

  const cards = [
    {
      title: "Total Done",
      value: stats.totalDone,
      icon: Target,
      color: "text-chart-1",
    },
    {
      title: "Current Streak",
      value: `${stats.currentStreak} days`,
      icon: Flame,
      color: "text-chart-2",
    },
    {
      title: "Best Day",
      value: stats.bestDay.count,
      subtitle: bestDayDateFormatted, // Use validated date
      icon: Trophy,
      color: "text-chart-3",
    },
    {
      title: "Top Project",
      value: stats.topProject.count,
      subtitle: stats.topProject.name || "N/A", // Ensure subtitle exists
      icon: TrendingUp,
      color: "text-chart-4",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <Card
          key={card.title}
          className="relative overflow-hidden group animate-card-in border bg-card shadow-card hover:shadow-card-hover transition-all duration-300"
          // --- Add animation delay ---
          style={{ animationDelay: `${index * 100}ms` }}
          // --- End delay ---
        >
          {/* Optional: subtle background pattern or gradient */}
          {/* <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-300" /> */}

          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
            {" "}
            {/* Adjusted padding */}
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            {/* Icon treatment */}
            <div
              className={`p-2 rounded-lg bg-gradient-to-br from-muted to-background border shadow-inner`}
            >
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {/* Value styling */}
            <div className="text-2xl font-bold text-foreground">
              {card.value}
            </div>
            {card.subtitle && (
              <p className="text-xs text-muted-foreground pt-1">
                {card.subtitle}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
