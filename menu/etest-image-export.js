(function () {
  "use strict";

  const IS_TEST = globalThis.__EE_TEST__ === true;
  const IMAGE_WIDTH = 1400;
  const IMAGE_PADDING = 64;
  const IMAGE_LINE_HEIGHT = 34;
  const MAX_IMAGE_HEIGHT = 16384;

  function wrapTextForImage(context, text, maxWidth) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .flatMap((line) => {
        const words = line.trim().split(/\s+/).filter(Boolean);
        if (!words.length) return [""];
        const wrapped = [];
        let current = "";
        words.forEach((word) => {
          const next = current ? `${current} ${word}` : word;
          if (context.measureText(next).width > maxWidth && current) {
            wrapped.push(current);
            current = word;
          } else {
            current = next;
          }
        });
        if (current) wrapped.push(current);
        return wrapped;
      });
  }

  function getMessage(key, fallback) {
    return window.eeI18n?.msg(key) || fallback;
  }

  function drawTextImage(text) {
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_WIDTH;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    context.font = "22px system-ui, sans-serif";
    const lines = wrapTextForImage(context, text, IMAGE_WIDTH - IMAGE_PADDING * 2);
    const height = Math.max(240, IMAGE_PADDING * 2 + lines.length * IMAGE_LINE_HEIGHT);
    if (height > MAX_IMAGE_HEIGHT) throw new RangeError("Image is too tall");
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#1d2730";
    context.font = "22px system-ui, sans-serif";
    context.textBaseline = "top";
    lines.forEach((line, index) => {
      context.fillText(line, IMAGE_PADDING, IMAGE_PADDING + index * IMAGE_LINE_HEIGHT);
    });
    return canvas;
  }

  function downloadCanvas(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Image export failed"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "edupage-test.png";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      }, "image/png");
    });
  }

  function init() {
    const input = document.getElementById("EtestImageExportInput");
    const button = document.getElementById("EtestImageExportButton");
    const status = document.getElementById("EtestImageExportStatus");
    if (!input || !button || !status) return;

    const setStatus = (message, isError = false) => {
      status.textContent = message;
      status.classList.toggle("is-error", isError);
    };

    button.addEventListener("click", () => {
      const text = input.value.trim();
      if (!text) {
        setStatus(getMessage("etestImageExportEmpty", "Paste some test text first."), true);
        input.focus();
        return;
      }
      button.disabled = true;
      setStatus("");
      try {
        const canvas = drawTextImage(text);
        downloadCanvas(canvas)
          .then(() => setStatus(getMessage("etestImageExportReady", "Image downloaded.")))
          .catch(() => setStatus(getMessage("etestImageExportFailed", "Could not create the image."), true))
          .finally(() => { button.disabled = false; });
      } catch (error) {
        const message = error instanceof RangeError
          ? getMessage("etestImageExportTooLong", "This text is too long for one image.")
          : getMessage("etestImageExportFailed", "Could not create the image.");
        setStatus(message, true);
        button.disabled = false;
      }
    });
  }

  if (IS_TEST) {
    globalThis.__eeTestExports = { wrapTextForImage };
    return;
  }

  init();
})();
