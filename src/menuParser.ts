import { JSDOM } from 'jsdom';
import cssToXpath from 'csstoxpath';
import axios, { AxiosError } from 'axios';
import iconv from 'iconv-lite';
import * as utils from '../helpers/utils';
import Types from '../types/types';
import { HttpsProxyAgent } from 'https-proxy-agent';
import ProxyManager from '../helpers/proxyManager';

export default class MenuParser {
  private cfg: Types.Config;
  public categories: Types.Category[] = [];

  constructor(cfg: Types.Config) {
    this.cfg = cfg;
    console.log('[MenuParser] Конфигурация инициализирована');
  }

  async fetch(url: string): Promise<Document> {
    const encoding = this.cfg.charset || 'utf-8';
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (...)',
    };

    let agent;
    if (this.cfg.proxy) {
      console.log('[fetch] Используем прокси');
      const proxyManager = new ProxyManager(this.cfg.proxy);
      const proxy = proxyManager.getRandomProxy();
      console.log(`[fetch] Выбран прокси: ${proxy}`);
      agent = new HttpsProxyAgent(proxy);
    }

    try {
      console.log(`[fetch] Загружаем URL: ${url}`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers,
        ...(agent && { httpAgent: agent, httpsAgent: agent })
      });

      const html = iconv.decode(response.data, encoding);
      console.log(`[fetch] Страница загружена: ${url}`);
      return new JSDOM(html).window.document;
    } catch (error) {
      console.error(`[fetch] Ошибка загрузки ${url}:`, (error as AxiosError).message);
      return new JSDOM('').window.document;
    }
  }

  getRandomBase(min = 70000, max = 80000): number {
    const rand = Math.floor(Math.random() * ((max - min) / 10)) * 10 + min;
    console.log(`[getRandomBase] Сгенерирован ID: ${rand}`);
    return rand;
  }

  async getMenu(): Promise<Types.Category[]> {
    console.log('[getMenu] Начинаем загрузку меню');
    const doc = await this.fetch(this.cfg.url);
    const menuConf = this.cfg.menu;
    const menuNode = this.select(doc, menuConf.main);

    if (!menuNode) {
      console.warn('[getMenu] Основной узел меню не найден');
      return this.categories;
    }

    for (const node of menuNode.childNodes) {
      if (node.nodeType !== 1) continue;

      const el = node as Element;
      const nameElement = el.querySelector(menuConf.children.name);
      const rawUrl = el.getAttribute("href");
      const rawName = nameElement?.textContent;

      const url = utils.fixUrl(rawUrl ?? '', this.cfg.url);
      const name = utils.convertString(rawName ?? '');
      const baseId = this.getRandomBase();

      console.log(`[getMenu] Найдена категория: ${name}, URL: ${url}, ID: ${baseId}`);

      this.categories.push({
        id: baseId,
        name: name,
        url: url
      });

      if (this.cfg.menu.sub_catgs.main) {
        console.log(`[getMenu] Загружаем подкатегории для: ${name}`);
        const subcatgs = await this.getSubCatgs(url, baseId);
        this.categories.push(...subcatgs);
        console.log(`[getMenu] Добавлено подкатегорий: ${subcatgs.length}`);
      }
    }

    console.log(`[getMenu] Всего категорий: ${this.categories.length}`);
    return this.categories;
  }

  async getSubCatgs(url: string, parentId: number): Promise<Types.Category[]> {
    console.log(`[getSubCatgs] Загружаем подкатегории с ${url}`);
    const doc = await this.fetch(url);
    const doc_catgs = this.selectmany(doc, this.cfg.menu.sub_catgs.main);
    const catgs: Types.Category[] = [];

    let offset = 1;

    for (const cat of doc_catgs) {
      const rawUrl = cat.querySelector(this.cfg.menu.sub_catgs.url)?.getAttribute("href");
      const rawName = cat.textContent;
      const name = utils.convertString(rawName ?? '');
      const fixedUrl = utils.fixUrl(rawUrl ?? '', this.cfg.url);

      console.log(`[getSubCatgs] Подкатегория: ${name}, URL: ${fixedUrl}, ID: ${parentId + offset}`);

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
    const el = result.iterateNext() as Element;

    if (!el) {
      console.warn(`[select] Не найден элемент по селектору: ${selector}`);
    } else {
      console.log(`[select] Найден элемент по селектору: ${selector}`);
    }

    return el;
  }

  selectmany(doc: Document, selector: string, base: Node = doc): Element[] {
    const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
    const result = doc.evaluate(path, base, null, 5, null);

    const els: Element[] = [];
    for (let el = result.iterateNext(); el; el = result.iterateNext()) {
      els.push(el as Element);
    }

    console.log(`[selectmany] Селектор: ${selector}, Найдено элементов: ${els.length}`);
    return els;
  }
}
