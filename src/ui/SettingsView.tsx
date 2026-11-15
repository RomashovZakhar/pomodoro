import { useState } from "react";
import { createPortal } from "react-dom";
import { WINDOWS_TRAY_HINT } from "../domain/defaults";
import {
  FOCUS_MINUTE_MAX,
  FOCUS_MINUTE_MIN,
  type Settings,
  type Tag,
  type Theme,
  type TimerAction,
  type TimerState,
} from "../domain/types";
import { MinuteRuler } from "./MinuteRuler";

export const TAG_PALETTE = [
  "#E07A4C",
  "#E0A24C",
  "#D4C06A",
  "#E38B6A",
  "#C46A6A",
  "#C9A06A",
  "#A3B07A",
  "#6E9A84",
  "#6A90A8",
  "#8A7EAE",
  "#C47A90",
  "#D4896A",
] as const;

type RulerRequest = {
  label: string;
  caption: string;
  min: number;
  max: number;
  minutes: number;
  onCommit: (minutes: number) => void;
};

function colorsFor(current: string): string[] {
  const known = TAG_PALETTE.some((color) => color.toLowerCase() === current.toLowerCase());
  return known ? [...TAG_PALETTE] : [current, ...TAG_PALETTE];
}

function unusedColor(tags: Tag[]): string {
  const used = new Set(tags.map((tag) => tag.color.toLowerCase()));
  return TAG_PALETTE.find((color) => !used.has(color.toLowerCase())) ?? TAG_PALETTE[0];
}

function Palette({
  name,
  value,
  onPick,
}: {
  name: string;
  value: string;
  onPick: (color: string) => void;
}) {
  return (
    <div className="palette" role="group" aria-label={`Цвет ${name}`}>
      {colorsFor(value).map((color) => (
        <button
          key={color}
          type="button"
          className="swatch-pick"
          aria-label={`Цвет ${name} ${color}`}
          aria-pressed={color.toLowerCase() === value.toLowerCase()}
          style={{ background: color }}
          onClick={() => onPick(color)}
        />
      ))}
    </div>
  );
}

function TagCard({
  tag,
  onAction,
  onRuler,
}: {
  tag: Tag;
  onAction: (action: TimerAction) => void;
  onRuler: (request: RulerRequest) => void;
}) {
  const [name, setName] = useState(tag.name);

  const commitName = () => {
    const next = name.trim() || tag.name;
    if (next === tag.name) {
      setName(tag.name);
      return;
    }
    setName(next);
    onAction({ type: "update-tag", tagId: tag.id, name: next });
  };

  return (
    <article className="tag-card">
      <div className="tag-card-head">
        <input
          className="tag-name"
          aria-label={`Имя ${tag.name}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <button
          type="button"
          className="tag-minutes"
          aria-label={`Длина ${tag.name}`}
          onClick={() =>
            onRuler({
              label: `Длина ${tag.name}`,
              caption: name.trim() || tag.name,
              min: FOCUS_MINUTE_MIN,
              max: FOCUS_MINUTE_MAX,
              minutes: tag.focusMinutes,
              onCommit: (focusMinutes) =>
                onAction({
                  type: "update-tag",
                  tagId: tag.id,
                  name: name.trim() || tag.name,
                  focusMinutes,
                }),
            })
          }
        >
          {tag.focusMinutes} мин
        </button>
        <button
          type="button"
          className="quiet"
          onClick={() => onAction({ type: "archive-tag", tagId: tag.id })}
        >
          Убрать
        </button>
      </div>
      <Palette
        name={tag.name}
        value={tag.color}
        onPick={(color) =>
          onAction({
            type: "update-tag",
            tagId: tag.id,
            name: name.trim() || tag.name,
            color,
          })
        }
      />
    </article>
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
  const active = state.tags.filter((tag) => tag.archived !== true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(() => unusedColor(active));
  const [newMinutes, setNewMinutes] = useState(25);
  const [ruler, setRuler] = useState<RulerRequest | null>(null);

  const patch = (settingsPatch: Partial<Settings>) => {
    onAction({ type: "update-settings", settings: settingsPatch });
  };

  const openBreak = (
    label: string,
    caption: string,
    minutes: number,
    min: number,
    max: number,
    key: "shortBreakMinutes" | "longBreakMinutes" | "sessionsUntilLongBreak",
  ) => {
    setRuler({
      label,
      caption,
      minutes,
      min,
      max,
      onCommit: (next) => patch({ [key]: next }),
    });
  };

  return (
    <section className="settings" aria-label="Настройки">
      <header className="screen-head">
        <div>
          <h1>Настройки</h1>
          <p className="hint">Длина помидора меняется нажатием на время.</p>
        </div>
      </header>
      <h2>Перерывы</h2>
      <div className="value-row">
        <button
          type="button"
          className="value-choice"
          aria-label="Короткий перерыв"
          onClick={() =>
            openBreak("Короткий перерыв", "Минуты короткого перерыва", settings.shortBreakMinutes, 1, 30, "shortBreakMinutes")
          }
        >
          <span>Короткий</span>
          <strong>{settings.shortBreakMinutes} мин</strong>
        </button>
        <button
          type="button"
          className="value-choice"
          aria-label="Длинный перерыв"
          onClick={() =>
            openBreak("Длинный перерыв", "Минуты длинного перерыва", settings.longBreakMinutes, 1, 60, "longBreakMinutes")
          }
        >
          <span>Длинный</span>
          <strong>{settings.longBreakMinutes} мин</strong>
        </button>
        <button
          type="button"
          className="value-choice"
          aria-label="Сессий до длинного"
          onClick={() =>
            openBreak(
              "Сессий до длинного",
              "Сколько сессий до длинного перерыва",
              settings.sessionsUntilLongBreak,
              1,
              10,
              "sessionsUntilLongBreak",
            )
          }
        >
          <span>Сессий</span>
          <strong>{settings.sessionsUntilLongBreak}</strong>
        </button>
      </div>
      <h2>Тема</h2>
      <div className="segment" role="group" aria-label="Тема">
        {(
          [
            ["system", "Система"],
            ["light", "Светлая"],
            ["dark", "Тёмная"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => {
              setTheme(value);
              patch({ theme: value });
            }}
          >
            {text}
          </button>
        ))}
      </div>
      <h2>Сигналы</h2>
      <div className="group">
        <Toggle
          label="Звук"
          checked={sound}
          onChange={(next) => {
            setSound(next);
            patch({ soundEnabled: next });
          }}
        />
        <Toggle
          label="Уведомления"
          checked={notifications}
          onChange={(next) => {
            setNotifications(next);
            patch({ notificationsEnabled: next });
          }}
        />
        <Toggle
          label="Запуск вместе с системой"
          checked={launch}
          onChange={(next) => {
            setLaunch(next);
            patch({ launchAtLogin: next });
          }}
        />
      </div>
      <h2>Теги</h2>
      {active.map((tag) => (
        <TagCard key={tag.id} tag={tag} onAction={onAction} onRuler={setRuler} />
      ))}
      <article className="tag-card">
        <div className="tag-card-head">
          <input
            className="tag-name"
            aria-label="Новый тег"
            placeholder="Новый тег"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button
            type="button"
            className="tag-minutes"
            aria-label="Длина нового тега"
            onClick={() =>
              setRuler({
                label: "Длина нового тега",
                caption: newName.trim() || "Новый тег",
                min: FOCUS_MINUTE_MIN,
                max: FOCUS_MINUTE_MAX,
                minutes: newMinutes,
                onCommit: setNewMinutes,
              })
            }
          >
            {newMinutes} мин
          </button>
        </div>
        <Palette name="новый" value={newColor} onPick={setNewColor} />
        <button
          type="button"
          className="primary"
          onClick={() => {
            const name = newName.trim();
            if (!name) return;
            onAction({
              type: "create-tag",
              name,
              color: newColor,
              focusMinutes: newMinutes,
            });
            setNewName("");
            setNewColor(unusedColor([...active, { id: "draft", name, color: newColor, focusMinutes: newMinutes }]));
          }}
        >
          Добавить
        </button>
      </article>
      {platform === "windows" ? <p className="hint">{WINDOWS_TRAY_HINT}</p> : null}
      {ruler
        ? createPortal(
            <MinuteRuler
              minutes={ruler.minutes}
              min={ruler.min}
              max={ruler.max}
              label={ruler.label}
              caption={ruler.caption}
              onCancel={() => setRuler(null)}
              onCommit={(minutes) => {
                ruler.onCommit(minutes);
                setRuler(null);
              }}
            />,
            document.body,
          )
        : null}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="switch-row"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}
