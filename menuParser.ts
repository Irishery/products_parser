// menuParser.ts
import { JSDOM } from 'jsdom';
import * as cssToXpath from 'csstoxpath';
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
    let id = 1;

    for (const node of menuNodes) {
      const name = this.extract(doc, { name: menuConf.name }, node).name[0];
      const url = this.extract(doc, { url: menuConf.url }, node).url[0];
      if (!name) continue;
      this.categories.push({
        id,
        name: utils.convertString(name),
        url: utils.fixUrl(url, this.cfg.url)
      });
      const children = this.select(doc, menuConf.children.main, node);
      let parent = id;
      id++;
      for (const child of children) {
        const childName = this.extract(doc, { name: menuConf.children.name }, child).name[0];
        const childUrl = this.extract(doc, { url: menuConf.children.url }, child).url[0];
        if (!childName) continue;
        this.categories.push({
          id,
          name: utils.convertString(childName),
          url: utils.fixUrl(childUrl, this.cfg.url),
          parent
        });
        id++;
      }
    }

    utils.log(`Найдено категорий: ${this.categories.length}`);
    return this.categories;
  }

  select(doc: Document, selector: string, base: Node = doc): Element[] {
    const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
    const result = doc.evaluate(path, base, null, 5, null);
    const nodes: Element[] = [];
    let node;
    while ((node = result.iterateNext())) {
      nodes.push(node as Element);
    }
    return nodes;
  }
}
