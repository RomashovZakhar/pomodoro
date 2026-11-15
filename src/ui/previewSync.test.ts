import { describe, expect, it, vi } from "vitest";
import { createPreviewMailbox, startPreviewActionPump } from "./previewSync";

describe("preview mailbox", () => {
  it("keeps the latest timer snapshot", () => {
    const mailbox = createPreviewMailbox();
    expect(mailbox.readState()).toBeNull();
    mailbox.putState('{"now":1}');
    mailbox.putState('{"now":2}');
    expect(mailbox.readState()).toBe('{"now":2}');
  });

  it("does not replay actions that were posted before a listener attached", () => {
    const mailbox = createPreviewMailbox();
    mailbox.putAction('{"type":"start"}');
    const first = mailbox.readActions(-1);
    expect(first.actions).toEqual([]);
    expect(first.cursor).toBe(1);

    mailbox.putAction('{"type":"pause"}');
    expect(mailbox.readActions(first.cursor)).toEqual({
      cursor: 2,
      actions: [{ id: 2, action: { type: "pause" } }],
    });
  });
});

describe("preview action pump", () => {
  it("forwards only actions that arrive after it starts", async () => {
    const seen: unknown[] = [];
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const since = new URL(String(input), "http://localhost").searchParams.get("since") ?? "0";
      calls.push(since);
      const body =
        since === "-1"
          ? { cursor: 4, actions: [] }
          : since === "4"
            ? { cursor: 5, actions: [{ id: 5, action: { type: "start" } }] }
            : { cursor: 5, actions: [] };
      return new Response(JSON.stringify(body), { status: 200 });
    });

    const stop = startPreviewActionPump((action) => seen.push(action), {
      fetchImpl,
      intervalMs: 0,
    });
    await vi.waitFor(() => expect(seen).toEqual([{ type: "start" }]));
    stop();
    expect(calls[0]).toBe("-1");
    expect(calls).toContain("4");
  });
});
