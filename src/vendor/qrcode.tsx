'use client';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QRCode from 'react-qr-code';

type ColorOptions = {
  dark?: string;
  light?: string;
};

type ToDataUrlOptions = {
  width?: number;
  margin?: number;
  color?: ColorOptions;
};

function svgToPngDataUrl(svgMarkup: string, width: number, margin: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const targetSize = width + margin * 2;
      canvas.width = targetSize;
      canvas.height = targetSize;

      const context = canvas.getContext('2d');

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to initialize canvas context.'));
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, targetSize, targetSize);

      context.drawImage(img, margin, margin, width, width);
      URL.revokeObjectURL(objectUrl);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = (event) => {
      URL.revokeObjectURL(objectUrl);
      reject(event instanceof ErrorEvent ? event.error : new Error('Failed to load QR SVG image.'));
    };

    img.src = objectUrl;
  });
}

async function toDataURL(text: string, options: ToDataUrlOptions = {}): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('QR code generation requires a browser environment.');
  }

  const width = options.width ?? 320;
  const margin = options.margin ?? 0;
  const dark = options.color?.dark ?? '#000000';
  const light = options.color?.light ?? '#ffffff';

  const svgElement = createElement(QRCode, {
    value: text,
    size: width,
    fgColor: dark,
    bgColor: light,
    level: 'M',
  });

  const svgMarkup = renderToStaticMarkup(svgElement);

  return svgToPngDataUrl(svgMarkup, width, margin);
}

const qrcode = {
  toDataURL,
};

export default qrcode;

export type { ToDataUrlOptions };

