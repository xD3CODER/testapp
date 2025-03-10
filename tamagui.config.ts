import { config as configBase } from "@tamagui/config";
import { themes } from "@tamagui/themes";
import { createTamagui } from "tamagui";

// Enrichir la configuration de base
const config = createTamagui({
  ...configBase,
  // Vous pouvez ajouter des thèmes supplémentaires ici
  themes: {
    ...configBase.themes,
    ...themes,
  },
});

export default config;

export type Conf = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends Conf {}
}