import { copyTextToClipboard, shareArticle } from "./articleShare";

function fallbackDocument(copyResult = true) {
  const previousFocus = { focus: jest.fn() };
  const textarea = {
    focus: jest.fn(),
    select: jest.fn(),
    setAttribute: jest.fn(),
    setSelectionRange: jest.fn(),
    style: {},
    value: "",
  };
  const body = {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  };
  const documentObject = {
    activeElement: previousFocus,
    body,
    createElement: jest.fn(() => textarea),
    execCommand: jest.fn(() => copyResult),
  };
  return { body, documentObject, previousFocus, textarea };
}

describe("아티클 공유", () => {
  test("Web Share API가 성공하면 공유 결과를 반환한다", async () => {
    const navigatorObject = { share: jest.fn().mockResolvedValue(undefined) };

    await expect(
      shareArticle(
        { title: "제목", text: "요약", url: "https://example.com/article" },
        { navigatorObject },
      ),
    ).resolves.toBe("shared");
    expect(navigatorObject.share).toHaveBeenCalledWith({
      title: "제목",
      text: "요약",
      url: "https://example.com/article",
    });
  });

  test("사용자가 공유를 취소하면 복사 오류로 처리하지 않는다", async () => {
    const error = new Error("cancelled");
    error.name = "AbortError";
    const navigatorObject = {
      clipboard: { writeText: jest.fn() },
      share: jest.fn().mockRejectedValue(error),
    };

    await expect(
      shareArticle(
        { title: "제목", text: "요약", url: "https://example.com/article" },
        { navigatorObject },
      ),
    ).resolves.toBe("cancelled");
    expect(navigatorObject.clipboard.writeText).not.toHaveBeenCalled();
  });

  test("Web Share API가 실패하면 주소 복사로 전환한다", async () => {
    const navigatorObject = {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
      share: jest.fn().mockRejectedValue(new Error("share failed")),
    };

    await expect(
      shareArticle(
        { title: "제목", text: "요약", url: "https://example.com/article" },
        { navigatorObject },
      ),
    ).resolves.toBe("copied");
    expect(navigatorObject.clipboard.writeText).toHaveBeenCalledWith(
      "https://example.com/article",
    );
  });

  test("Clipboard API가 없는 HTTP 환경에서는 textarea fallback을 사용한다", async () => {
    const { body, documentObject, previousFocus, textarea } =
      fallbackDocument();

    await expect(
      copyTextToClipboard("http://example.com/article", {
        navigatorObject: {},
        documentObject,
      }),
    ).resolves.toBe(true);
    expect(textarea.value).toBe("http://example.com/article");
    expect(textarea.select).toHaveBeenCalled();
    expect(documentObject.execCommand).toHaveBeenCalledWith("copy");
    expect(body.removeChild).toHaveBeenCalledWith(textarea);
    expect(previousFocus.focus).toHaveBeenCalled();
  });

  test("Clipboard API가 거부되어도 textarea fallback을 사용한다", async () => {
    const { documentObject } = fallbackDocument();
    const navigatorObject = {
      clipboard: {
        writeText: jest.fn().mockRejectedValue(new Error("denied")),
      },
    };

    await expect(
      copyTextToClipboard("http://example.com/article", {
        navigatorObject,
        documentObject,
      }),
    ).resolves.toBe(true);
    expect(documentObject.execCommand).toHaveBeenCalledWith("copy");
  });

  test("모든 복사 방식이 실패하면 실패 결과를 반환한다", async () => {
    const { documentObject } = fallbackDocument(false);

    await expect(
      shareArticle(
        { title: "제목", text: "요약", url: "http://example.com/article" },
        { navigatorObject: {}, documentObject },
      ),
    ).resolves.toBe("failed");
  });
});
