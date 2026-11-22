// Where everything lives. One place, so a setting like NARRATED_WALKTHROUGH_HOME moves all of it.
//
//   SKILL           this skill's folder (scripts, built-in themes, examples)
//   HOME            per-machine data: NARRATED_WALKTHROUGH_HOME, default ~/.local/share/narrated-walkthrough
//   VENV            Python virtualenv with reverb-tts: NARRATED_WALKTHROUGH_VENV, default HOME/venv
//   NODE_DIR        Playwright install                HOME/node
//   VOICES_DIR      recorded voices                   HOME/voices
//   THEMES_DIR      machine themes                    HOME/themes
//   MACHINE_CONFIG  machine defaults and theme rules  HOME/config.json
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const HOME = process.env.NARRATED_WALKTHROUGH_HOME || path.join(os.homedir(), '.local/share/narrated-walkthrough');
export const VENV = process.env.NARRATED_WALKTHROUGH_VENV || path.join(HOME, 'venv');
export const NODE_DIR = path.join(HOME, 'node');
export const VOICES_DIR = path.join(HOME, 'voices');
export const THEMES_DIR = path.join(HOME, 'themes');
export const MACHINE_CONFIG = path.join(HOME, 'config.json');
export const SETUP = path.join(SKILL, 'scripts/setup.sh');

/** Names of themes and recorded voices: they become folder and file names. */
export const NAME = /^[\w-]+$/;

/** A mistake in a spec, config or theme file: the build prints its message and exits 2. */
export class ConfigError extends Error {
  exitCode = 2;
}

/** Parse a JSON file, or return null if it doesn't exist. A file that exists but isn't JSON is an error. */
export function readJson(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${file} isn't valid JSON: ${e.message}`);
  }
}

let machine;
/** The machine config ({ voice, theme, themes }), read once. */
export const machineConfig = () => (machine ??= readJson(MACHINE_CONFIG) ?? {});
