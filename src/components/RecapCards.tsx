import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecapStats } from "@/types/todoist";
import { Trophy, Flame, TrendingUp, Target } from "lucide-react";
import { format, parseISO } from "date-fns";

interface RecapCardsProps {
  stats: RecapStats;
}

export function RecapCards({ stats }: RecapCardsProps) {
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
      subtitle: stats.bestDay.date ? format(parseISO(stats.bestDay.date), "MMM d") : "-",
      icon: Trophy,
      color: "text-chart-3",
    },
    {
      title: "Top Project",
      value: stats.topProject.count,
      subtitle: stats.topProject.name,
      icon: TrendingUp,
      color: "text-chart-4",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
