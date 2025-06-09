// menuParser.ts
import { JSDOM } from 'jsdom';
import cssToXpath from 'csstoxpath';
import axios from 'axios';
import iconv from 'iconv-lite';
import * as utils from './utils';
import Types from './types/types'
import { types } from 'node:util';

interface Category {
  id: number;
  name: string;
  url: string;
}

export default class MenuParser {
  private cfg: Types.Config;
  public categories: Category[] = [];

  constructor(cfg: Types.Config) {
    this.cfg = cfg;
  }

  async fetch(url: string): Promise<Document> {
    const options = {
      method: 'GET',
      url,
      responseType: 'arraybuffer' as const,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/137.0.0.0 Safari/537.36'
      }
    };
    const response = await axios(options);
    const encoding = this.cfg.charset || 'utf-8';
    const html = iconv.decode(response.data, encoding);
    return new JSDOM(html).window.document;
  }

  async getMenu(): Promise<Category[]> {
    const doc = await this.fetch(this.cfg.url);
    const menuConf = this.cfg.menu;
    const menuNode = this.select(doc, menuConf.main);

    let id = 1;

    for (const node of menuNode.childNodes) {
      if (node.nodeType !== 1) continue;

      const el = node as Element;

      const nameElement = el.querySelector(menuConf.children.name);

      const rawUrl = el.getAttribute("href");
      const rawName = nameElement?.textContent;

      const url = utils.fixUrl(rawUrl ?? '', this.cfg.url);
      const name = utils.convertString(rawName ?? '');

      this.categories.push({
        id,
        name: utils.convertString(name),
        url: utils.fixUrl(url, this.cfg.url)
      });

      id++;

    }

    return this.categories;
  }

  select(doc: Document, selector: string, base: Node = doc): Element {
    const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
    const result = doc.evaluate(path, base, null, 5, null);

    return result.iterateNext() as Element;
  }
}
