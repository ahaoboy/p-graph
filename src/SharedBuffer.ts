export const SharedBuffer:
  | ArrayBufferConstructor
  | SharedArrayBufferConstructor =
  typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : ArrayBuffer;
