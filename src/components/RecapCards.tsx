import type { CSSProperties } from "react";
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
      metric: stats.totalDone,
      goal: 120,
      display: stats.totalDone.toLocaleString(),
      helper: "Completed in this window",
      icon: Target,
      conicColor: "var(--chart-1, var(--primary))",
      glow: "from-chart-1/35 via-transparent to-transparent",
    },
    {
      title: "Current Streak",
      metric: stats.currentStreak,
      goal: 21,
      display: `${stats.currentStreak} days`,
      helper: "Daily completion run",
      icon: Flame,
      conicColor: "var(--chart-2, var(--primary))",
      glow: "from-chart-2/35 via-transparent to-transparent",
    },
    {
      title: "Best Day",
      metric: stats.bestDay.count,
      goal: 30,
      display: stats.bestDay.count.toLocaleString(),
      helper: `On ${bestDayDateFormatted}`,
      icon: Trophy,
      conicColor: "var(--chart-3, var(--primary))",
      glow: "from-chart-3/35 via-transparent to-transparent",
    },
    {
      title: "Top Project",
      metric: stats.topProject.count,
      goal: 60,
      display: stats.topProject.count.toLocaleString(),
      helper: stats.topProject.name || "No standout yet",
      icon: TrendingUp,
      conicColor: "var(--chart-4, var(--primary))",
      glow: "from-chart-4/35 via-transparent to-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <Card
          key={card.title}
          className="relative overflow-hidden group animate-card-in border border-white/5 bg-background/80 backdrop-blur-xl shadow-[0_20px_45px_-22px_rgba(15,23,42,0.55)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_32px_60px_-30px_rgba(15,23,42,0.65)]"
          style={{ animationDelay: `${index * 90}ms` }}
        >
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.glow} opacity-0 transition-opacity duration-500 group-hover:opacity-80`}
          />
          <div className="pointer-events-none absolute -top-10 -right-16 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />

          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-1">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                {card.title}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground/70">{card.helper}</p>
            </div>
            <div className="relative h-12 w-12">
              {(() => {
                const progress = Math.min(
                  card.metric > 0 && card.goal > 0
                    ? card.metric / card.goal
                    : 0,
                  0.95
                );
                const conicStyle: CSSProperties = {
                  background: `conic-gradient(${card.conicColor} ${Math.max(
                    progress,
                    0.12
                  ) * 360}deg, transparent ${Math.max(progress, 0.12) * 360}deg)`,
                };

                return (
                  <>
                    <div className="absolute inset-0 rounded-full bg-muted/30" />
                    <div
                      className="absolute inset-[2px] rounded-full opacity-90"
                      style={conicStyle}
                    />
                    <div className="absolute inset-[5px] flex items-center justify-center rounded-full border border-white/10 bg-background/90 shadow-inner">
                      <card.icon className="h-4 w-4 text-foreground" />
                    </div>
                  </>
                );
              })()}
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-semibold tracking-tight text-foreground">
              {card.display}
            </div>
            <p className="pt-2 text-xs uppercase tracking-[0.28em] text-muted-foreground/70">
              Momentum
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
