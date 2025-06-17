import fs from 'fs';
import Types from './types/types'


class ProxyManager {
  private proxies: Types.Proxy[] = [];

  constructor(filePath: string) {
    this.loadProxies(filePath);
  }

  private loadProxies(filePath: string) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const lines = data.split(/\r?\n/).filter(line => line.trim().length > 0);

      this.proxies = lines.map(line => {
        const [host, portStr, user, pass] = line.split(':');
        if (!host || !portStr || !user || !pass) {
          throw new Error(`Invalid proxy format: ${line}`);
        }
        return {
          host,
          port: Number(portStr),
          user,
          pass,
        };
      });
    } catch (error) {
      console.error('Error loading proxies:', error);
      this.proxies = [];
    }
  }

  public getRandomProxy(): string {
    if (this.proxies.length === 0) return '';
    const idx = Math.floor(Math.random() * this.proxies.length);
    const proxy = this.proxies[idx]
    return `http://${proxy.user}:${proxy.pass}@${proxy.host}:${proxy.port}`;
  }
}

export default ProxyManager;
