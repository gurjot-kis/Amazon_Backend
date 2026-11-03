import dotenv from "dotenv";
dotenv.config();
import { messaging } from "../config/firebase.js";

try {
  // dryRun = true: validates credentials, nothing is delivered
  await messaging.send(
    {
      token: "fake-token-for-test",
      notification: { title: "Test", body: "Hello" },
    },
    true
  );
} catch (err) {
  console.log("Error code:", err.code);
  console.log("Message:", err.message);
}