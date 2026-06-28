import "server-only";
import {
  GetScheduleCommand,
  UpdateScheduleCommand,
} from "@aws-sdk/client-scheduler";
import { scheduler } from "./aws/clients";
import { SCHEDULES, TIMEZONE } from "./constants";

/**
 * Build an EventBridge cron from a day-of-week (0=Sun..6=Sat) and "HH:mm".
 * AWS cron day-of-week is 1-7 with 1=Sunday → dayOfWeek + 1.
 */
function cronFor(dayOfWeek: number, hour: number, minute: number): string {
  const awsDow = ((dayOfWeek % 7) + 7) % 7; // 0..6
  return `cron(${minute} ${hour} ? * ${awsDow + 1} *)`;
}

function parseHHmm(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map((x) => parseInt(x, 10));
  return { hour: h || 0, minute: m || 0 };
}

/** Subtract 60 minutes from a (dayOfWeek, HH:mm), handling day rollover. */
export function minusOneHour(
  dayOfWeek: number,
  time: string,
): { dayOfWeek: number; hour: number; minute: number } {
  const { hour, minute } = parseHHmm(time);
  let total = hour * 60 + minute - 60;
  let dow = dayOfWeek;
  if (total < 0) {
    total += 1440;
    dow = (dayOfWeek - 1 + 7) % 7;
  }
  return { dayOfWeek: dow, hour: Math.floor(total / 60), minute: total % 60 };
}

/** Full-replacement update of one schedule's cron expression. */
async function setScheduleCron(name: string, cron: string): Promise<void> {
  const current = await scheduler.send(new GetScheduleCommand({ Name: name }));
  await scheduler.send(
    new UpdateScheduleCommand({
      Name: name,
      GroupName: current.GroupName,
      ScheduleExpression: cron,
      ScheduleExpressionTimezone: TIMEZONE,
      FlexibleTimeWindow: current.FlexibleTimeWindow ?? { Mode: "OFF" },
      Target: current.Target,
      State: current.State,
      Description: current.Description,
    }),
  );
}

/**
 * Update the weekly-SMS schedule AND its pre-check (time − 1h, with day
 * rollover). Called when the weekly-SMS settings are saved.
 */
export async function updateWeeklySmsSchedules(
  dayOfWeek: number,
  time: string,
): Promise<void> {
  const { hour, minute } = parseHHmm(time);
  await setScheduleCron(SCHEDULES.weeklySms, cronFor(dayOfWeek, hour, minute));

  const pre = minusOneHour(dayOfWeek, time);
  await setScheduleCron(
    SCHEDULES.weeklySmsPrecheck,
    cronFor(pre.dayOfWeek, pre.hour, pre.minute),
  );
}

/** Update the weekly-push schedule. Called when weekly-push settings are saved. */
export async function updateWeeklyPushSchedule(
  dayOfWeek: number,
  time: string,
): Promise<void> {
  const { hour, minute } = parseHHmm(time);
  await setScheduleCron(SCHEDULES.weeklyPush, cronFor(dayOfWeek, hour, minute));
}
