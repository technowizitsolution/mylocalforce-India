/**
 * uriToBlob
 * - Converts a file URI or data URL to a Blob
 * - Usage: const blob = await uriToBlob(imageUri)
 */
export async function uriToBlob(uri) {
  // RN fetch + blob works for both Android and iOS packager. If using Hermes, ensure global.fetch is available.
  const response = await fetch(uri);
  const blob = await response.blob();
  return blob;
}
