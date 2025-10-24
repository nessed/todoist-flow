import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DayStats } from "@/types/todoist";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface TaskDrilldownProps {
  day: DayStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDrilldown({ day, open, onOpenChange }: TaskDrilldownProps) {
  if (!day) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Tasks completed on {format(parseISO(day.date), "MMMM d, yyyy")}
          </DialogTitle>
          <DialogDescription>
            View all {day.tasks.length} tasks completed on this day, including
            completion times and labels.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {day.tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No tasks completed on this day
            </p>
          ) : (
            day.tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-xl border bg-gradient-to-br from-card to-muted/20 hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{task.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {format(task.completedDate, "h:mm a")}
                      </span>
                    </div>
                  </div>
                  {task.labels.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {task.labels.map((label) => (
                        <Badge
                          key={label}
                          variant="secondary"
                          className="text-xs"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
