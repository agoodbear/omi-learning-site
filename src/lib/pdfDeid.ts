"use client";

import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker - use local copy from public folder
if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

/**
 * Crop configuration for de-identifying ECG PDFs
 * Percentages of the image to remove from each edge
 */
export const CROP_CONFIG = {
    topCropPercent: 29,      // Remove top 29% (patient info + header)
    bottomCropPercent: 10,   // Remove bottom 10% (print date, hospital info)
    leftCropPercent: 2,      // Remove left 2% (blank margin)
    rightCropPercent: 8      // Remove right 8% (blank margin)
};

/**
 * Convert a PDF file to a de-identified image by cropping out patient info
 * @param pdfFile - The PDF file to process
 * @param pageNum - Page number to render (default: 1)
 * @param scale - Render scale for quality (default: 2.0 for high DPI)
 * @returns Blob of the cropped PNG image
 */
export async function deidentifyEcgPdf(
    pdfFile: File,
    pageNum: number = 1,
    scale: number = 2.0
): Promise<Blob> {
    // Read PDF file as ArrayBuffer
    const arrayBuffer = await pdfFile.arrayBuffer();

    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Get the specified page
    const page = await pdf.getPage(pageNum);

    // Get page dimensions
    const viewport = page.getViewport({ scale });

    // Create a canvas for rendering
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    // Render PDF page to canvas
    await page.render({
        canvasContext: ctx,
        viewport: viewport
    }).promise;

    // Calculate crop dimensions
    const topCrop = Math.floor(canvas.height * (CROP_CONFIG.topCropPercent / 100));
    const bottomCrop = Math.floor(canvas.height * (CROP_CONFIG.bottomCropPercent / 100));
    const leftCrop = Math.floor(canvas.width * (CROP_CONFIG.leftCropPercent / 100));
    const rightCrop = Math.floor(canvas.width * (CROP_CONFIG.rightCropPercent / 100));

    // New dimensions after cropping
    const newWidth = canvas.width - leftCrop - rightCrop;
    const newHeight = canvas.height - topCrop - bottomCrop;

    // Create a new canvas for the cropped image
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = newWidth;
    croppedCanvas.height = newHeight;
    const croppedCtx = croppedCanvas.getContext("2d")!;

    // Draw the cropped portion
    croppedCtx.drawImage(
        canvas,
        leftCrop,              // Source X
        topCrop,               // Source Y
        newWidth,              // Source Width
        newHeight,             // Source Height
        0,                     // Dest X
        0,                     // Dest Y
        newWidth,              // Dest Width
        newHeight              // Dest Height
    );

    // Convert to Blob
    return new Promise((resolve, reject) => {
        croppedCanvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to create image blob"));
                }
            },
            "image/png",
            0.95
        );
    });
}

/**
 * Get the total number of pages in a PDF
 * @param pdfFile - The PDF file
 * @returns Number of pages
 */
export async function getPdfPageCount(pdfFile: File): Promise<number> {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
}
