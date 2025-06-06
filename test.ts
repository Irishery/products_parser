import MenuParser from './menuParser';
import config from './config.json';
import Types from './types/types'


class Parser{
  private cfg!: Types.Config;
  private categories: Types.Category[] = [];
  private products: Types.Product[] = [];

  init(cfg: Types.Config) {
    this.cfg = cfg;
  }

  async start(): Promise<void> {
    const menuParser = new MenuParser(this.cfg);

    this.categories = await menuParser.getMenu();
  
    for (const category of this.categories) {
      console.log(category);
    }
  }
}

export default new Parser();
