import { computeOperationTasks } from "./src/lib/operationTasks";
import { computeMiniDayCells } from "./src/lib/scheduling";
import { addDays, startOfWeekIso, todayIso } from "./src/lib/format";

function timed<T>(label: string, fn: () => T): T {
  const t0 = Date.now();
  const result = fn();
  console.log(`[OK] ${label} — ${Date.now() - t0}ms`);
  return result;
}

console.log("=== Step 1: computeOperationTasks ===");
const tasks = timed("computeOperationTasks", () => computeOperationTasks());
console.log("tasks.length =", tasks.length);

console.log("=== Step 2: WeekCalendar day range (default, no anchor push) ===");
const WINDOW_PAD_DAYS = 28;
const today = todayIso();
const todayWeekStart = startOfWeekIso(today);
const defaultStart = addDays(todayWeekStart, -WINDOW_PAD_DAYS);
const defaultEnd = addDays(todayWeekStart, WINDOW_PAD_DAYS + 6);
const days: string[] = [];
for (let d = defaultStart; d <= defaultEnd; d = addDays(d, 1)) days.push(d);
console.log("days.length =", days.length, "first=", days[0], "last=", days[days.length - 1]);

console.log("=== Step 3: computeMiniDayCells for every day in range ===");
timed("computeMiniDayCells x" + days.length, () => {
  for (const date of days) {
    computeMiniDayCells(date, undefined);
  }
});

console.log("=== ALL DONE, no crash, no infinite loop ===");
