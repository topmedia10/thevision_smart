import {
  getSettings,
  WeeklySmsSettings,
  AlertsSettings,
  AudienceSettings,
} from "../shared/settings";
import { selectWeeklyRecipients } from "../shared/customers";
import { getSmsBalance } from "../shared/ec2";
import { sendOperationalAlert } from "../shared/alerts";

/**
 * Fires exactly one hour before the weekly-SMS blast. If the balance won't
 * cover the recipient count, alert flagged employees so they can top up.
 */
export const handler = async (): Promise<void> => {
  const weekly = await getSettings<WeeklySmsSettings>("weeklySms");
  if (!weekly.enabled) {
    console.log("weekly precheck: weekly sms disabled");
    return;
  }

  const filterDays = Number(weekly.filterDays ?? 0);
  const audienceSettings = await getSettings<AudienceSettings>("audience");
  const recipients = await selectWeeklyRecipients(
    filterDays,
    weekly.audience ?? "all",
    audienceSettings,
  );
  const count = recipients.length;
  if (count === 0) {
    console.log("weekly precheck: no recipients");
    return;
  }

  let balance: number;
  try {
    balance = await getSmsBalance();
  } catch (e) {
    console.error("weekly precheck: balance check failed", e);
    return;
  }

  if (balance < count) {
    const alerts = await getSettings<AlertsSettings>("alerts");
    const n = await sendOperationalAlert(
      "precheck",
      alerts.weeklyPrecheckMessage ??
        "שימו לב: אין מספיק יתרת SMS לשליחה השבועית הקרובה.",
    );
    console.warn(
      `weekly precheck: balance ${balance} < ${count}, alerted ${n} employees`,
    );
  } else {
    console.log(`weekly precheck OK: balance ${balance} >= ${count}`);
  }
};
