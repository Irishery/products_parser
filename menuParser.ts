// menuParser.ts
import { JSDOM } from 'jsdom';
import cssToXpath from 'csstoxpath';
import axios, { AxiosError } from 'axios';
import iconv from 'iconv-lite';
import * as utils from './utils';
import Types from './types/types'
import { types } from 'node:util';
import { HttpsProxyAgent } from 'https-proxy-agent';
import ProxyManager from './proxyManager';


export default class MenuParser {
  private cfg: Types.Config;
  public categories: Types.Category[] = [];

  constructor(cfg: Types.Config) {
    this.cfg = cfg;
  }

  async fetch(url: string): Promise<Document> {
    const encoding = this.cfg.charset || 'utf-8';
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    };


    let agent;
    if (this.cfg.proxy) {
      console.log("Proxy using")
      const proxyManager = new ProxyManager(this.cfg.proxy);
      agent = new HttpsProxyAgent(proxyManager.getRandomProxy());
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers,
        ...(agent && { httpAgent: agent, httpsAgent: agent })
      });

      const html = iconv.decode(response.data, encoding);
      return new JSDOM(html).window.document;
    } catch (error) {
      console.error('Axios error:', (error as AxiosError).message);
      return new JSDOM('').window.document;
    }
  }


  getRandomBase(min = 70000, max = 80000): number {
    // Генерируем случайное число кратное 10 в заданном диапазоне
    const rand = Math.floor(Math.random() * ((max - min) / 10)) * 10 + min;
    return rand;
  }

  async getMenu(): Promise<Types.Category[]> {
    const doc = await this.fetch(this.cfg.url);
    const menuConf = this.cfg.menu;
    const menuNode = this.select(doc, menuConf.main);

    for (const node of menuNode.childNodes) {
      if (node.nodeType !== 1) continue;

      const el = node as Element;
      const nameElement = el.querySelector(menuConf.children.name);

      // const rawUrl = nameElement?.getAttribute("href");

      const rawUrl = el.getAttribute("href");
      const rawName = nameElement?.textContent;

      const url = utils.fixUrl(rawUrl ?? '', this.cfg.url);
      const name = utils.convertString(rawName ?? '');

      const baseId = this.getRandomBase();

      this.categories.push({
        id: baseId,
        name: name,
        url: url
      });

      if (this.cfg.menu.sub_catgs.main != undefined) {
        const subcatgs = await this.getSubCatgs(url, baseId);
        this.categories.push(...subcatgs);
      }
    }

    return this.categories;
  }

  async getSubCatgs(url: string, parentId: number): Promise<Types.Category[]> {
    const doc = await this.fetch(url);
    const doc_catgs = this.selectmany(doc, this.cfg.menu.sub_catgs.main);
    let catgs: Types.Category[] = [];

    let offset = 1;

    for (const cat of doc_catgs) {
      const rawUrl = cat.querySelector(this.cfg.menu.sub_catgs.url)?.getAttribute("href");
      const rawName = cat.textContent;
      const name = utils.convertString(rawName ?? '');
      const fixedUrl = utils.fixUrl(rawUrl ?? '', this.cfg.url);

      catgs.push({
        id: parentId + offset,
        name: name,
        url: fixedUrl,
        parent_id: parentId
      });

      offset++;
    }

    return catgs;
  }

  select(doc: Document, selector: string, base: Node = doc): Element {
    const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
    const result = doc.evaluate(path, base, null, 5, null);

    return result.iterateNext() as Element;
  }

  selectmany(doc: Document, selector: string, base: Node = doc): Element[] {
    const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
    const result = doc.evaluate(path, base, null, 5, null);

    let els = new Array<Element>();
    for (let el = result.iterateNext(); el; el = result.iterateNext()) {
      els.push(el as Element);
    }

    return els;
  }
}
