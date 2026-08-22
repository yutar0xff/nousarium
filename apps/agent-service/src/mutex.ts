export class Mutex {
  private chain = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const wait = this.chain;
    this.chain = this.chain.then(() => next);
    await wait;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
