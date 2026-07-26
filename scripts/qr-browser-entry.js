import QRCode from 'qrcode';

window.LetsQQr = {
  toDataUrl(value) {
    return QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 720,
      color: { dark: '#000000', light: '#ffffff' }
    });
  }
};
