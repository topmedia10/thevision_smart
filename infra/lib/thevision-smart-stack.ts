import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as path from "path";
import {
  TABLES,
  GSI,
  QUEUES,
  LAMBDAS,
  SCHEDULES,
  SECRETS,
  TIMEZONE,
} from "./constants";

const LAMBDA_ROOT = path.join(__dirname, "..", "..", "lambdas");
const LAMBDA_SRC = path.join(LAMBDA_ROOT, "src");
const LAMBDA_LOCK = path.join(LAMBDA_ROOT, "package-lock.json");
const entry = (name: string) => path.join(LAMBDA_SRC, name, "index.ts");

export class TheVisionSmartStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------
    // 1. DynamoDB tables
    // ------------------------------------------------------------------
    const common = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // never auto-delete customer data
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    };

    const customers = new dynamodb.Table(this, "Customers", {
      tableName: TABLES.customers,
      partitionKey: { name: "phone", type: dynamodb.AttributeType.STRING },
      ...common,
    });
    customers.addGlobalSecondaryIndex({
      indexName: GSI.reviewIndex,
      partitionKey: { name: "sentReview", type: dynamodb.AttributeType.STRING },
      sortKey: {
        name: "lastAppointmentEnd",
        type: dynamodb.AttributeType.STRING,
      },
    });

    const employees = new dynamodb.Table(this, "Employees", {
      tableName: TABLES.employees,
      partitionKey: { name: "employeeId", type: dynamodb.AttributeType.STRING },
      ...common,
    });
    employees.addGlobalSecondaryIndex({
      indexName: GSI.phoneIndex,
      partitionKey: { name: "phone", type: dynamodb.AttributeType.STRING },
    });

    const settings = new dynamodb.Table(this, "Settings", {
      tableName: TABLES.settings,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      ...common,
    });

    const savedMessages = new dynamodb.Table(this, "SavedMessages", {
      tableName: TABLES.savedMessages,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      ...common,
    });

    const smsActivityLog = new dynamodb.Table(this, "SmsActivityLog", {
      tableName: TABLES.smsActivityLog,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      ...common,
    });

    const smsIdempotency = new dynamodb.Table(this, "SmsIdempotency", {
      tableName: TABLES.smsIdempotency,
      partitionKey: { name: "dedupKey", type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: "ttl",
      ...common,
    });

    const allTables = [
      customers,
      employees,
      settings,
      savedMessages,
      smsActivityLog,
      smsIdempotency,
    ];

    // ------------------------------------------------------------------
    // 2. SQS — main queue + DLQ
    // ------------------------------------------------------------------
    const dlq = new sqs.Queue(this, "SmsOutboxDlq", {
      queueName: QUEUES.dlq,
      retentionPeriod: cdk.Duration.days(14),
    });

    const outbox = new sqs.Queue(this, "SmsOutbox", {
      queueName: QUEUES.main,
      // worker send time + buffer (Global SMS call + idempotency write)
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 4 },
    });

    // ------------------------------------------------------------------
    // 3. Secrets Manager (created empty — values filled in manually)
    // ------------------------------------------------------------------
    const globalSmsSecret = new secrets.Secret(this, "GlobalSmsSecret", {
      secretName: SECRETS.globalSms,
      description:
        "Global SMS { apiKey, originator }. ROTATE before go-live. EC2 only.",
    });
    const ec2ApiTokenSecret = new secrets.Secret(this, "Ec2ApiTokenSecret", {
      secretName: SECRETS.ec2ApiToken,
      description: "Bearer token for the EC2 HTTP API.",
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    const webhookSecret = new secrets.Secret(this, "WebhookSecret", {
      secretName: SECRETS.webhookSecret,
      description: "Shared secret for the appointment webhook header.",
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    const firebaseSecret = new secrets.Secret(this, "FirebaseSecret", {
      secretName: SECRETS.firebaseServiceAccount,
      description: "Firebase service-account JSON. sendPush Lambda only.",
    });

    // ------------------------------------------------------------------
    // 4. Lambda functions
    // ------------------------------------------------------------------
    const tableEnv = {
      TABLE_CUSTOMERS: TABLES.customers,
      TABLE_EMPLOYEES: TABLES.employees,
      TABLE_SETTINGS: TABLES.settings,
      TABLE_SAVED_MESSAGES: TABLES.savedMessages,
      TABLE_SMS_ACTIVITY_LOG: TABLES.smsActivityLog,
      TABLE_SMS_IDEMPOTENCY: TABLES.smsIdempotency,
      GSI_REVIEW_INDEX: GSI.reviewIndex,
      GSI_PHONE_INDEX: GSI.phoneIndex,
      SQS_QUEUE_URL: outbox.queueUrl,
      TZ: TIMEZONE,
    };

    const makeFn = (
      logicalId: string,
      name: string,
      extraEnv: Record<string, string> = {},
    ) =>
      new NodejsFunction(this, logicalId, {
        functionName: name,
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: entry(name.replace("smart-", "")),
        projectRoot: LAMBDA_ROOT,
        depsLockFilePath: LAMBDA_LOCK,
        handler: "handler",
        timeout: cdk.Duration.seconds(60),
        memorySize: 256,
        environment: { ...tableEnv, ...extraEnv },
        bundling: {
          minify: true,
          sourceMap: true,
          // aws-sdk v3 ships in the Node 20 runtime — keep bundles slim.
          externalModules: ["@aws-sdk/*"],
        },
      });

    // EC2 endpoint used by Lambdas that need the SMS balance (no whitelisted IP).
    const EC2_API_BASE = "https://api.thevision.co.il";

    const appointmentWebhookFn = makeFn(
      "AppointmentWebhookFn",
      LAMBDAS.appointmentWebhook,
      { WEBHOOK_SECRET_ARN: webhookSecret.secretArn },
    );
    const reviewsAutomationFn = makeFn(
      "ReviewsAutomationFn",
      LAMBDAS.reviewsAutomation,
    );
    const weeklySmsAutomationFn = makeFn(
      "WeeklySmsAutomationFn",
      LAMBDAS.weeklySmsAutomation,
      { EC2_API_BASE, EC2_API_TOKEN_ARN: ec2ApiTokenSecret.secretArn },
    );
    const weeklyPrecheckFn = makeFn("WeeklyPrecheckFn", LAMBDAS.weeklyPrecheck, {
      EC2_API_BASE,
      EC2_API_TOKEN_ARN: ec2ApiTokenSecret.secretArn,
    });
    const balanceMonitorFn = makeFn("BalanceMonitorFn", LAMBDAS.balanceMonitor, {
      EC2_API_BASE,
      EC2_API_TOKEN_ARN: ec2ApiTokenSecret.secretArn,
    });
    const sendPushFn = makeFn("SendPushFn", LAMBDAS.sendPush, {
      FIREBASE_SECRET_ARN: firebaseSecret.secretArn,
    });
    // sendPush bundles firebase-admin (not in the runtime).
    (sendPushFn.node.defaultChild as lambda.CfnFunction).addPropertyOverride(
      "Timeout",
      120,
    );
    const allFns = [
      appointmentWebhookFn,
      reviewsAutomationFn,
      weeklySmsAutomationFn,
      weeklyPrecheckFn,
      balanceMonitorFn,
      sendPushFn,
    ];

    // ---- Lambda IAM grants -------------------------------------------------
    // DynamoDB: grant per-need (read/write) — keep least privilege.
    customers.grantReadWriteData(appointmentWebhookFn);
    settings.grantReadData(appointmentWebhookFn);
    employees.grantReadData(appointmentWebhookFn); // welcome var replacement (שם_הספר)

    customers.grantReadWriteData(reviewsAutomationFn);
    settings.grantReadData(reviewsAutomationFn);
    employees.grantReadData(reviewsAutomationFn); // review var replacement (שם_הספר)

    customers.grantReadData(weeklySmsAutomationFn);
    employees.grantReadData(weeklySmsAutomationFn);
    settings.grantReadData(weeklySmsAutomationFn);
    smsActivityLog.grantWriteData(weeklySmsAutomationFn);

    customers.grantReadData(weeklyPrecheckFn);
    employees.grantReadData(weeklyPrecheckFn);
    settings.grantReadData(weeklyPrecheckFn);

    employees.grantReadData(balanceMonitorFn);
    settings.grantReadWriteData(balanceMonitorFn); // toggles runtime.lowBalanceAlerted

    settings.grantReadWriteData(sendPushFn); // writes runtime.lastPush*

    // SQS: producers
    outbox.grantSendMessages(appointmentWebhookFn);
    outbox.grantSendMessages(reviewsAutomationFn);
    outbox.grantSendMessages(weeklySmsAutomationFn);
    outbox.grantSendMessages(weeklyPrecheckFn);
    outbox.grantSendMessages(balanceMonitorFn);

    // Secrets
    webhookSecret.grantRead(appointmentWebhookFn);
    ec2ApiTokenSecret.grantRead(weeklySmsAutomationFn);
    ec2ApiTokenSecret.grantRead(weeklyPrecheckFn);
    ec2ApiTokenSecret.grantRead(balanceMonitorFn);
    firebaseSecret.grantRead(sendPushFn);

    // ------------------------------------------------------------------
    // 5. API Gateway (HTTP API) — public entry
    // ------------------------------------------------------------------
    const httpApi = new apigwv2.HttpApi(this, "PublicHttpApi", {
      apiName: "smart-public",
      description:
        "Public entry: appointment webhook + device registration.",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.POST],
        allowHeaders: ["content-type", "x-webhook-secret"],
      },
    });
    httpApi.addRoutes({
      path: "/webhook/appointment",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "WebhookIntegration",
        appointmentWebhookFn,
      ),
    });
    // ------------------------------------------------------------------
    // 6. EventBridge Scheduler
    // ------------------------------------------------------------------
    const schedulerRole = new iam.Role(this, "SchedulerRole", {
      roleName: "smart-scheduler-role",
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    for (const fn of [
      reviewsAutomationFn,
      weeklySmsAutomationFn,
      weeklyPrecheckFn,
      sendPushFn,
      balanceMonitorFn,
    ]) {
      fn.grantInvoke(schedulerRole);
    }

    const flexOff: scheduler.CfnSchedule.FlexibleTimeWindowProperty = {
      mode: "OFF",
    };
    const target = (
      fn: lambda.IFunction,
      input?: Record<string, unknown>,
    ): scheduler.CfnSchedule.TargetProperty => ({
      arn: fn.functionArn,
      roleArn: schedulerRole.roleArn,
      ...(input ? { input: JSON.stringify(input) } : {}),
    });

    // Fixed schedules
    new scheduler.CfnSchedule(this, "ReviewsSchedule", {
      name: SCHEDULES.reviews,
      flexibleTimeWindow: flexOff,
      scheduleExpression: "rate(10 minutes)",
      target: target(reviewsAutomationFn),
    });
    new scheduler.CfnSchedule(this, "BalanceMonitorSchedule", {
      name: SCHEDULES.balanceMonitor,
      flexibleTimeWindow: flexOff,
      scheduleExpression: "rate(1 hour)",
      target: target(balanceMonitorFn),
    });

    // User-editable schedules — created with sane defaults; the Next.js app
    // overwrites their cron via UpdateSchedule when settings are saved.
    // Default: Sunday 09:00 Asia/Jerusalem (precheck 08:00).
    new scheduler.CfnSchedule(this, "WeeklySmsSchedule", {
      name: SCHEDULES.weeklySms,
      flexibleTimeWindow: flexOff,
      scheduleExpression: "cron(0 9 ? * 1 *)",
      scheduleExpressionTimezone: TIMEZONE,
      target: target(weeklySmsAutomationFn),
    });
    new scheduler.CfnSchedule(this, "WeeklySmsPrecheckSchedule", {
      name: SCHEDULES.weeklySmsPrecheck,
      flexibleTimeWindow: flexOff,
      scheduleExpression: "cron(0 8 ? * 1 *)",
      scheduleExpressionTimezone: TIMEZONE,
      target: target(weeklyPrecheckFn),
    });
    new scheduler.CfnSchedule(this, "WeeklyPushSchedule", {
      name: SCHEDULES.weeklyPush,
      flexibleTimeWindow: flexOff,
      scheduleExpression: "cron(0 9 ? * 1 *)",
      scheduleExpressionTimezone: TIMEZONE,
      target: target(sendPushFn, { trigger: "weekly" }),
    });

    // ------------------------------------------------------------------
    // 7. IAM — EC2 instance role + Vercel deploy user
    // ------------------------------------------------------------------
    // (a) Role for the existing EC2 instance. Attach the instance profile to
    //     i-08b5b54881a151608 manually (see runbook) — CDK cannot mutate an
    //     instance it does not own.
    const ec2Role = new iam.Role(this, "Ec2InstanceRole", {
      roleName: "smart-ec2-role",
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore",
        ),
      ],
    });
    outbox.grantConsumeMessages(ec2Role);
    dlq.grantConsumeMessages(ec2Role);
    smsIdempotency.grantReadWriteData(ec2Role);
    smsActivityLog.grantWriteData(ec2Role);
    employees.grantReadWriteData(ec2Role); // OTP hash/session writes
    globalSmsSecret.grantRead(ec2Role);
    ec2ApiTokenSecret.grantRead(ec2Role);
    const ec2InstanceProfile = new iam.CfnInstanceProfile(
      this,
      "Ec2InstanceProfile",
      {
        instanceProfileName: "smart-ec2-instance-profile",
        roles: [ec2Role.roleName],
      },
    );

    // (b) Least-privilege IAM user for Vercel (server-side AWS calls only).
    //     Use a customer-managed policy (6 KB limit) with wildcard ARNs — an
    //     inline user policy (2 KB limit) overflows with per-resource grants.
    const vercelUser = new iam.User(this, "VercelUser", {
      userName: "smart-vercel",
    });
    const tableArnPrefix = `arn:aws:dynamodb:${this.region}:${this.account}:table/smart-`;
    const vercelPolicy = new iam.ManagedPolicy(this, "VercelPolicy", {
      managedPolicyName: "smart-vercel-policy",
      statements: [
        new iam.PolicyStatement({
          sid: "DynamoCrud",
          actions: [
            "dynamodb:GetItem",
            "dynamodb:BatchGetItem",
            "dynamodb:Query",
            "dynamodb:Scan",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:BatchWriteItem",
            "dynamodb:ConditionCheckItem",
          ],
          resources: [`${tableArnPrefix}*`, `${tableArnPrefix}*/index/*`],
        }),
        new iam.PolicyStatement({
          sid: "SqsSend",
          actions: [
            "sqs:SendMessage",
            "sqs:SendMessageBatch",
            "sqs:GetQueueAttributes",
          ],
          resources: [outbox.queueArn],
        }),
        new iam.PolicyStatement({
          sid: "InvokeSendPush",
          actions: ["lambda:InvokeFunction"],
          resources: [sendPushFn.functionArn],
        }),
        new iam.PolicyStatement({
          sid: "ReadApiSecrets",
          actions: ["secretsmanager:GetSecretValue"],
          resources: [ec2ApiTokenSecret.secretArn, webhookSecret.secretArn],
        }),
        new iam.PolicyStatement({
          sid: "ManageEditableSchedules",
          actions: ["scheduler:GetSchedule", "scheduler:UpdateSchedule"],
          resources: [
            `arn:aws:scheduler:${this.region}:${this.account}:schedule/default/${SCHEDULES.weeklySms}`,
            `arn:aws:scheduler:${this.region}:${this.account}:schedule/default/${SCHEDULES.weeklySmsPrecheck}`,
            `arn:aws:scheduler:${this.region}:${this.account}:schedule/default/${SCHEDULES.weeklyPush}`,
          ],
        }),
        new iam.PolicyStatement({
          sid: "PassSchedulerRole",
          actions: ["iam:PassRole"],
          resources: [schedulerRole.roleArn],
          conditions: {
            StringEquals: { "iam:PassedToService": "scheduler.amazonaws.com" },
          },
        }),
      ],
    });
    vercelPolicy.attachToUser(vercelUser);

    // ------------------------------------------------------------------
    // 8. Outputs
    // ------------------------------------------------------------------
    const out = (id: string, value: string, description?: string) =>
      new cdk.CfnOutput(this, id, { value, description });

    out("PublicApiUrl", httpApi.apiEndpoint, "API Gateway base URL");
    out("WebhookUrl", `${httpApi.apiEndpoint}/webhook/appointment`);
    out("SqsQueueUrl", outbox.queueUrl);
    out("SqsQueueArn", outbox.queueArn);
    out("Ec2InstanceProfileName", ec2InstanceProfile.ref);
    out("Ec2RoleArn", ec2Role.roleArn);
    out("VercelUserName", vercelUser.userName, "Create an access key for this user");
    out("SchedulerRoleArn", schedulerRole.roleArn);
    for (const t of allTables) out(`Table_${t.node.id}`, t.tableName);
    out("GlobalSmsSecretName", globalSmsSecret.secretName);
    out("Ec2ApiTokenSecretName", ec2ApiTokenSecret.secretName);
    out("WebhookSecretName", webhookSecret.secretName);
    out("FirebaseSecretName", firebaseSecret.secretName);

    cdk.Tags.of(this).add("project", "thevision-smart");
  }
}
