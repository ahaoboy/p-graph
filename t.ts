import { SharedTypeMap } from "./src/SharedTypeMap";

// const s = new SharedTypeMap();

console.log(Uint32Array.BYTES_PER_ELEMENT);

const s = new SharedTypeMap();

console.log(s.count);
// s.count = 1

s.link(1,2,1)

console.log(s.count);
