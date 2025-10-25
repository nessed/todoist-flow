import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  // Set the initial useState default to 'dark'
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const root = window.document.documentElement;
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    // --- Change the fallback value from "light" to "dark" ---
    const initialTheme = savedTheme || "dark";
    // --- End Change ---
    setTheme(initialTheme);
    root.classList.toggle("dark", initialTheme === "dark");

    // Add 'dark' class initially if it's the default and no saved theme exists
    if (!savedTheme) {
        root.classList.add("dark");
    }

  }, []); // Empty dependency array ensures this runs only once on mount

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    window.document.documentElement.classList.toggle(
      "dark",
      newTheme === "dark"
    );
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={`rounded-full hover:bg-primary/10 hover:text-primary transition-all duration-300 ${
        theme === "dark" ? "bg-primary/5 text-primary" : ""
      }`}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5 transition-transform duration-300 hover:rotate-12" />
      ) : (
        <Sun className="h-5 w-5 transition-transform duration-300 hover:rotate-12" />
      )}
    </Button>
  );
}