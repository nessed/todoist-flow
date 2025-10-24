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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden group animate-fade-in border-none bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">{card.value}</div>
            {card.subtitle && (
              <p className="text-sm text-muted-foreground mt-2 font-medium">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
