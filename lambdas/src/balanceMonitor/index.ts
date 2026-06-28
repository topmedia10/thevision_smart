import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLES } from "../shared/ddb";
import { getSettings, AlertsSettings, RuntimeSettings } from "../shared/settings";
import { getSmsBalance } from "../shared/ec2";
import { sendOperationalAlert } from "../shared/alerts";

/**
 * Standalone hourly monitor. Sends ONE alert when the balance crosses below
 * the threshold (cooldown flag in runtime.lowBalanceAlerted), and resets the
 * flag once it recovers.
 */
export const handler = async (): Promise<void> => {
  const alerts = await getSettings<AlertsSettings>("alerts");
  const threshold = Number(alerts.lowBalanceThreshold ?? 0);
  if (!threshold) {
    console.log("balance monitor: no threshold configured");
    return;
  }

  let balance: number;
  try {
    balance = await getSmsBalance();
  } catch (e) {
    console.error("balance monitor: balance check failed", e);
    return;
  }

  const runtime = await getSettings<RuntimeSettings>("runtime");
  const alerted = runtime.lowBalanceAlerted === true;

  if (balance < threshold && !alerted) {
    const n = await sendOperationalAlert(
      "threshold",
      alerts.lowBalanceMessage ??
        `יתרת ה-SMS ירדה מתחת ל-${threshold}.`,
    );
    await setAlerted(true);
    console.warn(`balance monitor: ${balance} < ${threshold}, alerted ${n}`);
  } else if (balance >= threshold && alerted) {
    await setAlerted(false);
    console.log(`balance monitor: recovered to ${balance}, reset flag`);
  } else {
    console.log(`balance monitor: balance ${balance}, alerted=${alerted}`);
  }
};

async function setAlerted(value: boolean): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.settings,
      Key: { pk: "SETTINGS", sk: "runtime" },
      UpdateExpression: "SET lowBalanceAlerted = :v",
      ExpressionAttributeValues: { ":v": value },
    }),
  );
}
