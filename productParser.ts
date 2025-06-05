// productParser.ts
import * as cssToXpath from 'csstoxpath';
import { JSDOM } from 'jsdom';
import axios from 'axios';
import iconv from 'iconv-lite';
import * as utils from './utils';

interface ProductData {
  name?: string[];
  price?: string[];
  url?: string[];
  picture?: string[];
  description?: string[];
  category?: number;
  [key: string]: any;
}

interface Config {
  url: string;
  charset?: string;
  cssmode?: string;
  product: string;
  product_url?: string;
  selectors: Record<string, string>;
  follow_url?: boolean;
  start_id?: number;
  delay?: number;
}

export default class ProductParser {
  private cfg: Config;
  private selectors: Record<string, string>;
  public products: Record<string, ProductData> = {};
  public all_products: ProductData[] = [];
  public all_index = 0;
  private product_id?: number;

  constructor(cfg: Config, selectors: Record<string, string>) {
    this.cfg = cfg;
    this.selectors = selectors;
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

  extract(doc: Document, selectors: Record<string, string>, baseNode: Node = doc): Record<string, string> {
    const data: Record<string, string> = {};
    for (const key in selectors) {
      const selector = selectors[key];
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

  async parseCategory(category: { id: number; url: string }): Promise<ProductData[]> {
    const doc = await this.fetch(category.url);
    const productsNodes = this.select(doc, this.cfg.product);
    for (const node of productsNodes) {
      const data = this.extract(doc, this.selectors, node);
      data.category = toString(category.id);
      this.all_products.push(data);
      utils.log(`+ ${data.name?.[0] || data.url?.[0] || '[unnamed]'}`);
    }
    return this.all_products;
  }

  select(doc: Document, selector: string): Element[] {
    const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
    const result = doc.evaluate(path, doc, null, 5, null);
    const nodes: Element[] = [];
    let node;
    while ((node = result.iterateNext())) {
      nodes.push(node as Element);
    }
    return nodes;
  }

  async fetchProductDetails(product: ProductData): Promise<ProductData> {
    if (!this.cfg.follow_url || !product.url || !product.url[0]) return product;

    const fullUrl = this.cfg.product_url
      ? this.cfg.product_url + product.url[0]
      : utils.fixUrl(product.url[0], this.cfg.url);

    const doc = await this.fetch(fullUrl);
    const data = this.extract(doc, this.selectors);

    const result = {
      ...product,
      ...data,
      id: this.nextProductId()
    };
    this.products[result.id] = result;
    this.all_index++;
    utils.log(`imported ${result.name}`);
    return result;
  }

  nextProductId(): number {
    if (!this.product_id) {
      this.product_id = this.cfg.start_id || (Date.now() % 100000);
    } else {
      this.product_id += 10;
    }
    return this.product_id;
  }
}
