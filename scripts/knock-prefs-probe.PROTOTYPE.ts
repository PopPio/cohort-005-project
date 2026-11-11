// PROTOTYPE — throwaway preference probe
import Knock from "@knocklabs/node";
process.loadEnvFile(".env");
const k = new Knock({ apiKey: process.env.KNOCK_API_KEY });
const t = await k.tenants.set("cadence", { name: "Cadence", settings: { preference_set: { workflows: { "new-enrollment": false } } } });
console.log("tenant", JSON.stringify(t.settings));
console.log("user prefs resolved for tenant", JSON.stringify(await k.users.getPreferences("cadence-probe", "default", { tenant: "cadence" })));
await k.users.setPreferences("cadence-probe", "default", { workflows: { "new-enrollment": true } });
console.log("after opt-in", JSON.stringify(await k.users.getPreferences("cadence-probe", "default", { tenant: "cadence" })));
await k.users.unsetPreferences("cadence-probe", "default");
