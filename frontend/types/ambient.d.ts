declare module "qrcode" {
  const qrcode: {
    toString(text: string, options?: Record<string, any>): Promise<string>;
    toDataURL(text: string, options?: Record<string, any>): Promise<string>;
  };
  export default qrcode;
}

declare module "jsqr" {
  export interface QRCode {
    data: string;
    location: any;
  }
  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: any
  ): QRCode | null;
}
