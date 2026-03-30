"use client";

import { useEffect, useState } from "react";

export type PdfPreviewPage = {
  pageNumber: number;
  width: number;
  height: number;
  imageUrl: string;
};

export function usePdfPreview(documentUrl: string) {
  const [pages, setPages] = useState<PdfPreviewPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(documentUrl, {
          credentials: "include"
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error?.trim() || "The PDF preview could not be loaded.");
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await import("pdfjs-dist/webpack.mjs");

        const pdfDocument = await pdfjs.getDocument({
          data: bytes
        }).promise;

        const nextPages: PdfPreviewPage[] = [];

        for (let index = 0; index < pdfDocument.numPages; index += 1) {
          const page = await pdfDocument.getPage(index + 1);
          const viewport = page.getViewport({ scale: 1.2 });
          const targetCanvas = window.document.createElement("canvas");
          const context = targetCanvas.getContext("2d");

          if (!context) {
            throw new Error("The PDF preview canvas could not be created.");
          }

          targetCanvas.width = viewport.width;
          targetCanvas.height = viewport.height;

          await page.render({
            canvas: targetCanvas,
            canvasContext: context,
            viewport
          }).promise;

          nextPages.push({
            pageNumber: index + 1,
            width: viewport.width,
            height: viewport.height,
            imageUrl: targetCanvas.toDataURL("image/png")
          });
        }

        if (!active) {
          return;
        }

        setPages(nextPages);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "The PDF preview could not be loaded.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [documentUrl]);

  return {
    pages,
    isLoading,
    error
  };
}
