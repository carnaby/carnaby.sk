/**
 * Task 30: set to point the whole e2e suite at an already-running external deployment (e.g. NAS
 * staging, `http://192.168.1.41:3200`, serving real production data) instead of the local dev
 * stack. Reading it here once gives every file that needs to branch on it -- `playwright.config
 * .mts`, `global-setup.ts`, and the specs themselves -- one single source of truth for the var's
 * name, instead of each re-reading `process.env['E2E_BASE_URL']` and risking a typo drifting
 * between files.
 */
export const EXTERNAL_BASE_URL = process.env['E2E_BASE_URL'];
