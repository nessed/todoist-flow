import { useState, useEffect } from "react"; // Import useState and useEffect
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, subDays, isSameDay } from "date-fns"; // Import isSameDay
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils"; // Import cn

interface FiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const presets = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export function Filters({ dateRange, onDateRangeChange }: FiltersProps) {
  const [activePreset, setActivePreset] = useState<number | null>(null);

  // Determine which preset is active based on the current dateRange
  useEffect(() => {
    let matchedPreset: number | null = null;
    const today = new Date();
    if (dateRange?.from && dateRange?.to && isSameDay(dateRange.to, today)) {
      for (const preset of presets) {
        const expectedFromDate = subDays(today, preset.days);
        if (isSameDay(dateRange.from, expectedFromDate)) {
          matchedPreset = preset.days;
          break;
        }
      }
    }
    setActivePreset(matchedPreset);
  }, [dateRange]);

  const handlePreset = (days: number) => {
    const to = new Date();
    const from = subDays(to, days); // Use subDays for accuracy
    onDateRangeChange({ from, to });
    // setActivePreset(days); // useEffect will handle this now
  };

  const handleCustomRangeChange = (range: DateRange | undefined) => {
      onDateRangeChange(range);
      // setActivePreset(null); // Clear preset when custom range is selected, useEffect handles this
  }

  return (
    <Card className="animate-fade-in border-none bg-gradient-to-br from-card to-muted/30">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Preset Buttons */}
          <div className="flex gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                // --- Change variant based on activePreset ---
                variant={activePreset === preset.days ? "default" : "outline"}
                size="sm"
                onClick={() => handlePreset(preset.days)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              {/* --- Add visual cue if custom range is active --- */}
              <Button
                 variant="outline"
                 size="sm"
                 className={cn(
                    "w-[200px] justify-start text-left font-normal", // Base style
                    !dateRange && "text-muted-foreground", // Style if no date selected
                    activePreset === null && "ring-2 ring-primary ring-offset-2 ring-offset-background" // Highlight if custom range active
                 )}
               >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  <span>Custom range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleCustomRangeChange} // Use updated handler
                numberOfMonths={2}
                disabled={{ after: new Date() }} // Prevent selecting future dates
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}