import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card"; // Keep Card for structure/padding
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, subDays, isSameDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false); // State for popover

  useEffect(() => {
    let matchedPreset: number | null = null;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day

    if (dateRange?.from && dateRange?.to) {
        const rangeFromStart = new Date(dateRange.from);
        rangeFromStart.setHours(0, 0, 0, 0);
        const rangeToEnd = new Date(dateRange.to);
        rangeToEnd.setHours(0, 0, 0, 0);

        if (isSameDay(rangeToEnd, today)) {
            for (const preset of presets) {
                const expectedFromDate = subDays(today, preset.days);
                if (isSameDay(rangeFromStart, expectedFromDate)) {
                  matchedPreset = preset.days;
                  break;
                }
            }
        }
    }
    setActivePreset(matchedPreset);
  }, [dateRange]);

  const handlePreset = (days: number) => {
    const to = new Date();
    const from = subDays(to, days);
    onDateRangeChange({ from, to });
    setIsPopoverOpen(false); // Close popover if open
  };

  const handleCustomRangeChange = (range: DateRange | undefined) => {
      onDateRangeChange(range);
      // Close popover once a range is selected
      if (range?.from && range?.to) {
          setIsPopoverOpen(false);
      }
      // If only 'from' is selected, keep popover open
  }

  return (
    // Use Card for padding/structure, but make it visually subtle
    <Card className="bg-transparent border-none shadow-none p-0">
      <CardContent className="p-0"> {/* Remove CardContent padding */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 md:gap-4 bg-muted/50 rounded-lg p-3 md:p-4 border"> {/* Add background, padding, border */}
          {/* Preset Buttons */}
          <div className="flex gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant={activePreset === preset.days ? "default" : "outline"}
                size="sm"
                onClick={() => handlePreset(preset.days)}
                className={cn(
                    "transition-all",
                    activePreset === preset.days ? "shadow-md" : "bg-background hover:bg-accent" // Adjust styling
                )}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Separator for visual distinction (optional) */}
          {/* <Separator orientation="vertical" className="h-6 hidden sm:block mx-2" /> */}

          {/* Custom Range Picker */}
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                 id="date-range-picker"
                 variant="outline"
                 size="sm"
                 className={cn(
                    "w-full sm:w-[240px] justify-start text-left font-normal bg-background hover:bg-accent", // Ensure background for contrast
                    !dateRange && "text-muted-foreground",
                    activePreset === null && dateRange && "ring-2 ring-primary ring-offset-2 ring-offset-background" // Highlight only if custom and selected
                 )}
               >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
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
                onSelect={handleCustomRangeChange}
                numberOfMonths={2}
                disabled={{ after: new Date() }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}