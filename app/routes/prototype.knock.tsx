// ⚠️ PROTOTYPE — throwaway spike for "Does Knock hold up against Cadence?"
// (PopPio/cohort-005-project#20). Lives on the prototype/knock-spike branch only.
// Never merge. Run: `npm run prototype:knock`, then open /prototype/knock.
import { useCallback, useEffect, useState } from "react";
import { data, Form, useNavigation } from "react-router";
import Knock, { signUserToken } from "@knocklabs/node";
import { and, desc, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Route } from "./+types/prototype.knock";
import { db } from "~/db";
import { comments, users } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";

try {
  process.loadEnvFile(".env");
} catch {}

const TENANT = "cadence";
const knock = () => new Knock({ apiKey: process.env.KNOCK_API_KEY });

// Knock recipient id = Cadence user id as a string.
async function syncUser(u: { id: number; name: string; email: string }) {
  await knock().users.update(String(u.id), { name: u.name, email: u.email });
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw data("Select a user from the DevUI panel.", { status: 401 });
  const user = db.select().from(users).where(eq(users.id, userId)).get()!;
  await syncUser(user);

  const token = await signUserToken(String(user.id), { expiresInSeconds: 3600 });
  const k = knock();
  const prefs = await k.users.getPreferences(String(user.id), "default", { tenant: TENANT }).catch((e) => ({ error: String(e) }));
  const tenant = await k.tenants.get(TENANT).catch((e) => ({ error: String(e) }));

  return {
    user: { id: user.id, name: user.name, role: user.role },
    token,
    tokenHeader: JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString()),
    publicKey: process.env.KNOCK_PUBLIC_API_KEY!,
    channelId: process.env.KNOCK_FEED_CHANNEL_ID!,
    prefs,
    tenant,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const userId = (await getCurrentUserId(request))!;
  const intent = String((await request.formData()).get("intent"));
  const k = knock();
  const me = db.select().from(users).where(eq(users.id, userId)).get()!;

  try {
    switch (intent) {
      case "discussion-reply": {
        // A real Discussion Reply from the DB whose Question was asked by someone else.
        const parent = alias(comments, "parent");
        const row = db
          .select({ reply: comments, question: parent })
          .from(comments)
          .innerJoin(parent, eq(comments.parentId, parent.id))
          .where(and(isNotNull(comments.parentId), isNull(comments.deletedAt), ne(comments.userId, parent.userId)))
          .orderBy(desc(comments.createdAt))
          .get();
        if (!row) return { log: "No Discussion Reply in the DB to replay." };
        const author = db.select().from(users).where(eq(users.id, row.reply.userId)).get()!;
        const asker = db.select().from(users).where(eq(users.id, row.question.userId)).get()!;
        await syncUser(author);
        await syncUser(asker);
        const res = await k.workflows.trigger("discussion-reply", {
          actor: String(author.id),
          recipients: [String(asker.id)],
          tenant: TENANT,
          data: { reply_excerpt: row.reply.body.slice(0, 140), lesson_id: row.reply.lessonId, comment_id: row.reply.id },
        });
        return { log: `Triggered discussion-reply: ${author.name} → ${asker.name} (user ${asker.id}). Switch to them in the DevUI. ${JSON.stringify(res)}` };
      }
      case "new-enrollment": {
        // Pretend some other user just enrolled in my course.
        const student = db.select().from(users).where(ne(users.id, me.id)).get()!;
        await syncUser(student);
        const res = await k.workflows.trigger("new-enrollment", {
          actor: String(student.id),
          recipients: [String(me.id)],
          tenant: TENANT,
          data: { course_title: "Prototype Course" },
        });
        return { log: `Triggered new-enrollment → me (${me.name}). ${JSON.stringify(res)}` };
      }
      case "tenant-defaults": {
        const res = await k.tenants.set(TENANT, {
          name: "Cadence",
          settings: { preference_set: { workflows: { "new-enrollment": false } } },
        });
        return { log: `Tenant default preference_set written: ${JSON.stringify(res.settings)}` };
      }
      case "opt-in":
      case "opt-out": {
        const res = await k.users.setPreferences(String(me.id), "default", {
          workflows: { "new-enrollment": intent === "opt-in" },
        });
        return { log: `${intent}: ${JSON.stringify(res)}` };
      }
      case "reset-prefs": {
        await k.users.unsetPreferences(String(me.id), "default");
        return { log: "User preferences unset (falls back to tenant/env defaults)." };
      }
    }
  } catch (e) {
    return { log: `ERROR ${intent}: ${String(e)}` };
  }
  return { log: `unknown intent ${intent}` };
}

// ─── Browser side: headless feed API with public key + signed user token ───

type FeedItem = { id: string; source: { key: string }; inserted_at: string; read_at: string | null; seen_at: string | null; data: Record<string, unknown>; actors: { id: string; name?: string }[]; blocks: { rendered?: string }[] };

export default function PrototypeKnock({ loaderData, actionData }: Route.ComponentProps) {
  const { user, token, tokenHeader, publicKey, channelId, prefs, tenant } = loaderData;
  const [feed, setFeed] = useState<{ status: number; body: any } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const nav = useNavigation();

  const call = useCallback(
    async (method: string, path: string, body?: unknown) => {
      const r = await fetch(`https://api.knock.app/v1${path}`, {
        method,
        headers: { Authorization: `Bearer ${publicKey}`, "X-Knock-User-Token": token, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await r.json().catch(() => null);
      return { status: r.status, body: json };
    },
    [publicKey, token]
  );

  const load = useCallback(async () => setFeed(await call("GET", `/users/${user.id}/feeds/${channelId}`)), [call, user.id, channelId]);
  useEffect(() => void load(), [load, actionData]);

  const mark = async (status: "seen" | "read" | "unread", ids: string[]) => {
    const r = await call("POST", `/messages/batch/${status}`, { message_ids: ids });
    setLog((l) => [`batch/${status} [${ids.length}] → ${r.status}`, ...l]);
    load();
  };

  const items: FeedItem[] = feed?.body?.entries ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 font-mono text-sm">
      <div className="rounded bg-yellow-200 p-2 font-bold text-black">⚠️ PROTOTYPE: Knock spike. Throwaway, never merge.</div>

      <section>
        <h2 className="font-bold">1. Signed user token</h2>
        <p>Current DevUI user: <b>{user.name}</b> (id {user.id}, {user.role}). Token header: {JSON.stringify(tokenHeader)}</p>
        <p>Feed request status: <b>{feed?.status ?? "…"}</b></p>
      </section>

      <section>
        <h2 className="font-bold">2–4. Actions (server, secret key)</h2>
        <Form method="post" className="flex flex-wrap gap-2">
          {["discussion-reply", "tenant-defaults", "new-enrollment", "opt-in", "opt-out", "reset-prefs"].map((i) => (
            <button key={i} name="intent" value={i} className="rounded border px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">{i}</button>
          ))}
        </Form>
        {nav.state !== "idle" && <p>…</p>}
        {actionData?.log && <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-100 p-2 dark:bg-gray-900">{actionData.log}</pre>}
      </section>

      <section>
        <h2 className="font-bold">3. Headless feed (browser, public key + user token)</h2>
        <p>unread_count: <b>{feed?.body?.meta?.unread_count ?? "?"}</b> · unseen_count: <b>{feed?.body?.meta?.unseen_count ?? "?"}</b> · total: {feed?.body?.meta?.total_count ?? "?"}</p>
        <div className="my-2 flex gap-2">
          <button className="rounded border px-2 py-1" onClick={load}>reload</button>
          <button className="rounded border px-2 py-1" onClick={() => mark("seen", items.map((i) => i.id))}>mark all seen</button>
          <button className="rounded border px-2 py-1" onClick={() => mark("read", items.map((i) => i.id))}>mark all read</button>
        </div>
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id} className={`rounded border p-2 ${i.read_at ? "opacity-50" : ""}`}>
              <b>{i.source.key}</b> from {i.actors.map((a) => a.name ?? a.id).join(", ")} · {i.inserted_at} · seen {i.seen_at ? "✓" : "✗"} read {i.read_at ? "✓" : "✗"}
              <div dangerouslySetInnerHTML={{ __html: i.blocks?.[0]?.rendered ?? "" }} />
              <div className="text-xs">data: {JSON.stringify(i.data)}</div>
              <button className="mr-2 underline" onClick={() => mark("read", [i.id])}>read</button>
              <button className="underline" onClick={() => mark("unread", [i.id])}>unread</button>
            </li>
          ))}
        </ul>
        <pre className="mt-2 whitespace-pre-wrap">{log.join("\n")}</pre>
      </section>

      <section>
        <h2 className="font-bold">4. Preferences</h2>
        <p>User default PreferenceSet (resolved for tenant "{"cadence"}"):</p>
        <pre className="whitespace-pre-wrap rounded bg-gray-100 p-2 dark:bg-gray-900">{JSON.stringify(prefs, null, 2)}</pre>
        <p>Tenant:</p>
        <pre className="whitespace-pre-wrap rounded bg-gray-100 p-2 dark:bg-gray-900">{JSON.stringify(tenant, null, 2)}</pre>
      </section>

      <details>
        <summary>raw feed response</summary>
        <pre className="whitespace-pre-wrap">{JSON.stringify(feed, null, 2)}</pre>
      </details>
    </div>
  );
}
