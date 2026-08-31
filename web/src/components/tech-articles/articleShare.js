export async function copyTextToClipboard(
  text,
  { navigatorObject = window.navigator, documentObject = window.document } = {},
) {
  if (typeof navigatorObject?.clipboard?.writeText === "function") {
    try {
      await navigatorObject.clipboard.writeText(text);
      return true;
    } catch {
    }
  }

  if (
    !documentObject?.body ||
    typeof documentObject.createElement !== "function" ||
    typeof documentObject.execCommand !== "function"
  ) {
    return false;
  }

  const textarea = documentObject.createElement("textarea");
  const previousFocus = documentObject.activeElement;
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";

  documentObject.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange?.(0, text.length);
    return documentObject.execCommand("copy") === true;
  } catch {
    return false;
  } finally {
    documentObject.body.removeChild(textarea);
    previousFocus?.focus?.();
  }
}

export async function shareArticle(
  { title, text, url },
  { navigatorObject = window.navigator, documentObject = window.document } = {},
) {
  if (typeof navigatorObject?.share === "function") {
    try {
      await navigatorObject.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
    }
  }

  const copied = await copyTextToClipboard(url, {
    navigatorObject,
    documentObject,
  });
  return copied ? "copied" : "failed";
}
