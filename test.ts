import { HttpsProxyAgent } from 'https-proxy-agent';
import ProxyManager from './proxyManager';

const proxy = new ProxyManager('./proxy.txt');
console.log(proxy.getRandom())
