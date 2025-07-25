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
        return new JSDOM(html, {
          // runScripts: "dangerously", // если нужно выполнять скрипты
          // resources: "usable",       // если нужно загружать ресурсы
          pretendToBeVisual: true,  // для эмуляции визуального рендеринга
          // Отключаем обработку стилей
          beforeParse(window) {
            window._virtualConsole.emit = function (event: any) {
              if (event.name === 'Could not parse CSS stylesheet') {
                return false; // игнорируем ошибки парсинга CSS
              }
              return true;
            };
          }
        }).window.document;

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

  getRandomBase(min = 10000, max = 100000): number {
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
      // const rawUrl = el.getAttribute("href");
      const rawUrl = el.querySelector(menuConf.children.url)?.getAttribute("href");

      const rawName = nameElement?.textContent;

      const url = utils.fixUrl(rawUrl ?? '', this.cfg.url);
      const name = utils.convertString(rawName ?? '').trim();
      const baseId = (this.categories.length + 1) * 10000;

      console.log(`[getMenu] Найдена категория: ${name}, URL: ${url}, ID: ${baseId}`);

      this.categories.push({
        id: baseId,
        name: name,
        url: url
      });


      // const sub_doc = await this.fetch(url)
      // console.log("AASDDS ", sub_doc.querySelector(".catalog-type .catalog-type__list a")?.textContent)
      // if (sub_doc.querySelector(".catalog-type .catalog-type__list")) {
      //   console.log("FLAG")
      //   let offset = 1;
      //   for (const sub of sub_doc.querySelectorAll(".catalog-type .catalog-type__list a")) {
      //     console.log(sub.querySelectorAll(".catalog-type .catalog-type__list a").length)
      //     const sub_name = sub?.textContent?.trim() ?? '';
      //     if (sub_name == "Все") {
      //       continue
      //     }
      //     const raw_url = sub?.getAttribute("href");
      //     const sub_url = utils.fixUrl(raw_url ?? '', this.cfg.url);

      //     this.categories.push({
      //       id: (this.categories.length + 1) * 10000,
      //       name: sub_name,
      //       url: sub_url,
      //       parent_id: baseId
      //     });

      //     offset++;
      //   }
      // }



      // if (this.cfg.menu.sub_catgs.main) {
      //   console.log(`[getMenu] Загружаем подкатегории для: ${name}`);
      //   const subcatgs = await this.getSubCatgs(url, baseId);
      //   this.categories.push(...subcatgs);
      //   console.log(`[getMenu] Добавлено подкатегорий: ${subcatgs.length}`);
      // }
    }

    console.log(`[getMenu] Всего категорий: ${this.categories.length} `);
    return this.categories;
  }

  // async getSubCatgs(url: string, parentId: number): Promise<Types.Category[]> {
  //   console.log(`[getSubCatgs] Загружаем подкатегории с ${ url } `);
  //   const doc = await this.fetch(url);
  //   const doc_catgs = this.selectmany(doc, this.cfg.menu.sub_catgs.main);
  //   const catgs: Types.Category[] = [];

  //   let offset = 1;

  //   for (const cat of doc_catgs) {
  //     const rawUrl = cat.querySelector(this.cfg.menu.sub_catgs.url)?.getAttribute("href");
  //     const rawName = cat.textContent;
  //     const name = utils.convertString(rawName ?? '');
  //     const fixedUrl = utils.fixUrl(rawUrl ?? '', this.cfg.url);

  //     console.log(`[getSubCatgs] Подкатегория: ${ name }, URL: ${ fixedUrl }, ID: ${ parentId + offset } `);

  //     catgs.push({
  //       id: parentId + offset,
  //       name: name,
  //       url: fixedUrl,
  //       parent_id: parentId
  //     });

  //     offset++;
  //   }

  //   return catgs;
  // }




  select(doc: Document, selector: string, base: Node = doc): Element {
    const path = this.cfg.cssmode !== 'xpath' ? cssToXpath(selector) : selector;
    const result = doc.evaluate(path, base, null, 5, null);
    const el = result.iterateNext() as Element;

    if (!el) {
      console.warn(`[select] Не найден элемент по селектору: ${selector} `);
    } else {
      console.log(`[select] Найден элемент по селектору: ${selector} `);
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

    console.log(`[selectmany] Селектор: ${selector}, Найдено элементов: ${els.length} `);
    return els;
  }
}
