export function isFramed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function porchUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function handOffPorch(url: string): Promise<"shared" | "copied" | "blocked"> {
  const framed = isFramed();
  if (!framed && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Christman Sound",
        text: "The body. Lucent sees. Corti measures. OpenSmell sniffs. Skin sits.",
        url,
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "blocked";
    }
  }
  const copied = await copyText(url);
  return copied ? "copied" : "blocked";
}
