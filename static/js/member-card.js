(() => {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const bankingCardSize = { width: 340, height: 539 };

  const memberCodeFromId = (value) =>
    String(value || "").replace(/\D/g, "") || "10012030";

  const fallbackAvatarPath = (seed) => {
    const hash = [...String(seed || "10012030")].reduce(
      (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
      0,
    );
    return `/static/images/avatars/avatar-${(hash % 6) + 1}.png`;
  };

  const fallbackBarcode = (svg, value) => {
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 180 44");
    svg.setAttribute("preserveAspectRatio", "none");
    const bits = [...value].flatMap((character, index) => {
      const number = Number(character) + index * 3 + 5;
      return Array.from({ length: 7 }, (_, bit) => (number >> bit % 4) & 1);
    });
    const barWidth = 172 / (bits.length + 10);
    let x = 4;
    [1, 1, 1, ...bits, 1, 1, 1].forEach((bit, index) => {
      if (bit) {
        const rect = document.createElementNS(svgNamespace, "rect");
        rect.setAttribute("x", String(x));
        rect.setAttribute(
          "y",
          index < 3 || index > bits.length + 2 ? "1" : "3",
        );
        rect.setAttribute("width", String(barWidth));
        rect.setAttribute(
          "height",
          index < 3 || index > bits.length + 2 ? "42" : "38",
        );
        rect.setAttribute("fill", "#1e1b18");
        svg.append(rect);
      }
      x += barWidth;
    });
  };

  const renderImage = (image, placeholder, source) => {
    if (!source) return;
    image.addEventListener(
      "load",
      () => {
        image.hidden = false;
        placeholder?.setAttribute("hidden", "");
      },
      { once: true },
    );
    image.addEventListener(
      "error",
      () => {
        image.hidden = true;
        placeholder?.removeAttribute("hidden");
      },
      { once: true },
    );
    image.src = source;
  };

  const exportCardCanvas = async (card) => {
    const staging = document.createElement("div");
    const copy = card.cloneNode(true);
    staging.setAttribute("aria-hidden", "true");
    staging.style.cssText = `position:fixed;left:-10000px;top:0;width:${bankingCardSize.width}px;height:${bankingCardSize.height}px;overflow:hidden;pointer-events:none;`;
    copy.style.cssText = `width:${bankingCardSize.width}px;max-width:none;height:${bankingCardSize.height}px;min-height:${bankingCardSize.height}px;aspect-ratio:53.98 / 85.60;`;
    staging.append(copy);
    document.body.append(staging);
    try {
      return await window.html2canvas(copy, {
        backgroundColor: null,
        scale: 2,
        width: bankingCardSize.width,
        height: bankingCardSize.height,
        windowWidth: bankingCardSize.width,
        windowHeight: bankingCardSize.height,
        useCORS: true,
      });
    } finally {
      staging.remove();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const windowElement = document.querySelector(".profile-header-window");
    const card = document.getElementById("memberCard");
    if (!windowElement || !card) return;

    const code = memberCodeFromId(windowElement.dataset.memberId);
    const codeLabel = document.getElementById("memberCode");
    const barcode = document.getElementById("memberBarcode");
    codeLabel.textContent = code;

    try {
      if (typeof window.JsBarcode === "function") {
        window.JsBarcode(barcode, code, {
          format: "CODE128",
          lineColor: "#1e1b18",
          background: "#f5e6c8",
          width: 1.35,
          height: 40,
          displayValue: false,
          margin: 2,
        });
      } else {
        fallbackBarcode(barcode, code);
      }
    } catch (_error) {
      fallbackBarcode(barcode, code);
    }

    const photo = document.getElementById("memberCardPhoto");
    const photoPlaceholder = document.getElementById(
      "memberCardPhotoPlaceholder",
    );
    const signature = document.getElementById("memberCardSignature");
    renderImage(
      photo,
      photoPlaceholder,
      windowElement.dataset.memberPhoto || fallbackAvatarPath(code),
    );
    renderImage(signature, null, windowElement.dataset.memberSignature);

    document.addEventListener("sonary:profile-saved", (event) => {
      if (event.detail.avatar_url)
        renderImage(photo, photoPlaceholder, event.detail.avatar_url);
    });

    document.querySelectorAll("[data-member-export]").forEach((button) => {
      button.addEventListener("click", async () => {
        const format = button.dataset.memberExport;
        if (typeof window.html2canvas !== "function") {
          window.SonaryUI?.notify(
            "Экспорт пока недоступен: не загрузился модуль изображения.",
            "error",
          );
          return;
        }
        const originalText = button.innerHTML;
        button.disabled = true;
        button.textContent = "Подготовка…";
        try {
          const canvas = await exportCardCanvas(card);
          const link = document.createElement("a");
          link.download = `sonary-card-${code}.${format}`;
          link.href = canvas.toDataURL(
            format === "jpeg" ? "image/jpeg" : "image/png",
            0.95,
          );
          link.click();
        } catch (_error) {
          window.SonaryUI?.notify(
            "Не удалось подготовить изображение карты.",
            "error",
          );
        } finally {
          button.disabled = false;
          button.innerHTML = originalText;
        }
      });
    });
  });
})();
