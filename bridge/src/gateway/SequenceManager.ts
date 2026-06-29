export class SequenceManager {
  private current = 1;

  next(): number {
    const value = this.current;
    this.current = this.current >= 0xffffffff ? 1 : this.current + 1;
    return value;
  }
}
