export interface PreviewAction {
  id: number;
  action: unknown;
}

export function createPreviewMailbox() {
  let state: string | null = null;
  const actions: PreviewAction[] = [];
  let nextId = 1;

  return {
    putState(body: string) {
      state = body;
    },
    readState() {
      return state;
    },
    putAction(body: string) {
      const id = nextId;
      nextId += 1;
      actions.push({ id, action: JSON.parse(body) as unknown });
      if (actions.length > 40) actions.shift();
    },
    readActions(since: number) {
      const latest = actions.length > 0 ? actions[actions.length - 1]!.id : 0;
      const cursor = Math.max(latest, since < 0 ? 0 : since);
      if (since < 0) return { cursor: latest, actions: [] as PreviewAction[] };
      return {
        cursor,
        actions: actions.filter((item) => item.id > since),
      };
    },
  };
}
