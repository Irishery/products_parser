import MenuParser from './menuParser';
import config from './config.json';
import Types from './types/types'
import { JSDOM } from 'jsdom';
import cssToXpath from 'csstoxpath';
import axios from 'axios';
import iconv from 'iconv-lite';


class Parser{
  private cfg!: Types.Config;
  private categories: Types.Category[] = [];
  private products: Types.Product[] = [];

  init(cfg: Types.Config) {
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

  async start(): Promise<void> {
    const menuParser = new MenuParser(this.cfg);

    this.categories = await menuParser.getMenu();
  
    // await this.getProducts()
    
  }

  async getProducts(): Promise<Types.Product[]> {
    for (const category of this.categories) {
      console.log(category.name, category.url);
      // const doc = await this.fetch(category.url);

      // const productNodes = this.select(doc, this.cfg.product);

      // for (const node of productNodes) {
      //   if (node.nodeType !== 1) continue;

      //   console.log(node.textContent);
      // }
    }

    return this.products;
  }

  select(doc: Document, selector: string, base: Node = doc): Element[] {
      const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
      const result = doc.evaluate(path, base, null, 5, null);

      let els = new Array<Element>();
      for (let el = result.iterateNext(); el; el = result.iterateNext()) {
        els.push(el as Element);
      }
  
      return els;
    }
}

export default new Parser();
