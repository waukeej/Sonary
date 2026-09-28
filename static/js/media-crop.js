(() => {
  const size = 720;
  const previewSize = 900;
  const previewInset = (previewSize - size) / 2;
  let activeInput;
  let image;
  let sourceUrl;
  let mode = "cover";
  let zoom = 1;
  let rotation = 0;
  let offsetX = 0;
  let offsetY = 0;
  let dragging;

  const modal = () => document.getElementById("mediaCropModal");
  const canvas = () => document.getElementById("mediaCropCanvas");
  const zoomControl = () => document.getElementById("mediaCropZoom");

  const dimensions = () => {
    const quarterTurn = Math.abs(rotation % 180) === 90;
    return quarterTurn
      ? { width: image.height, height: image.width }
      : { width: image.width, height: image.height };
  };

  const baseScale = () => {
    const { width, height } = dimensions();
    return Math.max(size / width, size / height);
  };

  const limitOffset = () => {
    const { width, height } = dimensions();
    const scale = baseScale() * zoom;
    const maxX = Math.max(0, (width * scale - size) / 2);
    const maxY = Math.max(0, (height * scale - size) / 2);
    offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
    offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
  };

  const paintImage = (context, center, opacity = 1) => {
    context.save();
    context.globalAlpha = opacity;
    context.translate(center + offsetX, center + offsetY);
    context.rotate((rotation * Math.PI) / 180);
    const scale = baseScale() * zoom;
    context.drawImage(
      image,
      -(image.width * scale) / 2,
      -(image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
    context.restore();
  };

  const cropPath = (context, center) => {
    context.beginPath();
    if (mode === "avatar")
      context.arc(center, center, size / 2, 0, Math.PI * 2);
    else context.rect(center - size / 2, center - size / 2, size, size);
  };

  const draw = () => {
    if (!image) return;
    limitOffset();
    const target = canvas();
    const context = target.getContext("2d");
    context.clearRect(0, 0, previewSize, previewSize);
    paintImage(context, previewSize / 2, 0.24);
    context.save();
    cropPath(context, previewSize / 2);
    context.clip();
    paintImage(context, previewSize / 2);
    context.restore();
    context.save();
    cropPath(context, previewSize / 2);
    context.strokeStyle = "#ff9f43";
    context.lineWidth = 3;
    context.stroke();
    context.restore();
  };

  const exportCanvas = () => {
    const output = document.createElement("canvas");
    output.width = size;
    output.height = size;
    const context = output.getContext("2d");
    if (mode === "avatar") {
      cropPath(context, size / 2);
      context.clip();
    }
    paintImage(context, size / 2);
    return output;
  };

  const close = (clearInput = false) => {
    if (clearInput && activeInput) activeInput.value = "";
    dragging = null;
    window.SonaryModal?.close(modal(), () =>
      document.body.classList.remove("media-crop-open"),
    );
  };

  const open = (input, file) => {
    activeInput = input;
    mode = input.dataset.mediaCrop === "avatar" ? "avatar" : "cover";
    const rejectAvatar = (message) => {
      input.value = "";
      window.SonaryProfile?.showErrors(input.closest("form"), {
        avatar: message,
      });
    };
    if (mode === "avatar" && file.size > 5 * 1024 * 1024) {
      rejectAvatar("Аватарка должна быть не больше 5 МБ.");
      return;
    }
    zoom = 1;
    rotation = 0;
    offsetX = 0;
    offsetY = 0;
    zoomControl().value = "100";
    modal().dataset.cropMode = mode;
    sourceUrl && URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    image = new Image();
    image.onload = () => {
      if (mode === "avatar" && image.width * image.height > 16000000) {
        rejectAvatar(
          "Выберите изображение PNG, JPEG или WebP до 16 мегапикселей.",
        );
        return;
      }
      draw();
      document.body.classList.add("media-crop-open");
      window.SonaryModal?.open(modal());
    };
    image.onerror = () => {
      if (mode === "avatar")
        rejectAvatar("Не удалось прочитать изображение аватарки.");
    };
    image.src = sourceUrl;
  };

  const previewTargets = (input) =>
    document.querySelectorAll(
      `[data-media-preview="${input.name}"] img, img[data-media-preview="${input.name}"]`,
    );

  const apply = () => {
    if (!activeInput || !image) return;
    exportCanvas().toBlob((blob) => {
      if (!blob) return;
      const file = new File(
        [blob],
        `${activeInput.name || "image"}-cropped.png`,
        { type: "image/png" },
      );
      const transfer = new DataTransfer();
      transfer.items.add(file);
      activeInput.files = transfer.files;
      const previewUrl = URL.createObjectURL(file);
      previewTargets(activeInput).forEach((preview) => {
        preview.src = previewUrl;
        preview.hidden = false;
      });
      activeInput.dispatchEvent(
        new CustomEvent("sonary:media-cropped", {
          bubbles: true,
          detail: { file, previewUrl, mode },
        }),
      );
      close();
    }, "image/png");
  };

  document.addEventListener("DOMContentLoaded", () => {
    const cropModal = modal();
    const cropCanvas = canvas();
    if (!cropModal || !cropCanvas) return;

    document.addEventListener("change", (event) => {
      const input = event.target.closest('input[type="file"][data-media-crop]');
      const file = input?.files?.[0];
      if (file) open(input, file);
    });

    zoomControl().addEventListener("input", () => {
      zoom = Number(zoomControl().value) / 100;
      draw();
    });
    cropModal
      .querySelector("[data-media-crop-rotate]")
      .addEventListener("click", () => {
        rotation = (rotation + 90) % 360;
        offsetX = 0;
        offsetY = 0;
        draw();
      });
    cropModal
      .querySelector("[data-media-crop-apply]")
      .addEventListener("click", apply);
    cropModal
      .querySelectorAll("[data-media-crop-cancel]")
      .forEach((button) => button.addEventListener("click", () => close(true)));
    cropModal.addEventListener("click", (event) => {
      if (event.target === cropModal) close(true);
    });
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && !cropModal.hidden) {
          event.preventDefault();
          event.stopImmediatePropagation();
          close(true);
        }
      },
      true,
    );

    cropCanvas.addEventListener("pointerdown", (event) => {
      const rect = cropCanvas.getBoundingClientRect();
      dragging = {
        x: event.clientX,
        y: event.clientY,
        scaleX: previewSize / rect.width,
        scaleY: previewSize / rect.height,
      };
      cropCanvas.setPointerCapture(event.pointerId);
    });
    cropCanvas.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      offsetX += (event.clientX - dragging.x) * dragging.scaleX;
      offsetY += (event.clientY - dragging.y) * dragging.scaleY;
      dragging.x = event.clientX;
      dragging.y = event.clientY;
      draw();
    });
    const stopDrag = () => {
      dragging = null;
    };
    cropCanvas.addEventListener("pointerup", stopDrag);
    cropCanvas.addEventListener("pointercancel", stopDrag);
  });
})();
