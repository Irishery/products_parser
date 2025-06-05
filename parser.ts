// parser.ts
import MenuParser from './menuParser';
import ProductParser from './productParser';
import Exporter from './exporter';
import * as utils from './utils';
import Config from './types/types'


interface Category {
  id: number;
  name: string;
  url: string;
  parent?: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  picture?: string;
  price?: any[];
  category: number;
  labels?: string[];
  modifiers?: string[];
}

interface ModifierGroup {
  name: string;
  type: string;
  minimum: number;
  maximum: number;
}

interface Callbacks {
  get_product?: (...args: any[]) => any;
  get_menu?: (...args: any[]) => any;
}

class Parser {
  private cfg!: Config;
  private callbacks: Callbacks = {};
  private categories: Category[] = [];
  private products: Record<string, Product> = {};
  private modifiers_groups: ModifierGroup[] = [];

  init(cfg: Config, callbacks: Callbacks = {}): void {
    this.cfg = cfg;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    const menuParser = new MenuParser(this.cfg);
    const productParser = new ProductParser(this.cfg, this.cfg.selectors);
    const exporter = new Exporter(this.cfg);

    // 1. Получить меню
    this.categories = await menuParser.getMenu();

    // 2. Получить товары по категориям
    for (const category of this.categories) {
      await productParser.parseCategory(category);
      await utils.delay(this.cfg.delay || 2000);
    }

    // 3. При необходимости получить детали товаров
    if (this.cfg.follow_url) {
      const detailed: Product[] = [];
      for (const prod of productParser.all_products) {
        const detailedProduct = await productParser.fetchProductDetails(prod);
        detailed.push(detailedProduct);
        await utils.delay(this.cfg.delay || 1000);
      }
      this.products = Object.fromEntries(
        detailed.map((p) => [p.id, p])
      );
    } else {
      this.products = Object.fromEntries(
        productParser.all_products.map((p) => [productParser.nextProductId(), p])
      );
    }

    // 4. Экспорт
    const urlBase = new URL(this.cfg.url).origin;
    const metadata = {
      name: this.cfg.name || urlBase,
      company: this.cfg.company || urlBase,
      url: urlBase,
      categories: this.categories,
      products: this.products,
      modifiers_groups: this.modifiers_groups,
    };

    switch (this.cfg.export) {
      case 'xml':
        exporter.exportXML(metadata);
        break;
      default:
        exporter.exportJSON(metadata);
    }

    utils.log(`Готово: ${Object.keys(this.products).length} товаров.`);
  }

  import_modifiers_group(group: ModifierGroup): number {
    const group_id = this.modifiers_groups.length;
    this.modifiers_groups.push(group);
    return group_id + 1;
  }
}

export default new Parser();
