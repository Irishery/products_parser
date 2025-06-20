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
        console.log(url)
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



    console.log('[start] Экспорт данных');
    await this.Export();
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

        console.log(node.className)
        const elem = node.querySelector(this.cfg.selectors.url)?.textContent;
        const rawUrl = node.querySelector(this.cfg.selectors.url)?.getAttribute('href') || '';
        if (!rawUrl) {
          console.warn(`[getProducts] Пропущен товар: пустой URL`);
          continue;
        }

        const url = utils.fixUrl(rawUrl, this.cfg.url);
        console.log(`[getProducts] Парсим товар по URL: ${url}`);

        try {
          const product = await this.getDetailedProductInfoUrl(url);

          const generatedId = category.id + localIndex;

          product.id = generatedId;
          product.category = category.id;
          product.price[0].id = String(generatedId + 1000);

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
    let desc_index = this.getDescriptionIndex(weight)
    if (desc_index == -1) {
      console.log("[getDetailedProductInfoUrl] Не удалось определить индекс описания")
      console.log(weight)
      desc_index = 10
      price.description = "1";
      price.index = desc_index;
    } else {
      price.description = weight;
      price.index = desc_index;
    }


    let mods: number[] = []
    if (this.cfg.modifiers_flag) {
      console.log('[getDetailedProductInfoUrl] Обнаружены модификаторы — начинаем парсинг');
      mods = await this.getModifiers(doc);
    }

    return {
      id: 0,
      name: name.trim(),
      description: description.trim(),
      picture: picture.trim(),
      price: [price],
      category: 0,
      labels: [],
      modifiers: mods,
      parameters: []
    };
  }

  async getModifiers(doc: Document): Promise<number[]> {
    const result = [];
    console.log('[getModifiers] Парсим модификаторы');
    const modifierNodes = this.select(doc, this.cfg.modifiers.main);
    console.log(`[getModifiers] Найдено групп: ${modifierNodes.length}`);

    for (const node of modifierNodes) {
      if (node.nodeType !== 1) continue;

      let groupName = node.querySelector(this.cfg.modifiers.group_name)?.textContent;
      if (groupName == undefined) {
        groupName = node.querySelector("catalog-item__properties-header")?.textContent
      }
      const subheader = node.querySelector(this.cfg.modifiers.subheader)?.textContent;

      const modType = this.getModType(subheader);

      const modGroup: Types.ModifierGroup = {
        id: this.modifierGroups.length + 1,
        name: groupName ?? '',
        type: modType,
        required: modType === 'one_one',
        max: modType === 'one_one' ? 1 : 3,
        min: modType === 'one_one' ? 1 : 0,
        modifiers: []
      };

      console.log(`[getModifiers] Группа модификаторов: ${modGroup.name}, Тип: ${modGroup.type}`);

      this.modifierGroups.push(modGroup);
      result.push(this.modifierGroups.length)

      console.log("AAAAAAAAAAA", node.querySelectorAll(this.cfg.modifiers.name).length == 0, node.querySelectorAll(this.cfg.modifiers.name).length)
      if (node.querySelectorAll(this.cfg.modifiers.name).length == 0) {
        const options = node.querySelectorAll(".catalog-item__property")
        for (const option of options) {
          if (node.nodeType !== 1) continue;
          const modName = option?.textContent
          const modPrice = option.getElementsByTagName("meta")[0].getAttribute("content")
          const mod: Types.Modifier = {
            id: this.modifiers.length + 1,
            name: modName ?? '',
            price: parseInt(modPrice ?? '0'),
            group: this.modifierGroups.length
          }
          modGroup.modifiers.push(mod)
          this.modifiers.push(mod)
          console.log(`[getModifiers] Модификатор: ${mod.name}, Цена: ${mod.price}`);
        }
      } else {
        const options = node.querySelectorAll(".catalog-item__property")
        console.log(options)
        console.log(options[0])
        console.log(options.length)
        for (const option of options) {
          if (node.nodeType !== 1) continue;
          const modName = option.querySelector(this.cfg.modifiers.name)?.textContent
          const modPrice = option.querySelector(this.cfg.modifiers.price)?.textContent
          const mod: Types.Modifier = {
            id: this.modifiers.length + 1,
            name: modName ?? '',
            price: parseInt(modPrice ?? '0'),
            group: this.modifierGroups.length
          }
          modGroup.modifiers.push(mod)
          this.modifiers.push(mod)
          console.log(`[getModifiers] Модификатор: ${mod.name}, Цена: ${mod.price}`);
        }

      }
    }

    return result;
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

  getDescriptionIndex(desc: string): number {
    const map: Record<string, number> = {
      'ед.': 0,
      'гр.': 1, 'гр': 1, 'г': 1, 'грамм': 1,
      'кг.': 2, 'кг': 2, 'килограмм': 2,
      'мл.': 3, 'мл': 3,
      'л.': 4, 'л': 4, 'литр': 4,
      'см.': 5, 'см': 5,
      'м.': 6, 'м': 6,
      'мин.': 7, 'мин': 7,
      'ч.': 8, 'ч': 8, 'час': 8,
      'шт.': 9, 'шт': 9,
      'порц.': 10, 'порция': 10
    };

    // Извлекаем возможную единицу измерения (после числа)
    const match = desc.toLowerCase().match(/[\d,.]+\s*([а-яё.]+)/i);
    if (!match) return -1;

    const unit = match[1].replace(/\.+$/, '').trim(); // убираем точку в конце
    return map[unit] ?? -1;
  }



  ifModGroupExists(name: string): boolean {
    for (const group of this.modifierGroups) {
      if (group.name === name) {
        console.log("ТАКАЯ ЖЕ ", group)
      }
    }
    return this.modifierGroups.some(group => group.name === name);
  }

  getModType(subheader: any): string {
    const type = subheader === undefined ? 'one_one' : 'all_unlimited';
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
