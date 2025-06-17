import MenuParser from './menuParser';
import Types from '../types/types'
import { JSDOM } from 'jsdom';
import cssToXpath from 'csstoxpath';
import axios, { AxiosError } from 'axios';
import iconv from 'iconv-lite';
import * as utils from '../helpers/utils';
import Exporter from './exporter';
import { HttpsProxyAgent } from 'https-proxy-agent';
import ProxyManager from '../helpers/proxyManager';



class Parser {
  private cfg!: Types.Config;
  private categories: Types.Category[] = [];
  private products: Types.Product[] = [];
  private modifiers: Types.ModifierGroup[] = [];

  init(cfg: Types.Config) {
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

  async start(): Promise<void> {
    const menuParser = new MenuParser(this.cfg);

    this.categories = await menuParser.getMenu();
    console.log(this.categories)
    await this.getProducts();

    await this.Export();

  }

  async getProducts(): Promise<Types.Product[]> {
    let globalIndex = 1;

    for (const category of this.categories) {

      const doc = await this.fetch(category.url);
      const productNodes = this.select(doc, this.cfg.product);

      let localIndex = 1;


      for (const node of productNodes) {
        if (node.nodeType !== 1) continue;

        const rawUrl = node.getElementsByClassName(this.cfg.selectors.url)?.[0]?.getAttribute('href') || '';
        if (!rawUrl) continue;

        const url = utils.fixUrl(rawUrl, this.cfg.url);

        try {
          const product = await this.getDetailedProductInfoUrl(url);

          const generatedId = 1000 * category.id + localIndex;

          product.id = generatedId;
          product.category = category.id;

          product.price[0].id = String(generatedId + localIndex + 1000)

          this.products.push(product);

          localIndex++;
          globalIndex++;
        } catch (e) {
          utils.err(`Error parsing product: ${e}`);
        }
      }
    }

    return this.products;
  }

  async getDetailedProductInfoUrl(url: string): Promise<Types.Product> {
    const doc = await this.fetch(url);

    let price = <Types.ProductPrice>{}

    const name = doc.querySelector(this.cfg.selectors.name)?.textContent ?? '';
    const description = doc.querySelector(this.cfg.selectors.description)?.textContent ?? '';
    const picture = doc.querySelector(this.cfg.selectors.picture)?.getAttribute('src') ?? '';
    const price_value = doc.querySelector(this.cfg.selectors.price)?.textContent ?? '';
    const weight = doc.querySelector(this.cfg.selectors.weight)?.textContent ?? '';

    console.log(description)
    console.log(weight)

    price.price = parseInt(price_value)
    price.description = weight

    return {
      id: 0,
      name: name.trim(),
      description: description.trim(),
      picture: picture.trim(),
      price: [price],
      category: 0,
      labels: [],
      modifiers: [],
      parameters: []
    };
  }

  async getDetailedProductInfoElem(doc: Element): Promise<Types.Product> {
    // const doc = await this.fetch(url);

    let price = <Types.ProductPrice>{}

    const name = doc.querySelector(this.cfg.selectors.name)?.textContent ?? '';
    const description = doc.querySelector(this.cfg.selectors.description)?.textContent ?? '';
    const raw_picture = doc.querySelector(this.cfg.selectors.picture)?.getAttribute('data-src') ?? '';
    const price_value = doc.querySelector(this.cfg.selectors.price)?.textContent ?? '';
    const weight = doc.querySelector(this.cfg.selectors.weight)?.textContent ?? '';

    price.price = parseInt(price_value)
    price.description = weight

    return {
      id: 0,
      name: name.trim(),
      description: description.trim(),
      picture: utils.fixUrl(raw_picture, this.cfg.url),
      price: [price],
      category: 0,
      labels: [],
      modifiers: [],
      parameters: [] // будет заполняться позже
    };
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

    const exporter = new Exporter(exportData, this.cfg);
    exporter.exportXml();
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
