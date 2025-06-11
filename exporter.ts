// exporter.ts
import fs from 'fs';
import { URL } from 'url';
import * as utils from './utils';
import Types from './types/types'



interface ProductPrice {
  id?: string;
  price: number;
  old_price?: number;
  index?: [number, number];
}


export default class Exporter {
  constructor(private cfg: Types.ExporterConfig) {}

  exportJSON({ name, company, url, categories, products, modifiers_groups }: Types.ExportData): void {
    const output = {
      name,
      company,
      url,
      currency: 'RUB',
      modifiers_groups,
      products,
      categories
    };

    const fileName = `./export/${this.cfg.filename || 'export'}.json`;
    fs.writeFileSync(fileName, JSON.stringify(output, null, 2), 'utf8');
    utils.log(`JSON export done: ${fileName}`);
  }

  exportXML({ name, company, url, categories, products, modifiers_groups }: Types.ExportData): void {
    const now = utils.getTime();
    const xml: string[] = [];
    console.log(categories.length)
    console.log(products.length)

    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push(`<yml_catalog date="${now}">`);
    xml.push('<shop>');
    xml.push(`<name>${name}</name>`);
    xml.push(`<company>${company}</company>`);
    xml.push(`<url>${url}</url>`);
    xml.push('<currencies><currency id="RUR" rate="1"/></currencies>');

    if (modifiers_groups?.length > 0) {
      xml.push('<modifiersGroups>');
      modifiers_groups.forEach((group, i) => {
        xml.push(`<modifiersGroup id="${i + 1}">`);
        xml.push(`<name>${group.name}</name>`);
        xml.push(`<type>${group.type}</type>`);
        xml.push(`<minimum>${group.minimum}</minimum>`);
        xml.push(`<maximum>${group.maximum}</maximum>`);
        xml.push('</modifiersGroup>');
      });
      xml.push('</modifiersGroups>');
    }

    xml.push('<categories>');
    categories.forEach((cat) => {
      console.log(cat)
      // const parentAttr = cat.parent ? ` parentId="${cat.parent}"` : '';
      xml.push(`<category id="${cat.id}">${cat.name}</category>`);
    });
    xml.push('</categories>');

    xml.push('<offers>');
    Object.values(products).forEach((product) => {
      
      xml.push(`<offer id="${product.id}" available="true">`);
      xml.push(`<name>${product.name}</name>`);
      xml.push(`<description><![CDATA[${product.description || ''}]]></description>`);
      xml.push(`<picture>${product.picture || ''}</picture>`);
      xml.push(`<parameters>`);
      (product.price || []).forEach((p, idx) => {
        xml.push(`<parameter id="${p.id || `${product.id}_${idx}`}">`);
        xml.push(`<price>${p.price}</price>`);
        if (p.old_price) xml.push(`<old_price>${p.old_price}</old_price>`);
        xml.push(`<description>${p.index?.[0] || 1}</description>`);
        xml.push(`<descriptionIndex>${p.index?.[1] || 10}</descriptionIndex>`);
        xml.push(`</parameter>`);
      });
      xml.push(`</parameters>`);
      xml.push(`<categoryId>${product.category}</categoryId>`);
      if (product.labels?.length) {
        xml.push('<labelsIds>');
        product.labels.forEach(l => xml.push(`<labelId>${l}</labelId>`));
        xml.push('</labelsIds>');
      }
      if (product.modifiers?.length) {
        xml.push('<modifiersGroupsIds>');
        product.modifiers.forEach(m => xml.push(`<modifiersGroupId>${m}</modifiersGroupId>`));
        xml.push('</modifiersGroupsIds>');
      }
      xml.push('</offer>');
    });
    xml.push('</offers>');
    xml.push('</shop>');
    xml.push('</yml_catalog>');

    const fileName = `./export/${this.cfg.filename || 'export'}.xml`;
    fs.writeFileSync(fileName, xml.join(''), 'utf8');
    utils.log(`XML export done: ${fileName}`);
  }
}
