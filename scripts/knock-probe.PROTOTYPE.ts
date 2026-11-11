// PROTOTYPE — throwaway probe for "Does Knock hold up against Cadence?"
import Knock, { signUserToken } from "@knocklabs/node";
process.loadEnvFile(".env");
const knock = new Knock({ apiKey: process.env.KNOCK_API_KEY });
const uid = "cadence-probe";
await knock.users.update(uid, { name: "Probe", email: "probe@example.com" });
console.log("user upserted");
const token = await signUserToken(uid, { expiresInSeconds: 3600 });
console.log("token alg:", JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()));
const feedUrl = `https://api.knock.app/v1/users/${uid}/feeds/${process.env.KNOCK_FEED_CHANNEL_ID}`;
const h = { Authorization: `Bearer ${process.env.KNOCK_PUBLIC_API_KEY}` };
for (const [label, hdr] of [["with token", { ...h, "X-Knock-User-Token": token }], ["no token", h], ["other user's token", { ...h, "X-Knock-User-Token": await signUserToken("someone-else") }]] as const) {
  const r = await fetch(feedUrl, { headers: hdr });
  console.log(label, r.status, (await r.text()).slice(0, 200));
}
for (const key of ["discussion-reply", "new-enrollment"]) {
  try { const r = await knock.workflows.trigger(key, { recipients: [uid] }); console.log("trigger", key, r); }
  catch (e: any) { console.log("trigger", key, e.status, e.message?.slice(0, 200)); }
}
try { console.log("prefs", JSON.stringify(await knock.users.getPreferences(uid, "default"))); } catch (e: any) { console.log("prefs err", e.status, e.message); }
