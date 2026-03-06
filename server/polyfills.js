// Polyfills for Node.js < 20.19 (DOMMatrix added in 20.19)
// Required by pdfjs-dist for PDF text extraction
if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {}
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    inverse() { return this; }
  };
}
if (!globalThis.ImageData) {
  globalThis.ImageData = class ImageData {};
}
if (!globalThis.Path2D) {
  globalThis.Path2D = class Path2D {};
}
