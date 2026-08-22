export { createFsVault, VaultConflictError } from "./fs-vault.js";
export { createGitVersionControl } from "./git.js";
export { initializeVault } from "./init.js";
export { resolveVaultPath } from "./paths.js";
export { hashContent } from "./hash.js";
export { regenerateCursorIgnore, listExcludedMarkdown } from "./cursorignore.js";
export { withAiAccess, isAiExcludedMarkdown, isProtectedVaultPath } from "./access.js";
