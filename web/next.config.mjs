/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AWS SDK is server-only; never bundle it (or secrets) to the client.
  serverExternalPackages: [
    "@aws-sdk/client-dynamodb",
    "@aws-sdk/lib-dynamodb",
    "@aws-sdk/client-sqs",
    "@aws-sdk/client-scheduler",
    "@aws-sdk/client-lambda",
  ],
};

export default nextConfig;
