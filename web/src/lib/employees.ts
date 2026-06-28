import "server-only";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "./aws/clients";
import { TABLES, INDEXES } from "./constants";

export interface Employee {
  employeeId: string;
  firstName?: string;
  lastName?: string;
  phone?: string; // E.164
  admin?: boolean;
  showInSms?: boolean;
  notifyLowBalance?: boolean;
  otpHash?: string;
  otpExpiresAt?: string;
  otpAttempts?: number;
  sessionTokenHash?: string;
  sessionExpiresAt?: string;
}

export async function getEmployeeById(employeeId: string): Promise<Employee | undefined> {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLES.employees, Key: { employeeId } }),
  );
  return res.Item as Employee | undefined;
}

export async function getEmployeeByPhone(phone: string): Promise<Employee | undefined> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLES.employees,
      IndexName: INDEXES.phoneIndex,
      KeyConditionExpression: "phone = :p",
      ExpressionAttributeValues: { ":p": phone },
      Limit: 1,
    }),
  );
  return res.Items?.[0] as Employee | undefined;
}

export async function listEmployees(): Promise<Employee[]> {
  const out: Employee[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: TABLES.employees, ExclusiveStartKey }),
    );
    for (const i of res.Items ?? []) out.push(i as Employee);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}

export async function putEmployee(emp: Employee): Promise<void> {
  await ddb.send(new PutCommand({ TableName: TABLES.employees, Item: emp }));
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({ TableName: TABLES.employees, Key: { employeeId } }),
  );
}

export async function updateEmployeeFields(
  employeeId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets = keys.map((k, i) => {
    names[`#k${i}`] = k;
    values[`:v${i}`] = fields[k];
    return `#k${i} = :v${i}`;
  });
  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.employees,
      Key: { employeeId },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}
