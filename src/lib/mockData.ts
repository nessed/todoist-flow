import { TodoistTask, TodoistProject } from "@/types/todoist";
import { subDays, format } from "date-fns";

export function generateMockTasks(days: number = 30): TodoistTask[] {
  const projects = ["proj1", "proj2", "proj3", "proj4"];
  const tasks: TodoistTask[] = [];
  const now = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = subDays(now, i);
    const tasksPerDay = Math.floor(Math.random() * 8) + 2;
    
    for (let j = 0; j < tasksPerDay; j++) {
      const hour = Math.floor(Math.random() * 16) + 6; // 6 AM to 10 PM
      const minute = Math.floor(Math.random() * 60);
      date.setHours(hour, minute, 0, 0);
      
      tasks.push({
        id: `task-${i}-${j}`,
        content: `Task ${i}-${j}: ${getRandomTaskContent()}`,
        completed_at: date.toISOString(),
        project_id: projects[Math.floor(Math.random() * projects.length)],
        labels: [],
      });
    }
  }
  
  return tasks;
}

export function generateMockProjects(): TodoistProject[] {
  return [
    { id: "proj1", name: "Work", color: "red" },
    { id: "proj2", name: "Personal", color: "blue" },
    { id: "proj3", name: "Learning", color: "green" },
    { id: "proj4", name: "Health", color: "purple" },
  ];
}

function getRandomTaskContent(): string {
  const tasks = [
    "Review pull requests",
    "Update documentation",
    "Team meeting",
    "Code review",
    "Write blog post",
    "Exercise routine",
    "Read chapter",
    "Grocery shopping",
    "Call client",
    "Fix bug",
    "Design mockup",
    "Plan sprint",
  ];
  return tasks[Math.floor(Math.random() * tasks.length)];
}
