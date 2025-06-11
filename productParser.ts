import MenuParser from './menuParser';
import config from './config.json';
import Types from './types/types'
import { JSDOM } from 'jsdom';
import cssToXpath from 'csstoxpath';
import axios, { AxiosError } from 'axios';
import iconv from 'iconv-lite';
import * as utils from './utils';
import Exporter from './exporter';




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
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      }
    };
    // const response = await axios(options);
    let response: any;

  try {
    response = await axios.get(url, { responseType: 'arraybuffer' });
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Axios error:', error.message);
    } else if (error instanceof Error) {
      console.error('General error:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
    console.error('Response data:', error);
    return new JSDOM('').window.document; // Возврат в случае ошибки
    }

    const encoding = this.cfg.charset || 'utf-8';
    const html = iconv.decode(response.data, encoding);
    return new JSDOM(html).window.document;
  }

  async start(): Promise<void> {
    const menuParser = new MenuParser(this.cfg);

    this.categories = await menuParser.getMenu();
    await this.getProducts();

    console.log("PRODUCTS ", this.products.length);

    await this.Export();
    
  }

  async getProducts(): Promise<Types.Product[]> {
    for (const category of this.categories) {
      const doc = await this.fetch(category.url);
      // console.log([1]);

      const productNodes = this.select(doc, this.cfg.product);

      for (const node of productNodes) {
        if (node.nodeType !== 1) continue;
        const rawUrl = node.getElementsByClassName(this.cfg.selectors.url)[0].getAttribute('href') || '';

        if (!rawUrl) continue;
        const url = utils.fixUrl(rawUrl, this.cfg.url);
        await this.getDetailedProductInfo(url)
          .then((product) => {
            product.id = url;
            product.category = category.id;
            this.products.push(product);
          })
          .catch((e) => {
            utils.err(`Error parsing product: ${e}`);
          });

        
      }
    }

    return this.products;
  }

  async getDetailedProductInfo(url: string): Promise<Types.Product> {
    console.log(url);
    const doc = await this.fetch(url);
    const product: Types.Product = {
      id: '',
      name: '',
      description: '',
      picture: '',
      price: [],
      category: 10,
      labels: [],
      modifiers: []
    };

    const name = doc.querySelector(this.cfg.selectors.name)?.textContent;
    const description = doc.querySelector(this.cfg.selectors.description)?.textContent;
    const picture = doc.querySelector(this.cfg.selectors.picture)?.getAttribute('src')
    const price = doc.querySelector(this.cfg.selectors.price)?.textContent;

    product.name = name ?? '';
    product.description = description ?? '';
    product.picture = picture ?? '';
    product.price = price ? [price] : [];

    return product;
  }

  async Export() {
    const exportData = {
    name: this.cfg.name || '',
    company: this.cfg.company || '',
    url: this.cfg.url,
    categories: this.categories,
    products: this.products.reduce((acc, product) => {
      acc[product.id] = product;
      return acc;
    }, {} as Record<string, Types.Product>),
    modifiers_groups: [] // если есть — заполните по логике, иначе оставить пустым
    };

    const exporter = new Exporter({ filename: this.cfg.filename });
    exporter.exportXML(exportData);
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
