import webpush from "web-push";
import { readFileSync } from "node:fs";

// usage: node scripts/send-push.mjs [subscription.json] [title] [body]
const [
  ,
  ,
  subPath = "spike/subscription.json",
  title = "The fire is dimming",
  body = "Thursday matters.",
] = process.argv;

const vapid = JSON.parse(readFileSync("spike/vapid.json", "utf8"));
webpush.setVapidDetails("mailto:fullstackfang@gmail.com", vapid.publicKey, vapid.privateKey);

const subscription = JSON.parse(readFileSync(subPath, "utf8"));
const result = await webpush.sendNotification(
  subscription,
  JSON.stringify({ title, body, url: "/push-spike" })
);
console.log(`sent: HTTP ${result.statusCode}`);
