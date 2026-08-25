export { createFsVault, VaultConflictError } from "./fs-vault.js";
export { createGitVersionControl } from "./git.js";
export { initializeVault } from "./init.js";
export { resolveVaultPath } from "./paths.js";
export { hashContent } from "./hash.js";
export { regenerateCursorIgnore, listExcludedMarkdown } from "./cursorignore.js";
export { withAiAccess, isAiExcludedMarkdown, isProtectedVaultPath } from "./access.js";
export {
  assertAssetPath,
  assetContentType,
  buildNoteAssetPath,
  buildUploadAssetPath,
  cleanupUploadAssets,
  isAllowedAssetMime,
  promoteUploadAsset,
  readVaultAsset,
  VAULT_ASSET_MAX_BYTES,
  VAULT_UPLOAD_DEFAULT_MAX_AGE_DAYS,
  writeVaultAsset,
  type CleanupUploadsOptions,
  type CleanupUploadsResult,
} from "./assets.js";
