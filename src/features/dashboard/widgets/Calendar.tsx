import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { addDays, addMonths, format, getDaysInMonth, isSameDay, startOfMonth } from "date-fns";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { WidgetDefinition } from "../types";

// Recurring nationwide federal holidays, with the Friday/Monday observance used by OPM:
// https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/
function federalHolidays(year: number) {
  const nthWeekday = (month: number, weekday: number, occurrence: number) => {
    const first = new Date(year, month, 1);
    return new Date(year, month, 1 + ((weekday - first.getDay() + 7) % 7) + 7 * (occurrence - 1));
  };
  const mayLastDay = new Date(year, 4, 31);
  const memorialDay = new Date(year, 4, 31 - ((mayLastDay.getDay() + 6) % 7));
  const holidays: [string, Date][] = [
    ["New Year's Day", new Date(year, 0, 1)],
    ["Martin Luther King Jr. Day", nthWeekday(0, 1, 3)],
    ["Washington's Birthday", nthWeekday(1, 1, 3)],
    ["Memorial Day", memorialDay],
    ["Juneteenth National Independence Day", new Date(year, 5, 19)],
    ["Independence Day", new Date(year, 6, 4)],
    ["Labor Day", nthWeekday(8, 1, 1)],
    ["Columbus Day", nthWeekday(9, 1, 2)],
    ["Veterans Day", new Date(year, 10, 11)],
    ["Thanksgiving Day", nthWeekday(10, 4, 4)],
    ["Christmas Day", new Date(year, 11, 25)],
  ];

  return holidays.flatMap(([name, date]) => {
    const day = date.getDay();
    return [
      { name, date },
      ...(day === 0 || day === 6
        ? [{ name: `${name} (observed)`, date: addDays(date, day === 6 ? -1 : 1) }]
        : []),
    ];
  });
}

function CalendarWidget() {
  const [today, setToday] = useState(() => new Date());
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(() => setToday(new Date()), midnight.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [today]);

  const month = startOfMonth(addMonths(today, offset));
  const monthLabel = format(month, "MMMM yyyy");
  const daysInMonth = getDaysInMonth(month);
  // Next year's New Year's Day may be observed on December 31 of this year.
  const holidays = [
    ...federalHolidays(month.getFullYear()),
    ...federalHolidays(month.getFullYear() + 1),
  ].filter(
    ({ date }) =>
      date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth(),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          disabled={offset === -2}
          onClick={() => setOffset((value) => Math.max(-2, value - 1))}
        >
          <ChevronLeft />
        </Button>
        <h4 className="flex-1 text-center font-semibold" aria-live="polite">
          {monthLabel}
        </h4>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next month"
          disabled={offset === 2}
          onClick={() => setOffset((value) => Math.min(2, value + 1))}
        >
          <ChevronRight />
        </Button>
      </div>

      <table className="w-full table-fixed text-center text-xs" aria-label={monthLabel}>
        <thead>
          <tr>
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
              (day) => (
                <th
                  key={day}
                  scope="col"
                  aria-label={day}
                  className="pb-2 font-normal text-muted-foreground"
                >
                  <abbr title={day} className="no-underline">
                    {day.slice(0, 1)}
                  </abbr>
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.ceil((month.getDay() + daysInMonth) / 7) }, (_, week) => (
            <tr key={week}>
              {Array.from({ length: 7 }, (_, weekday) => {
                const day = week * 7 + weekday - month.getDay() + 1;
                if (day < 1 || day > daysInMonth) return <td key={weekday} className="h-9" />;
                const date = new Date(month.getFullYear(), month.getMonth(), day);
                const dateLabel = format(date, "EEEE, MMMM d, yyyy");
                const holiday = holidays.find((holiday) => isSameDay(holiday.date, date));
                const isToday = isSameDay(date, today);
                const dayCell = (
                  <time
                    dateTime={format(date, "yyyy-MM-dd")}
                    aria-current={isToday ? "date" : undefined}
                    title={holiday ? undefined : dateLabel}
                    className={cn(
                      "relative mx-auto flex size-7 items-center justify-center rounded-full tabular-nums",
                      (weekday === 0 || weekday === 6) && "text-muted-foreground",
                      holiday && "font-semibold text-foreground",
                      isToday && "bg-primary text-primary-foreground font-semibold",
                    )}
                  >
                    {day}
                    {holiday && (
                      <span
                        aria-hidden
                        className="absolute -bottom-1 size-1 rounded-full bg-accent"
                      />
                    )}
                  </time>
                );
                return (
                  <td key={weekday} className="h-9 p-0">
                    {holiday ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={dayCell}
                          tabIndex={0}
                          aria-label={`${dateLabel}: ${holiday.name}`}
                        />
                        <TooltipContent>{holiday.name}</TooltipContent>
                      </Tooltip>
                    ) : (
                      dayCell
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default {
  name: "Calendar",
  component: CalendarWidget,
  getExternalUrl: () => "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/",
} satisfies WidgetDefinition;
