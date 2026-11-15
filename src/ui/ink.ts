const DARK = "#14161c";
const LIGHT = "#f7f6f3";

function channel(hex: string, index: number): number {
  return parseInt(hex.slice(index, index + 2), 16) / 255;
}

function linear(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrast(lighter: number, darker: number): number {
  return (lighter + 0.05) / (darker + 0.05);
}

export function inkFor(color: string): typeof DARK | typeof LIGHT {
  const hex = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return LIGHT;
  const luminance =
    0.2126 * linear(channel(hex, 0)) +
    0.7152 * linear(channel(hex, 2)) +
    0.0722 * linear(channel(hex, 4));
  const dark = 0.007;
  const light = 0.96;
  const onDark = contrast(Math.max(luminance, dark), Math.min(luminance, dark));
  const onLight = contrast(Math.max(luminance, light), Math.min(luminance, light));
  return onDark >= onLight ? DARK : LIGHT;
}
