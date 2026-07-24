import jsQR from 'jsqr';

// jsQR decodes a camera frame in JavaScript. Unlike BarcodeDetector, it works
// in iPhone Safari and Android WebViews as well as modern desktop browsers.
window.LetsQQrScanner = {
  decode(data, width, height) {
    return jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
  }
};
