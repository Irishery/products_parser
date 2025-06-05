// menuParser.ts
import { JSDOM } from 'jsdom';
import cssToXpath from 'csstoxpath';
import axios from 'axios';
import iconv from 'iconv-lite';
import * as utils from './utils';
import Config from './types/types'

interface Category {
  id: number;
  name: string;
  url: string;
  parent?: number;
}

export default class MenuParser {
  private cfg: Config;
  public categories: Category[] = [];

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  async fetch(url: string): Promise<Document> {
    const options = {
      method: 'GET',
      url,
      responseType: 'arraybuffer' as const,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    };
    const response = await axios(options);
    const encoding = this.cfg.charset || 'utf-8';
    const html = iconv.decode(response.data, encoding);
    return new JSDOM(html).window.document;
  }

  extract(doc: Document, selectorMap: Record<string, string>, baseNode: Node = doc): Record<string, string[]> {
    const data: Record<string, string[]> = {};
    for (const key in selectorMap) {
      const selector = selectorMap[key];
      const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
      const result = doc.evaluate(path, baseNode, null, 5, null);
      data[key] = [];
      let node;
      while ((node = result.iterateNext())) {
        data[key].push(node.textContent?.trim() || '');
      }
    }
    return data;
  }

  async getMenu(): Promise<Category[]> {
    const doc = await this.fetch(this.cfg.url);
    const menuConf = this.cfg.menu;
    const menuNodes = this.select(doc, menuConf.main);
    console.log(menuNodes[0]);
    let id = 1;

    
    return this.categories;
  }

  select(doc: Document, selector: string, base: Node = doc): Element[] {
    const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
    console.log(path)
    const result = doc.evaluate(path, base, null, 5, null);
    const nodes: Element[] = [];
    let node;
    while ((node = result.iterateNext())) {
      nodes.push(node as Element);
    }
    return nodes;
  }
}
