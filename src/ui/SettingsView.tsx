import { useState } from "react";
import { WINDOWS_TRAY_HINT } from "../domain/defaults";
import type { Settings, Tag, Theme, TimerAction, TimerState } from "../domain/types";

const NEW_TAG_COLOR = "#5C7A6E";

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (/^\d+$/.test(next)) onCommit(Number(next));
        }}
      />
    </label>
  );
}

function TagRow({
  tag,
  onAction,
}: {
  tag: Tag;
  onAction: (action: TimerAction) => void;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  return (
    <div className="tag-row">
      <input
        aria-label={`Имя ${tag.name}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        aria-label={`Цвет ${tag.name}`}
        value={color}
        spellCheck={false}
        onChange={(event) => setColor(event.target.value)}
      />
      <button
        type="button"
        onClick={() =>
          onAction({ type: "update-tag", tagId: tag.id, name })
        }
      >
        Переименовать
      </button>
      <button
        type="button"
        onClick={() =>
          onAction({
            type: "update-tag",
            tagId: tag.id,
            name: tag.name,
            color,
          })
        }
      >
        Перекрасить
      </button>
      <button
        type="button"
        onClick={() => onAction({ type: "archive-tag", tagId: tag.id })}
      >
        Убрать
      </button>
    </div>
  );
}

export function SettingsView({
  state,
  platform,
  onAction,
}: {
  state: TimerState;
  platform: string;
  onAction: (action: TimerAction) => void;
}) {
  const { settings } = state;
  const [theme, setTheme] = useState<Theme>(settings.theme);
  const [sound, setSound] = useState(settings.soundEnabled);
  const [notifications, setNotifications] = useState(settings.notificationsEnabled);
  const [launch, setLaunch] = useState(settings.launchAtLogin);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(NEW_TAG_COLOR);
  const active = state.tags.filter((tag) => tag.archived !== true);

  const patch = (settingsPatch: Partial<Settings>) => {
    onAction({ type: "update-settings", settings: settingsPatch });
  };

  return (
    <section className="card settings" aria-label="Настройки">
      <NumberField
        label="Короткий перерыв"
        value={settings.shortBreakMinutes}
        onCommit={(shortBreakMinutes) => patch({ shortBreakMinutes })}
      />
      <NumberField
        label="Длинный перерыв"
        value={settings.longBreakMinutes}
        onCommit={(longBreakMinutes) => patch({ longBreakMinutes })}
      />
      <NumberField
        label="Сессий до длинного"
        value={settings.sessionsUntilLongBreak}
        onCommit={(sessionsUntilLongBreak) => patch({ sessionsUntilLongBreak })}
      />
      <label className="field">
        <span>Тема</span>
        <select
          value={theme}
          onChange={(event) => {
            const next = event.target.value as Theme;
            setTheme(next);
            patch({ theme: next });
          }}
        >
          <option value="system">Как в системе</option>
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={sound}
          onChange={(event) => {
            setSound(event.target.checked);
            patch({ soundEnabled: event.target.checked });
          }}
        />
        Звук
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={notifications}
          onChange={(event) => {
            setNotifications(event.target.checked);
            patch({ notificationsEnabled: event.target.checked });
          }}
        />
        Уведомления
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={launch}
          onChange={(event) => {
            setLaunch(event.target.checked);
            patch({ launchAtLogin: event.target.checked });
          }}
        />
        Запуск вместе с системой
      </label>
      {active.map((tag) => (
        <TagRow key={tag.id} tag={tag} onAction={onAction} />
      ))}
      <div className="tag-row">
        <input
          aria-label="Новый тег"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <input
          aria-label="Цвет нового тега"
          value={newColor}
          spellCheck={false}
          onChange={(event) => setNewColor(event.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            const name = newName.trim();
            if (!name) return;
            onAction({ type: "create-tag", name, color: newColor });
            setNewName("");
          }}
        >
          Добавить
        </button>
      </div>
      {platform === "windows" ? <p className="hint">{WINDOWS_TRAY_HINT}</p> : null}
    </section>
  );
}
