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
  private modifierGroups: Types.ModifierGroup[] = [];
  private modifiers: Types.Modifier[] = [];

  init(cfg: Types.Config) {
    this.cfg = cfg;
    console.log('[init] Конфигурация инициализирована:', cfg);
  }

  async fetch(url: string): Promise<Document> {
    console.log(`[fetch] Загружаем URL: ${url}`);
    const encoding = this.cfg.charset || 'utf-8';
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (...)',
    };

    const proxyManager = this.cfg.proxy ? new ProxyManager(this.cfg.proxy) : null;
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let agent;
      let proxy: string | undefined;

      if (proxyManager) {
        proxy = proxyManager.getRandomProxy();
        agent = new HttpsProxyAgent(proxy);
        console.log(`[fetch] Попытка #${attempt} с прокси: ${proxy}`);
      } else {
        console.log(`[fetch] Попытка #${attempt} без прокси`);
      }

      try {
        const response = await axios.get(url, {
          timeout: 10000,
          responseType: 'arraybuffer',
          headers,
          ...(agent && { httpAgent: agent, httpsAgent: agent }),
        });

        console.log(`[fetch] Успешно загружено: ${url}`);
        const html = iconv.decode(response.data, encoding);
        return new JSDOM(html).window.document;

      } catch (error) {
        const err = error as AxiosError;
        console.warn(`[fetch] Ошибка при попытке #${attempt}: ${err.message}`);
        if (attempt === maxAttempts) {
          console.error(`[fetch] Все ${maxAttempts} попытки не удались. Возвращаем пустой документ.`);
          break;
        }
        await new Promise(res => setTimeout(res, 1000));
      }
    }

    return new JSDOM('').window.document;
  }

  async start(): Promise<void> {
    console.log('[start] Старт парсера');
    const menuParser = new MenuParser(this.cfg);

    console.log('[start] Получаем меню');
    this.categories = await menuParser.getMenu();
    console.log('[start] Категории получены:', this.categories);

    console.log('[start] Получаем продукты');
    await this.getProducts();

    console.log(this.modifierGroups)



    // console.log('[start] Экспорт данных');
    // await this.Export();
  }

  async getProducts(): Promise<Types.Product[]> {
    let globalIndex = 1;

    for (const category of this.categories) {
      console.log(`[getProducts] Обработка категории: ${category.name} (${category.url})`);

      const doc = await this.fetch(category.url);
      const productNodes = this.select(doc, this.cfg.product);
      console.log(`[getProducts] Найдено ${productNodes.length} товаров`);

      let localIndex = 1;

      for (const node of productNodes) {
        if (node.nodeType !== 1) continue;

        const rawUrl = node.getElementsByClassName(this.cfg.selectors.url)?.[0]?.getAttribute('href') || '';
        if (!rawUrl) {
          console.warn(`[getProducts] Пропущен товар: пустой URL`);
          continue;
        }

        const url = utils.fixUrl(rawUrl, this.cfg.url);
        console.log(`[getProducts] Парсим товар по URL: ${url}`);

        try {
          const product = await this.getDetailedProductInfoUrl(url);

          const generatedId = 1000 * category.id + localIndex;

          product.id = generatedId;
          product.category = category.id;
          product.price[0].id = String(generatedId + localIndex + 1000);

          console.log(`[getProducts] Продукт добавлен: ${product.name}, id: ${product.id}`);
          this.products.push(product);

          localIndex++;
          globalIndex++;
        } catch (e) {
          utils.err(`[getProducts] Ошибка парсинга продукта: ${e}`);
        }
      }
    }

    return this.products;
  }

  async getDetailedProductInfoUrl(url: string): Promise<Types.Product> {
    console.log(`[getDetailedProductInfoUrl] Загружаем подробную информацию по URL: ${url}`);
    const doc = await this.fetch(url);

    const name = doc.querySelector(this.cfg.selectors.name)?.textContent ?? '';
    const description = doc.querySelector(this.cfg.selectors.description)?.textContent ?? '';
    const picture = doc.querySelector(this.cfg.selectors.picture)?.getAttribute('src') ?? '';
    const price_value = doc.querySelector(this.cfg.selectors.price)?.textContent ?? '';
    const weight = doc.querySelector(this.cfg.selectors.weight)?.textContent ?? '';

    console.log(`[getDetailedProductInfoUrl] Имя: ${name}, Цена: ${price_value}, Вес: ${weight}`);

    let price = <Types.ProductPrice>{};
    price.price = parseInt(price_value);
    price.description = weight;

    if (this.cfg.modifiers && Object.keys(this.cfg.modifiers).length > 0) {
      console.log('[getDetailedProductInfoUrl] Обнаружены модификаторы — начинаем парсинг');
      await this.getModifiers(doc);
    }

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

  async getModifiers(doc: Document): Promise<Types.ModifierGroup[]> {
    console.log('[getModifiers] Парсим модификаторы');
    const modifierNodes = this.select(doc, this.cfg.modifiers.main);
    console.log(`[getModifiers] Найдено групп: ${modifierNodes.length}`);

    for (const node of modifierNodes) {
      if (node.nodeType !== 1) continue;

      const groupName = node.querySelector(this.cfg.modifiers.group_name)?.textContent;
      const subheader = node.querySelector(this.cfg.modifiers.subheader)?.textContent;

      const groupId = Math.floor(Math.random() * 1000000);
      const modType = this.getModType(subheader);

      const modGroup: Types.ModifierGroup = {
        id: groupId,
        name: groupName ?? '',
        type: modType,
        required: modType === 'one_one',
        max: modType === 'one_one' ? 1 : 3,
        min: modType === 'one_one' ? 1 : 0,
      };

      console.log(`[getModifiers] Группа модификаторов: ${modGroup.name}, Тип: ${modGroup.type}`);

      if (!this.ifModGroupExists(modGroup.name)) {
        this.modifierGroups.push(modGroup);
        console.log(`[getModifiers] Добавлена новая группа: ${modGroup.name}`);
      } else {
        console.log(`[getModifiers] Группа уже существует: ${modGroup.name}`);
      }

      // TODO: Здесь должен быть парсинг опций модификаторов
    }

    return this.modifierGroups;
  }

  async Export() {
    console.log('[Export] Запускаем экспорт');

    const exportData = {
      name: this.cfg.name || '',
      company: this.cfg.company || '',
      url: this.cfg.url,
      categories: this.categories,
      products: this.products.reduce((acc, product) => {
        acc[product.id] = product;
        return acc;
      }, {} as Record<string, Types.Product>),
      modifiers_groups: this.modifierGroups // если их нет — будет пустой массив
    };

    console.log('[Export] Данные для экспорта готовы. Начинаем запись XML.');
    const exporter = new Exporter(exportData, this.cfg);
    exporter.exportXml();
    console.log('[Export] Экспорт завершён');
  }

  ifModGroupExists(name: string): Boolean {
    const exists = this.modifiers.some((group) => group.name === name);
    if (exists) {
      console.log(`[ifModGroupExists] Группа уже существует: ${name}`);
    }
    return exists;
  }

  getModType(subheader: any): string {
    const type = subheader === undefined ? 'one_one' : 'all_one';
    console.log(`[getModType] Тип для "${subheader}": ${type}`);
    return type;
  }

  select(doc: Document, selector: string, base: Node = doc): Element[] {
    const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
    const result = doc.evaluate(path, base, null, 5, null);

    const els: Element[] = [];
    for (let el = result.iterateNext(); el; el = result.iterateNext()) {
      els.push(el as Element);
    }

    console.log(`[select] Селектор: ${selector}, Найдено: ${els.length}`);
    return els;
  }
}

export default new Parser();
