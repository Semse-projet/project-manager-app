import { useColorScheme } from "react-native";
import {
  darkColors,
  lightColors,
  spacing,
  radius,
  fontFamily,
  fontSize,
  fontWeight,
  type ColorPalette,
} from "@semse/design-tokens";

export type Theme = {
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
};

function buildTheme(colors: ColorPalette): Theme {
  return { colors, spacing, radius, fontFamily, fontSize, fontWeight };
}

export const darkTheme = buildTheme(darkColors);
export const lightTheme = buildTheme(lightColors);

/** Follows the OS color scheme, same as apps/web's `[data-theme]` split in globals.css. Defaults to dark when the OS preference is unavailable, matching the web app's default. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "light" ? lightTheme : darkTheme;
}
