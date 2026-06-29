export class TcpBuffer {
  private buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

  append(data: Buffer): void {
    this.buffer = this.buffer.length === 0 ? data : Buffer.concat([this.buffer, data]);
  }

  length(): number {
    return this.buffer.length;
  }

  readUInt32BE(offset: number): number {
    return this.buffer.readUInt32BE(offset);
  }

  readUInt16BE(offset: number): number {
    return this.buffer.readUInt16BE(offset);
  }

  slice(start: number, end?: number): Buffer<ArrayBufferLike> {
    return this.buffer.slice(start, end);
  }

  consume(length: number): void {
    this.buffer = this.buffer.slice(length);
  }

  clear(): void {
    this.buffer = Buffer.alloc(0);
  }
}
