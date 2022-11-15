import type { TypedArrayConstructor, TypedArray } from "./type";
import {
  AllEdgeTypes,
  SerializedAdjacencyList,
  AdjacencyListOptions,
} from "./type";
import { SharedBuffer } from "./SharedBuffer";
import { hash32shift, assert, nullthrows } from "./share";

/** The upper bound above which capacity should be increased. */
const LOAD_FACTOR = 0.7;
/** The lower bound below which capacity should be decreased. */
const UNLOAD_FACTOR = 0.3;
/** The max amount by which to grow the capacity. */
const MAX_GROW_FACTOR = 8;
/** The min amount by which to grow the capacity. */
const MIN_GROW_FACTOR = 2;
/** The amount by which to shrink the capacity. */
const SHRINK_FACTOR = 0.5;

function interpolate(x: number, y: number, t: number): number {
  return x + (y - x) * Math.min(1, Math.max(0, t));
}
const MIN_CAPACITY: number = 2;
/** The largest possible node map capacity. */
const MAX_CAPACITY: number = Math.floor(1 << 20);
const PEAK_CAPACITY: number = 2 ** 18;

function increaseNodeCapacity(nodeCapacity: number): number {
  const newCapacity = Math.round(nodeCapacity * MIN_GROW_FACTOR);
  assert(newCapacity <= MAX_CAPACITY, "Node capacity overflow!");
  return Math.max(MIN_CAPACITY, newCapacity);
}

function getNextEdgeCapacity(
  capacity: number,
  count: number,
  load: number
): number {
  let newCapacity = capacity;
  if (load > LOAD_FACTOR) {
    // This is intended to strike a balance between growing the edge capacity
    // in too small increments, which causes a lot of resizing, and growing
    // the edge capacity in too large increments, which results in a lot of
    // wasted memory.
    const pct = capacity / PEAK_CAPACITY;
    const growFactor = interpolate(MAX_GROW_FACTOR, MIN_GROW_FACTOR, pct);
    newCapacity = Math.round(capacity * growFactor);
  } else if (load < UNLOAD_FACTOR) {
    // In some cases, it may be possible to shrink the edge capacity,
    // but this is only likely to occur when a lot of edges have been removed.
    newCapacity = Math.round(capacity * SHRINK_FACTOR);
  }
  assert(newCapacity <= MAX_CAPACITY, "Edge capacity overflow!");
  return Math.max(MIN_CAPACITY, newCapacity);
}

function getNumberByType(dv: DataView, ptr: number, type: number) {
  switch (type) {
    case 1:
      return dv.getUint8(ptr);
    case 2:
      return dv.getUint16(ptr);
    case 4:
      return dv.getUint32(ptr);
  }
  throw new Error("error type 1,2,4");
}
/**
 * `SharedTypeMap` is a hashmap of items,
 * where each item has its own 'type' field.
 *
 * The `SharedTypeMap` is backed by a shared array buffer of fixed length.
 * The buffer is partitioned into:
 * - a header, which stores the capacity and number of items in the map,
 * - a hash table, which is an array of pointers to linked lists of items
 *   with the same hash,
 * - an items array, which is where the linked items are stored.
 *
 *            hash table                 item
 *            (capacity)             (itemSize)
 *         ┌──────┴──────┐             ┌──┴──┐
 *   ┌──┬──┬──┬───────┬──┬──┬──┬───────┬──┬──┐
 *   │  │  │  │  ...  │  │  │  │  ...  │  │  │
 *   └──┴──┴──┴───────┴──┴──┴──┴───────┴──┴──┘
 *   └──┬──┘             └─────────┬─────────┘
 *    header                     items
 * (headerSize)    (capacity * itemSize * BUCKET_SIZE)
 *
 *
 * An item is added with a hash key that fits within the range of the hash
 * table capacity. The item is stored at the next available address after the
 * hash table, and a pointer to the address is stored in the hash table at
 * the index matching the hash. If the hash is already pointing at an item,
 * the pointer is stored in the `next` field of the existing item instead.
 *
 *       hash table                          items
 * ┌─────────┴────────┐┌───────────────────────┴────────────────────────┐
 *    0    1    2        11       17        23       29      35
 * ┌───┐┌───┐┌───┐┌───┐┌───┬───┐┌───┬───┐┌───┬───┐┌───┬───┐┌───┬───┐┌───┐
 * │17 ││11 ││35 ││...││23 │ 1 ││29 │ 1 ││ 0 │ 2 ││ 0 │ 2 ││ 0 │ 1 ││...│
 * └───┘└───┘└───┘└───┘└───┴───┘└───┴───┘└───┴───┘└───┴───┘└───┴───┘└───┘
 *   │    │    │         ▲        ▲        ▲        ▲        ▲
 *   └────┼────┼─────────┼────────┴────────┼────────┘        │
 *        └────┼─────────┴─────────────────┘                 │
 *             └─────────────────────────────────────────────┘
 */
export class SharedTypeMap implements Iterable<number> {
  /**
   * The header for the `SharedTypeMap` comprises 2 4-byte chunks:
   *
   * struct SharedTypeMapHeader {
   *   int capacity;
   *   int count;
   * }
   *
   * ┌──────────┬───────┐
   * │ CAPACITY │ COUNT │ nextTp, typeTp
   * └──────────┴───────┘
   */
  readonly countSize = 4;
  readonly capacitySize = 4;
  readonly nextTypeSize = 1;
  readonly typeTypeSize = 1;
  readonly headerSize = 4 + 4 + 1 + 1;
  capacityPos = 0;
  countPos = 4;
  nextTypePos = 8;
  typeTypePos = 9;
  // static _headerSize: number = 2;

  /** The offset from the header where the capacity is stored. */
  // private static _CAPACITY: 0 = 0;
  /** The offset from the header where the count is stored. */
  // private static _COUNT: 1 = 1;

  /**
   * Each item in `SharedTypeMap` comprises 2 4-byte chunks:
   *
   * struct Node {
   *   int next;
   *   int type;
   * }
   *
   * ┌──────┬──────┐
   * │ NEXT │ TYPE │
   * └──────┴──────┘
   */
  get nextType() {
    return this.dv.getUint8(this.nextTypePos)!;
  }
  get typeType() {
    return this.dv.getUint8(this.typeTypePos);
  }

  // capacity of item, memory need x itemSize
  get capacity() {
    return this.dv.getUint32(this.capacityPos);
  }
  setCapacity(n: number) {
    this.dv.setUint32(this.capacityPos, n);
  }
  // count of item
  get count() {
    return this.dv.getUint32(this.countPos);
  }
  setCount(n: number) {
    this.dv.setUint32(this.countPos, n);
  }
  get itemSize() {
    return this.nextType + this.typeType;
  }

  // static itemSize: number = 2;
  /** The offset at which a link to the next item in the same bucket is stored. */
  private static _NEXT: 0 = 0;
  /** The offset at which an item's type is stored. */
  private static _TYPE: 1 = 1;

  /** The number of items to accommodate per hash bucket. */
  static BUCKET_SIZE: number = 2;
  data: TypedArray;
  dv: DataView = new DataView(new SharedArrayBuffer(100));

  get BUCKET_SIZE() {
    return SharedTypeMap.BUCKET_SIZE;
  }
  // get headerSize() {
  //   return SharedTypeMap._headerSize;
  // }
  // get itemSize() {
  //   return SharedTypeMap.itemSize;
  // }
  // get NEXT() {
  //   return SharedTypeMap._NEXT;
  // }

  // get capacity(): number {
  //   return this.data[SharedTypeMap._CAPACITY] ?? 0;
  // }

  // get count(): number {
  //   return this.data[SharedTypeMap._COUNT] ?? 0;
  // }

  get load(): number {
    return this.getLoad();
  }

  get length(): number {
    return this.getLength();
  }

  get addressableLimit(): number {
    return this.headerSize + this.capacity;
  }

  get bufferSize(): string {
    return `${(this.data.byteLength / 1024 / 1024).toLocaleString(undefined, {
      minimumIntegerDigits: 2,
      maximumFractionDigits: 2,
    })} mb`;
  }

  constructor(
    capacityOrData: number | TypedArray = 16,
    typedArray: TypedArrayConstructor = Uint32Array
  ) {
    if (typeof capacityOrData === "number") {
      let { BYTES_PER_ELEMENT } = typedArray;
      this.data = new typedArray(
        new SharedBuffer(this.getLength(capacityOrData) * BYTES_PER_ELEMENT)
      );
      this.setCapacity(capacityOrData);
    } else {
      this.data = capacityOrData;
      assert(this.getLength() === this.data.length, "Data appears corrupt.");
    }
  }
  *[Symbol.iterator](): Iterator<number> {
    const max = this.count;
    const len = this.length;
    for (
      let i = this.addressableLimit, count = 0;
      i < len && count < max;
      i += this.itemSize
    ) {
      if (this.data.subarray(i, i + this.itemSize).some(Boolean)) {
        yield i;
        count++;
      }
    }
  }

  getLoad(count: number = this.count): number {
    return count / (this.capacity * this.BUCKET_SIZE);
  }

  // byte length
  getLength(capacity: number = this.capacity): number {
    return (
      capacity * this.itemSize +
      this.headerSize +
      this.itemSize * this.BUCKET_SIZE * capacity
    );
  }
  /** Get the next available address in the map. */
  getNextAddress(): number {
    const { headerSize, itemSize } = this;
    return headerSize + this.capacity + this.count * itemSize;
  }

  /** Get the next available address in the map. */
  getNextNumber(): number {
    return this.headerSize + this.capacity + this.count * this.itemSize;
  }

  /** Get the address of the first item with the given hash. */
  head(hash: number): number | null {
    return this.data[this.headerSize + hash] || null;
  }

  /** Get the address of the next item with the same hash as the given item. */
  // next(item: number): number | null {
  //   return this.data[item + this.NEXT] || null;
  // }
  next(n: number) {
    return getNumberByType(this.dv, n, this.nextType);
  }
  typeOf(item: number): number {
    return this.data[item + SharedTypeMap._TYPE] || 0;
  }

  inspect(): {
    header: TypedArray;
    table: TypedArray;
    data: TypedArray;
  } {
    const { headerSize, itemSize, BUCKET_SIZE } = this;
    const min = headerSize + this.capacity;
    const max = min + this.capacity * BUCKET_SIZE * itemSize;
    return {
      header: this.data.subarray(0, headerSize),
      table: this.data.subarray(headerSize, min),
      data: this.data.subarray(min, max),
    };
  }

  forEach(cb: (item: number) => void): void {
    const max = this.count;
    const len = this.length;
    const { itemSize } = this;
    for (
      let i = this.addressableLimit, count = 0;
      i < len && count < max;
      i += itemSize
    ) {
      // Skip items that don't have a type.
      if (this.typeOf(i)) {
        cb(i);
        count++;
      }
    }
  }
  set(data: TypedArray): void {
    const { headerSize, itemSize } = this;
    const COUNT = this.countSize;
    const CAPACITY = this.capacity;
    const NEXT = 0;
    const delta = this.capacity - data[CAPACITY]!;
    assert(delta >= 0, "Cannot copy to a map with smaller capacity.");

    // Copy the header.
    this.data.set(data.subarray(COUNT, headerSize), COUNT);

    // Copy the hash table.
    const toTable = this.data.subarray(headerSize, headerSize + this.capacity);
    toTable.set(data.subarray(headerSize, headerSize + data[CAPACITY]!));
    // Offset first links to account for the change in table capacity.
    let max = toTable.length;
    for (let i = 0; i < max; i++) {
      if (toTable[i]) toTable[i] += delta;
    }

    // Copy the items.
    const toItems = this.data.subarray(headerSize + this.capacity);
    toItems.set(data.subarray(headerSize + data[CAPACITY]!));
    // Offset next links to account for the change in table capacity.
    max = toItems.length;
    for (let i = 0; i < max; i += itemSize) {
      if (toItems[i + NEXT]) toItems[i + NEXT] += delta;
    }
  }
  link(hash: number, item: number, type: number): void {
    const NEXT = SharedTypeMap._NEXT;
    const TYPE = SharedTypeMap._TYPE;
    const { headerSize } = this;

    this.data[item + TYPE] = type;

    let prev = this.head(hash);
    if (prev !== null) {
      let next = this.next(prev);
      while (next !== null) {
        prev = next;
        next = this.next(next);
      }
      this.data[prev + NEXT] = item;
    } else {
      // This is the first item in the bucket!
      this.data[headerSize + hash] = item;
    }
    this.setCount(this.count + 1);
  }

  unlink(hash: number, item: number): void {
    const NEXT = SharedTypeMap._NEXT;
    const TYPE = SharedTypeMap._TYPE;
    const { headerSize } = this;

    this.data[item + TYPE] = 0;

    let head = this.head(hash);
    // No bucket to unlink from.
    if (head === null) return;

    let next = this.next(item);
    let prev = null;
    let candidate: number | null = head;
    while (candidate !== null && candidate !== item) {
      prev = candidate;
      candidate = this.next(candidate);
    }
    if (prev !== null && next !== null) {
      this.data[prev + NEXT] = next;
    } else if (prev !== null) {
      this.data[prev + NEXT] = 0;
    } else if (next !== null) {
      this.data[headerSize + hash] = next;
    } else {
      this.data[headerSize + hash] = 0;
    }
    this.data[item + NEXT] = 0;
    this.setCount(this.count - 1);
  }
}
