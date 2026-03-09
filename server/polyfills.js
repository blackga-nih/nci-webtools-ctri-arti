// Polyfills for pdfjs-dist on Node 20 (needs DOMMatrix, ImageData, Path2D)
// These are stubs sufficient for server-side text extraction — no actual rendering.

if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      const v = Array.isArray(init) ? init : [1, 0, 0, 1, 0, 0];
      this.a = v[0];
      this.b = v[1];
      this.c = v[2];
      this.d = v[3];
      this.e = v[4];
      this.f = v[5];
      this.m11 = v[0];
      this.m12 = v[1];
      this.m21 = v[2];
      this.m22 = v[3];
      this.m41 = v[4];
      this.m42 = v[5];
      this.m13 = 0;
      this.m14 = 0;
      this.m23 = 0;
      this.m24 = 0;
      this.m31 = 0;
      this.m32 = 0;
      this.m33 = 1;
      this.m34 = 0;
      this.m43 = 0;
      this.m44 = 1;
      this.is2D = true;
      this.isIdentity = false;
    }
    inverse() {
      return new DOMMatrix();
    }
    multiply() {
      return new DOMMatrix();
    }
    translate() {
      return new DOMMatrix();
    }
    scale() {
      return new DOMMatrix();
    }
    transformPoint(p) {
      return p || { x: 0, y: 0, z: 0, w: 1 };
    }
    static fromMatrix() {
      return new DOMMatrix();
    }
    static fromFloat64Array(a) {
      return new DOMMatrix(Array.from(a));
    }
    static fromFloat32Array(a) {
      return new DOMMatrix(Array.from(a));
    }
  };
}

if (typeof globalThis.ImageData === "undefined") {
  globalThis.ImageData = class ImageData {
    constructor(w, h) {
      this.width = w;
      this.height = h;
      this.data = new Uint8ClampedArray(w * h * 4);
    }
  };
}

if (typeof globalThis.Path2D === "undefined") {
  globalThis.Path2D = class Path2D {
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
    closePath() {}
  };
}
