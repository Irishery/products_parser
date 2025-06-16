import fs from 'fs';
import path from 'path';

export default class ProxyManager {
  private proxies: string[] = [];

  constructor(filePath: string) {
    const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
    const lines = raw.split('\n');

    this.proxies = lines
      .map(line => line.trim())
      .filter(line => /^\d{1,3}(\.\d{1,3}){3}:\d+/.test(line)) // IP:PORT
      .map(line => {
        const match = line.match(/^(\d{1,3}(?:\.\d{1,3}){3}:\d+)/);
        return match ? `https://${match[1]}` : null;
      })
      .filter((proxy): proxy is string => !!proxy);
  }

  getRandom(): string | null {
    if (this.proxies.length === 0) return null;
    const index = Math.floor(Math.random() * this.proxies.length);
    return this.proxies[index];
  }
  length(): number {
    return this.proxies.length;
  }

}
