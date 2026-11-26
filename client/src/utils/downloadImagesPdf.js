import { jsPDF } from 'jspdf';

const loadImageFromUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = objectUrl;
    if (img.decode) {
      await img.decode();
    } else {
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
    }
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const imageToJpegDataUrl = (img) => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
};

export const downloadImagesAsPdf = async (files, baseName = 'paper-images') => {
  const imageFiles = (files || []).filter((f) => f?.type && f.type.startsWith('image/') && f?.url);
  if (!imageFiles.length) {
    throw new Error('No image files found for this paper.');
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;

  for (let i = 0; i < imageFiles.length; i += 1) {
    if (i > 0) pdf.addPage();

    const img = await loadImageFromUrl(imageFiles[i].url);
    const jpegData = imageToJpegDataUrl(img);

    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;
    const scale = Math.min((pageWidth - margin * 2) / imgWidth, (pageHeight - margin * 2) / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;

    pdf.addImage(jpegData, 'JPEG', x, y, drawWidth, drawHeight, undefined, 'FAST');
  }

  pdf.save(`${baseName}.pdf`);
};
